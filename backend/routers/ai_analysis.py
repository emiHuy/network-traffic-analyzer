import json
import urllib.request
import urllib.error

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.5-flash:generateContent"
)


# ── Request models ─────────────────────────────────────────────────────────────

class SessionAnalysisRequest(BaseModel):
    api_key: str
    total_packets: int
    avg_packet_size: float | None
    active_hosts: int
    peak_packets_per_min: int
    protocol_breakdown: str   # e.g. "TCP: 400, UDP: 120"
    top_ips: str              # e.g. "192.168.1.5 (320 pkts), ..."
    alert_count: int
    alerts_summary: str       # pre-formatted text


class AlertAnalysisRequest(BaseModel):
    api_key: str
    rule: str
    severity: str
    src_ip: str
    dst_ip: str
    description: str


# ── Gemini helper ──────────────────────────────────────────────────────────────

def _call_gemini(prompt: str, api_key: str) -> str:
    if not api_key or not api_key.strip():
        raise HTTPException(status_code=400, detail="Gemini API key is required.")

    url = f"{GEMINI_URL}?key={api_key.strip()}"
    payload = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "maxOutputTokens": 2048,
            "temperature": 0.4,
        },
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            detail = json.loads(raw).get("error", {}).get("message", raw)
        except Exception:
            detail = raw
        raise HTTPException(status_code=502, detail=f"Gemini error: {detail}")
    except urllib.error.URLError as e:
        raise HTTPException(status_code=502, detail=f"Network error: {e.reason}")

    try:
        return body["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        raise HTTPException(status_code=502, detail="Unexpected Gemini response format.")


# ── Prompt builders ────────────────────────────────────────────────────────────

def _session_prompt(r: SessionAnalysisRequest) -> str:
    return f"""You are a network security analyst. Analyze this packet capture session concisely.

SESSION STATS:
- Total packets: {r.total_packets}
- Avg packet size: {f"{round(r.avg_packet_size)} B" if r.avg_packet_size else "N/A"}
- Active hosts: {r.active_hosts}
- Peak packets/min: {r.peak_packets_per_min}
- Protocol breakdown: {r.protocol_breakdown or "N/A"}
- Top source IPs: {r.top_ips or "N/A"}

ALERTS ({r.alert_count} total):
{r.alerts_summary}

Respond with exactly these four sections using **bold** headers:

**Traffic Overview**
2-3 sentences on overall traffic patterns.

**Security Assessment**
Highlight concerns or confirm clean traffic.

**Key Observations**
2-3 bullet points of notable data points.

**Recommendations**
1-2 actionable items. If traffic looks clean, say so briefly.

Be direct and technical. Keep total response under 250 words."""


def _alert_prompt(r: AlertAnalysisRequest) -> str:
    return f"""You are a network security expert. Explain this alert briefly.

ALERT:
- Rule: {r.rule}
- Severity: {r.severity}
- Source: {r.src_ip} → {r.dst_ip}
- Description: {r.description}

Respond with exactly these four sections using **bold** headers:

**What happened**
One sentence plain-language explanation.

**Why it matters**
One sentence on potential risk or impact.

**False positive likelihood**
low / medium / high — one sentence reasoning.

**Recommended action**
One concrete next step.

Keep total response under 120 words."""


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post("/analyze/session")
def analyze_session(body: SessionAnalysisRequest):
    text = _call_gemini(_session_prompt(body), body.api_key)
    return {"result": text}


@router.post("/analyze/alert")
def analyze_alert(body: AlertAnalysisRequest):
    text = _call_gemini(_alert_prompt(body), body.api_key)
    return {"result": text}
