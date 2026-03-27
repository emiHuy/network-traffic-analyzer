# Network Traffic Analyzer
A Python-based network traffic analyzer that captures live packets, stores them in a SQLite database, and displays real-time stats through a web dashboard. Built with Scapy, FastAPI, and React.

## Project Status  
 
✅ **M1** — Packet capture to terminal  
✅ **M2** — Packet storage and stats (SQLite + SQLAlchemy)   
✅ **M3** — Live web dashboard (FastAPI + React)
✅ **M4** — Network Device Diagram 

---

## Requirements
- Run backend terminal as **Administrator** (required for packet capture)
- Npcap installed in WinPcap compatibility mode

---

## Installation & Execution
### Backend
> Must run as Administrator for packet capture
```bash
cd backend
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## ⚠️ Disclaimer

This tool is built for use on networks you own or have explicit permission to monitor. Packet capture on networks without authorisation is illegal. This project is developed and tested on a personal home network only.

---

## License

MIT

---