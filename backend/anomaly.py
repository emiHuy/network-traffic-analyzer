from collections import defaultdict
from datetime import datetime, timedelta
from stats import get_packets

# ── Tunable thresholds ─────────────────────────────────────────────────────────
HIGH_VOLUME_LIMIT    = 200   # packets from one IP within the time window
HIGH_VOLUME_WINDOW   = 60    # seconds

PORT_SCAN_LIMIT      = 15    # unique ports on one dst_ip within the time window
PORT_SCAN_WINDOW     = 30    # seconds

SUSPICIOUS_PORTS = {
    4444,   # common malware / metasploit
    6667,   # IRC botnet
    6668,
    6669,
    31337,  # classic backdoor
    1337,   # misc malware
    9001,   # tor / misc malware
    9002,
    1080,   # SOCKS proxy abuse
    8080,   # often used by malware as C2
    12345,  # misc backdoor
    27374,  # SubSeven trojan
}


class AnomalyDetector:
    """
    Rule-based anomaly detector.

    Real-time usage (call from capture.py):
        detector = AnomalyDetector()
        alerts = detector.analyze_packet(packet_dict)

    Post-capture usage:
        alerts = detector.analyze_session(session_id)
    """

    def __init__(self):
        self._reset_state()

    def _reset_state(self):
        # { src_ip: [timestamp, ...] }
        self._volume_window: dict[str, list[datetime]] = defaultdict(list)

        # { src_ip: { dst_ip: [(port, timestamp), ...] } }
        self._port_attempts: dict[str, dict[str, list[tuple]]] = defaultdict(
            lambda: defaultdict(list)
        )

        # track which IPs / pairs have already fired an alert (avoid duplicates)
        self._alerted_ips: set[str] = set()
        self._alerted_pairs: set[tuple] = set()

    # ── Public API ─────────────────────────────────────────────────────────────

    def analyze_packet(self, packet: dict) -> list[dict]:
        """
        Analyze a single packet in real time.
        Returns a (possibly empty) list of alert dicts.
        """
        return self._evaluate([packet], realtime=True)

    def analyze_session(self, session_id: int) -> list[dict]:
        """
        Analyze all packets in a session from the DB.
        Resets internal state first so previous captures don't bleed in.
        Returns a list of alert dicts.
        """
        self._reset_state()
        packets = get_packets(session_id, limit=None, desc=False)
        return self._evaluate(packets, realtime=False)

    # ── Core rules ─────────────────────────────────────────────────────────────

    def _evaluate(self, packets: list[dict], realtime: bool) -> list[dict]:
        alerts = []
        for pkt in packets:
            alerts.extend(self._check_suspicious_port(pkt))
            alerts.extend(self._check_high_volume(pkt))
            alerts.extend(self._check_port_scan(pkt))
        return alerts

    def _check_suspicious_port(self, pkt: dict) -> list[dict]:
        dst_port = pkt.get('dst_port')
        if dst_port and dst_port in SUSPICIOUS_PORTS:
            return [_make_alert(
                pkt=pkt,
                rule='suspicious_port',
                severity='high',
                description=(
                    f"{pkt.get('src_ip')} sent traffic to port {dst_port} on "
                    f"{pkt.get('dst_ip')} — port associated with malware or backdoors."
                ),
            )]
        return []

    def _check_high_volume(self, pkt: dict) -> list[dict]:
        src = pkt.get('src_ip')
        if not src:
            return []

        now = _parse_ts(pkt.get('timestamp'))
        cutoff = now - timedelta(seconds=HIGH_VOLUME_WINDOW)

        # drop timestamps outside the window
        self._volume_window[src] = [
            t for t in self._volume_window[src] if t >= cutoff
        ]
        self._volume_window[src].append(now)

        count = len(self._volume_window[src])
        if count >= HIGH_VOLUME_LIMIT and src not in self._alerted_ips:
            self._alerted_ips.add(src)
            return [_make_alert(
                pkt=pkt,
                rule='high_volume',
                severity='medium',
                description=(
                    f"{src} sent {count} packets in {HIGH_VOLUME_WINDOW}s — "
                    f"possible flood or port scan activity."
                ),
            )]
        return []

    def _check_port_scan(self, pkt: dict) -> list[dict]:
        src      = pkt.get('src_ip')
        dst      = pkt.get('dst_ip')
        dst_port = pkt.get('dst_port')
        if not (src and dst and dst_port):
            return []

        now     = _parse_ts(pkt.get('timestamp'))
        cutoff  = now - timedelta(seconds=PORT_SCAN_WINDOW)

        # drop entries outside the window
        self._port_attempts[src][dst] = [
            (p, t) for p, t in self._port_attempts[src][dst] if t >= cutoff
        ]
        self._port_attempts[src][dst].append((dst_port, now))

        unique_ports = {p for p, _ in self._port_attempts[src][dst]}
        key = (src, dst)
        if len(unique_ports) >= PORT_SCAN_LIMIT and key not in self._alerted_pairs:
            self._alerted_pairs.add(key)
            return [_make_alert(
                pkt=pkt,
                rule='port_scan',
                severity='high',
                description=(
                    f"{src} probed {len(unique_ports)} unique ports on {dst} "
                    f"within {PORT_SCAN_WINDOW}s — likely a port scan."
                ),
            )]
        return []


# ── Helpers ────────────────────────────────────────────────────────────────────

def _make_alert(pkt: dict, rule: str, severity: str, description: str) -> dict:
    return {
        'timestamp':     pkt.get('timestamp', datetime.now().isoformat()),
        'src_ip':        pkt.get('src_ip'),
        'dst_ip':        pkt.get('dst_ip'),
        'rule_triggered': rule,
        'severity':      severity,
        'description':   description,
    }


def _parse_ts(ts) -> datetime:
    """Parse an ISO timestamp string, falling back to now."""
    if not ts:
        return datetime.now()
    try:
        return datetime.fromisoformat(ts)
    except (ValueError, TypeError):
        return datetime.now()