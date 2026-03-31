"""
services/anomaly.py
───────────────────────────────────────────────────────────────────────────────
Rule-based network anomaly detector.

Rules
─────
1. suspicious_port -> traffic to a port associated with malware / backdoors
2. high_volume     -> a single source IP exceeds RATE_LIMIT packets/window
3. port_scan       -> a source probes more than PORT_SCAN_LIMIT unique ports
                      on a single destination within PORT_SCAN_WINDOW seconds

Usage
─────
Real-time (called from capture.py for every captured packet):

    detector = AnomalyDetector()
    alerts = detector.analyze_packet(packet_dict)

Post-capture analysis of a stored session:

    alerts = detector.analyze_session(session_id)

Alert shape
───────────
    {
        "timestamp":     ISO-8601 string,
        "src_ip":        str,
        "dst_ip":        str,
        "rule_triggered": str,
        "severity":      "high" | "medium",
        "description":   str,
    }
───────────────────────────────────────────────────────────────────────────────
"""

from collections import defaultdict
from datetime import datetime, timedelta
from db.packets import get_packets

# ── Tunable thresholds ─────────────────────────────────────────────────────────

# Max packets a single source IP may send within HIGH_VOLUME_WINDOW seconds
HIGH_VOLUME_LIMIT    = 350   
HIGH_VOLUME_WINDOW   = 60    # seconds

# Max unique destination ports a source may probe on one host before triggering
PORT_SCAN_LIMIT      = 20    
PORT_SCAN_WINDOW     = 60    # seconds

# Destination ports associate with common malware, RATs, and backdoors
SUSPICIOUS_PORTS = {
    1080,   # SOCKS proxy abuse
    1337,   # misc malware
    4444,   # Metasploit default listener
    6667,   # IRC botnet C2
    6668,   # IRC botnet C2
    6669,   # IRC botnet C2
    8080,   # common malware C2 (mimics HTTP)
    9001,   # Tor / misc malware
    9002,   # Tor / misc malware
    12345,  # misc backdoor
    27374,  # SubSeven trojan
    31337,  # classic "elite" backdoor
}


class AnomalyDetector:
    """
    Stateful rule-based anomaly detector.

    Maintains sliding-window counters in memory so that rules can fire in
    real time without querying the database on every packet.
    """

    def __init__(self):
        self._reset_state()

    # ── Internal helpers ───────────────────────────────────────────────────────

    def _reset_state(self):
        """Clear all in-memory window counters and already-fired alert sets."""
        # { src_ip: [datetime, ...] } – timestamps within the current window
        self._volume_window: dict[str, list[datetime]] = defaultdict(list)

        # { src_ip: { dst_ip: [(port, datetime), ...] } }
        self._port_attempts: dict[str, dict[str, list[tuple]]] = defaultdict(
            lambda: defaultdict(list)
        )

        # De-duplication sets: once an alert fires for a source / pair, we
        # don't fire again until the state is reset (i.e. a new capture starts).
        self._alerted_ips: set[str] = set()
        self._alerted_pairs: set[tuple] = set()

    # ── Public API ─────────────────────────────────────────────────────────────

    def analyze_packet(self, packet: dict) -> list[dict]:
        """
        Evaluate a single packet against all rules in real time.

        Returns a (possibly empty) list of alert dicts.
        """
        return self._evaluate([packet], realtime=True)

    def analyze_session(self, session_id: int) -> list[dict]:
        """
        Re-analyse all packets for *session_id* from the database.

        Resets internal counters first so historical runs don't bleed into
        one another.  Returns the full list of generated alert dicts.
        """
        self._reset_state()
        packets = get_packets(session_id, limit=None, desc=False)
        return self._evaluate(packets, realtime=False)

    # ── Rule evaluation ────────────────────────────────────────────────────────

    def _evaluate(self, packets: list[dict], realtime: bool) -> list[dict]:
        """Apply every rule to each packet and collect alerts."""
        alerts = []
        for pkt in packets:
            alerts.extend(self._check_suspicious_port(pkt))
            alerts.extend(self._check_high_volume(pkt))
            alerts.extend(self._check_port_scan(pkt))
        return alerts

    def _check_suspicious_port(self, pkt: dict) -> list[dict]:
        """Rule 1 - traffic to a known-malicious destination port."""
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
        """Rule 2 - a single source IP exceeds the packet-rate threshold."""
        src = pkt.get('src_ip')
        if not src:
            return []

        now = _parse_ts(pkt.get('timestamp'))
        cutoff = now - timedelta(seconds=HIGH_VOLUME_WINDOW)

        # Evict timestamps that have fallen outside the sliding window.
        window = self._volume_window[src]
        self._volume_window[src] = [t for t in window[src] if t >= cutoff]
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
        """Rule 3 - source probes many unique ports on a single destination."""
        src      = pkt.get('src_ip')
        dst      = pkt.get('dst_ip')
        dst_port = pkt.get('dst_port')
        if not (src and dst and dst_port):
            return []

        now     = _parse_ts(pkt.get('timestamp'))
        cutoff  = now - timedelta(seconds=PORT_SCAN_WINDOW)

        # Evict stale entries for this src→dst pair.
        attempts = self._port_attempts[src][dst]
        self._port_attempts[src][dst] = [(p, t) for p, t in attempts[src][dst] if t >= cutoff]
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


# ── Module-level helpers ───────────────────────────────────────────────────────

def _make_alert(pkt: dict, rule: str, severity: str, description: str) -> dict:
    """Build a standardised alert dict from a packet and rule metadata."""
    return {
        'timestamp':     pkt.get('timestamp', datetime.now().isoformat()),
        'src_ip':        pkt.get('src_ip'),
        'dst_ip':        pkt.get('dst_ip'),
        'rule_triggered': rule,
        'severity':      severity,
        'description':   description,
    }


def _parse_ts(ts) -> datetime:
    """Parse an ISO-8601 timestamp string, falling back to *now* on failure."""
    if not ts:
        return datetime.now()
    try:
        return datetime.fromisoformat(ts)
    except (ValueError, TypeError):
        return datetime.now()