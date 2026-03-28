import threading
from datetime import datetime
from anomaly import AnomalyDetector


class CaptureManager:
    """
    Owns the capture thread, stop event, and active session id.
    Instantiated once at startup and shared across routers via import.
    """

    def __init__(self):
        self._thread:     threading.Thread | None = None
        self._stop_event: threading.Event         = threading.Event()
        self._session_id: int | None              = None
        self.detector:    AnomalyDetector         = AnomalyDetector()

    # ── public state ──────────────────────────────────────────────────────────

    @property
    def active_session_id(self) -> int | None:
        return self._session_id

    @property
    def is_running(self) -> bool:
        return self._session_id is not None

    # ── lifecycle ─────────────────────────────────────────────────────────────

    def start(self, session_id: int, packet_callback) -> dict:
        if self.is_running:
            raise RuntimeError(f'Capture already running on session {self._session_id}')

        self.detector._reset_state()
        self._session_id = session_id
        self._stop_event.clear()

        from core.config import CAPTURE_INTERFACE
        from scapy.sendrecv import sniff

        self._thread = threading.Thread(
            target=lambda: sniff(
                iface=CAPTURE_INTERFACE,
                prn=packet_callback,
                store=False,
                stop_filter=lambda _: self._stop_event.is_set(),
            ),
            daemon=True,
        )
        self._thread.start()
        return {'start_timestamp': datetime.now().isoformat()}

    def stop(self) -> dict:
        if not self.is_running:
            raise RuntimeError('No capture is currently running')

        completed_session_id = self._session_id
        self._stop_event.set()

        if self._thread:
            self._thread.join()

        self._session_id = None
        self._thread     = None

        return {
            'stop_timestamp': datetime.now().isoformat(),
            'session_id':     completed_session_id,
        }


# ── singleton ─────────────────────────────────────────────────────────────────
# Import this instance everywhere instead of instantiating a new one
capture_manager = CaptureManager()
