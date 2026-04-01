"""
build.py
────────────────────────────────────────────────────────────────────────────────
NETAnalyzer — one-shot build script.

Steps
─────
1. Checks dependencies (Node, npm, PyInstaller, Pillow).
2. Converts the SVG favicon → netanalyzer.ico (multi-resolution).
3. Builds the React frontend  (npm run build → backend/static/).
4. Writes a PyInstaller .spec file tuned for Scapy / FastAPI / SQLAlchemy.
5. Runs PyInstaller → dist/NETAnalyzer/NETAnalyzer.exe

Usage
─────
    # From the project root (the folder that contains backend/ and frontend/)
    python build.py

Requirements (install once)
───────────────────────────
    pip install pyinstaller pillow
    npm is already on your PATH (needed to build the frontend)

Notes
─────
- Run the terminal as Administrator — Scapy and Npcap need elevated privileges
  at runtime, and PyInstaller may need them to bundle some hooks.
- The finished executable lives at  dist/NETAnalyzer/NETAnalyzer.exe
- Ship the entire dist/NETAnalyzer/ folder; the .exe won't work on its own.
────────────────────────────────────────────────────────────────────────────────
"""

import math
import os
import shutil
import subprocess
import sys
from pathlib import Path

# ── Resolve project root (the folder this script lives in) ────────────────────
ROOT     = Path(__file__).resolve().parent
BACKEND  = ROOT / "backend"
FRONTEND = ROOT / "frontend"
ICON_OUT = ROOT / "netanalyzer.ico"
SPEC_OUT = ROOT / "NETAnalyzer.spec"


# ══════════════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════════════

def run(cmd: list[str], cwd: Path | None = None) -> None:
    """Run a subprocess; raise SystemExit on failure."""
    print(f"\n▶  {' '.join(str(c) for c in cmd)}")
    result = subprocess.run(cmd, cwd=cwd)
    if result.returncode != 0:
        print(f"\n✕  Command failed (exit {result.returncode}). Aborting.")
        sys.exit(result.returncode)


def check_tool(name: str, test_args: list[str]) -> None:
    """Verify that an external tool is on PATH."""
    try:
        subprocess.run(test_args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                       check=True)
    except (FileNotFoundError, subprocess.CalledProcessError):
        print(f"\n✕  '{name}' not found or not working. Please install it first.")
        sys.exit(1)


# ══════════════════════════════════════════════════════════════════════════════
# Step 1 — preflight checks
# ══════════════════════════════════════════════════════════════════════════════

def check_deps() -> None:
    print("── Step 1: checking dependencies ─────────────────────────────────")

    check_tool("node", ["node", "--version"])
    check_tool("npm",  ["npm.cmd",  "--version"])

    try:
        import PyInstaller  # noqa: F401
    except ImportError:
        print("\n✕  PyInstaller not found.  Run:  pip install pyinstaller")
        sys.exit(1)

    try:
        from PIL import Image  # noqa: F401
    except ImportError:
        print("\n✕  Pillow not found.  Run:  pip install pillow")
        sys.exit(1)

    print("✓  All dependencies present.")


# ══════════════════════════════════════════════════════════════════════════════
# Step 2 — generate ICO from the SVG favicon design
# ══════════════════════════════════════════════════════════════════════════════

def make_icon() -> None:
    """
    Recreate the radar favicon as a multi-resolution .ico file.

    The design mirrors frontend/public/favicon.svg:
      - Dark (#0d1220) rounded-rectangle background
      - Four concentric circles in #4fc3f7 at increasing opacity
      - A green sweep line from the centre toward the upper-right
      - A blue centre dot and a green ping dot
    """
    print("\n── Step 2: generating netanalyzer.ico ─────────────────────────────")

    from PIL import Image, ImageDraw

    SIZES = [16, 32, 48, 64, 128, 256]
    frames: list[Image.Image] = []

    for size in SIZES:
        img  = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)

        m  = max(1, size // 16)          # outer margin
        cx = cy = size // 2              # canvas centre
        r  = size // 2 - m * 2          # max ring radius

        # ── background ──────────────────────────────────────────────────────
        radius = max(2, size // 5)
        draw.rounded_rectangle([m, m, size - m, size - m],
                                radius=radius, fill=(13, 18, 32, 255))

        # ── concentric rings ─────────────────────────────────────────────────
        ring_fractions = [1.0, 0.75, 0.5, 0.25]
        ring_opacities = [51, 102, 153, 204]
        stroke = max(1, size // 32)

        for frac, alpha in zip(ring_fractions, ring_opacities):
            rr = int(r * frac)
            if rr <= 0:
                continue
            draw.ellipse(
                [cx - rr, cy - rr, cx + rr, cy + rr],
                outline=(79, 195, 247, alpha),
                width=stroke,
            )

        # ── sweep line (green, upper-right at 315°) ──────────────────────────
        angle   = -math.pi / 4          # 45° above horizontal
        sweep_r = max(1, int(r * 0.7))
        ex      = cx + int(sweep_r * math.cos(angle))
        ey      = cy + int(sweep_r * math.sin(angle))
        sw      = max(1, size // 20)
        draw.line([cx, cy, ex, ey], fill=(34, 197, 94, 230), width=sw)

        # ── centre dot (blue) ────────────────────────────────────────────────
        dot = max(1, size // 16)
        draw.ellipse([cx - dot, cy - dot, cx + dot, cy + dot],
                     fill=(79, 195, 247, 255))

        # ── ping dot (green, upper-right quadrant) ────────────────────────────
        px = cx + int(r * 0.4)
        py = cy - int(r * 0.4)
        draw.ellipse([px - dot, py - dot, px + dot, py + dot],
                     fill=(34, 197, 94, 255))

        frames.append(img)

    # Save all resolutions into a single .ico
    frames[0].save(
        ICON_OUT,
        format="ICO",
        sizes=[(s, s) for s in SIZES],
        append_images=frames[1:],
    )
    print(f"✓  Icon written to {ICON_OUT}  ({ICON_OUT.stat().st_size} bytes)")


# ══════════════════════════════════════════════════════════════════════════════
# Step 3 — build the React frontend
# ══════════════════════════════════════════════════════════════════════════════

def build_frontend() -> None:
    print("\n── Step 3: building React frontend ────────────────────────────────")

    static_dir = BACKEND / "static"

    npm = "npm.cmd" if sys.platform == "win32" else "npm"

    run([npm, "install"], cwd=FRONTEND)
    run([npm, "run", "build"], cwd=FRONTEND)

    if not static_dir.is_dir():
        print(f"\n✕  Expected build output at {static_dir} but it was not found.")
        sys.exit(1)

    print(f"✓  Frontend built → {static_dir}")


# ══════════════════════════════════════════════════════════════════════════════
# Step 4 — write the PyInstaller .spec file
# ══════════════════════════════════════════════════════════════════════════════

def write_spec() -> None:
    print("\n── Step 4: writing NETAnalyzer.spec ───────────────────────────────")

    # Paths that must be bundled as data (source → dest-folder-inside-bundle)
    # Use os.sep so the spec works on Windows and Linux alike.
    spec_content = r"""# NETAnalyzer.spec  —  auto-generated by build.py
# Edit here if you need to add extra data files or hidden imports.

import sys
from pathlib import Path
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None

# ── data files to bundle ──────────────────────────────────────────────────────
datas = [
    # React build output (served by FastAPI StaticFiles)
    (str(Path("backend") / "static"), str(Path("backend") / "static")),

    # .env.example so the app can explain config at runtime (optional)
    (str(Path("backend") / ".env.example"), "backend"),

    # manuf OUI database (MAC vendor lookups)
    *collect_data_files("manuf"),

    # scapy data files (protocol definitions, etc.)
    *collect_data_files("scapy"),
]

# ── hidden imports PyInstaller misses ─────────────────────────────────────────
hidden_imports = [
    # uvicorn — fully handled by hook-uvicorn.py via hookspath=["."]

    # FastAPI / Starlette
    "starlette.routing",
    "starlette.middleware",
    "starlette.staticfiles",
    "starlette.responses",
    "starlette.websockets",
    "fastapi.middleware.cors",

    # SQLAlchemy dialects
    "sqlalchemy.dialects.sqlite",

    # Scapy layers (import all so protocol dissectors work)
    *collect_submodules("scapy.layers"),
    *collect_submodules("scapy.contrib"),

    # pydantic v2
    "pydantic.deprecated.class_validators",

    # python-dotenv
    "dotenv",

    # openpyxl (Excel export)
    "openpyxl",
    "openpyxl.styles",
    "openpyxl.utils",

    # standard-library extras sometimes missed
    "email.mime.text",
    "email.mime.multipart",

    # system tray
    "pystray",
    "pystray._win32",
]

a = Analysis(
    ["backend/run.py"],          # ← entry-point created by build.py
    pathex=["."],
    binaries=[],
    datas=datas,
    hiddenimports=hidden_imports,
    hookspath=["."],   # picks up hook-uvicorn.py in the project root
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "tkinter",
        "matplotlib",
        "numpy",
        "pandas",
        "IPython",
        "jupyter",
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="NETAnalyzer",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,           # True to keep console so uvicorn logs are visible
    icon=r"netanalyzer.ico",
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="NETAnalyzer",
)
"""

    SPEC_OUT.write_text(spec_content, encoding="utf-8")
    print(f"✓  Spec written to {SPEC_OUT}")


# ══════════════════════════════════════════════════════════════════════════════
# Step 4b — write backend/run.py  (clean uvicorn entry-point)
# ══════════════════════════════════════════════════════════════════════════════

def write_entrypoint() -> None:
    """
    PyInstaller bundles a single entry-point script.
    This launcher starts uvicorn programmatically so it works inside a
    frozen executable (sys.frozen == True) where __main__ tricks don't apply.
    """
    run_py = BACKEND / "run.py"
    content = '''\
import multiprocessing
multiprocessing.freeze_support()

import sys
import os

if getattr(sys, "frozen", False):
    bundle_dir = sys._MEIPASS
    sys.path.insert(0, bundle_dir)
    sys.path.insert(0, os.path.join(bundle_dir, "backend"))
    os.chdir(os.path.dirname(sys.executable))
    sys.stdout = open(os.devnull, "w")
    sys.stderr = open(os.devnull, "w")
else:
    sys.path.insert(0, os.path.dirname(__file__))

import threading
import webbrowser
import uvicorn
import pystray
from PIL import Image

def open_browser():
    import time
    time.sleep(1.5)
    webbrowser.open("http://localhost:8000")

def create_tray_icon():
    import pystray
    from PIL import Image, ImageDraw
    import math

    # create a clean 64x64 image optimized for tray display
    size = 64
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    cx = cy = size // 2
    r = size // 2 - 4

    # background circle (no rounded rect — looks better at small sizes)
    draw.ellipse([2, 2, size-2, size-2], fill=(13, 18, 32, 255))

    # concentric rings
    for frac, alpha in [(1.0, 51), (0.66, 120), (0.33, 200)]:
        rr = int(r * frac)
        draw.ellipse([cx-rr, cy-rr, cx+rr, cy+rr],
                     outline=(79, 195, 247, alpha), width=1)

    # sweep line
    angle = -math.pi / 4
    ex = cx + int(r * 0.75 * math.cos(angle))
    ey = cy + int(r * 0.75 * math.sin(angle))
    draw.line([cx, cy, ex, ey], fill=(34, 197, 94, 220), width=3)

    # center dot
    draw.ellipse([cx-3, cy-3, cx+3, cy+3], fill=(79, 195, 247, 255))

    # ping dot
    px = cx + int(r * 0.45)
    py = cy - int(r * 0.45)
    draw.ellipse([px-3, py-3, px+3, py+3], fill=(34, 197, 94, 255))

    def on_open(icon, item):
        webbrowser.open("http://localhost:8000")

    def on_quit(icon, item):
        icon.stop()
        os._exit(0)

    menu = pystray.Menu(
        pystray.MenuItem("Open NETAnalyzer", on_open, default=True),
        pystray.MenuItem("Quit", on_quit),
    )
    icon = pystray.Icon("NETAnalyzer", image, "NETAnalyzer", menu)
    icon.run()

if __name__ == "__main__":
    from main import app
    threading.Thread(target=open_browser, daemon=True).start()
    threading.Thread(
        target=lambda: uvicorn.run(
            app,
            host="0.0.0.0",
            port=8000,
            reload=False,
            log_level="info",
        ),
        daemon=True,
    ).start()
    create_tray_icon()  # blocks until user clicks Quit
'''
    run_py.write_text(content, encoding="utf-8")
    print(f"✓  Entry-point written to {run_py}")


# ══════════════════════════════════════════════════════════════════════════════
# Step 5 — run PyInstaller
# ══════════════════════════════════════════════════════════════════════════════

def run_pyinstaller() -> None:
    print("\n── Step 5: running PyInstaller ────────────────────────────────────")
    run(
        [sys.executable, "-m", "PyInstaller", "--clean", "--noconfirm", str(SPEC_OUT)],
        cwd=ROOT,
    )
    exe = ROOT / "dist" / "NETAnalyzer" / "NETAnalyzer.exe"
    if exe.exists():
        print(f"\n✓  Build successful!\n   Executable → {exe}")
        print("\n   To distribute: copy the entire  dist/NETAnalyzer/  folder.")
        print("   Run NETAnalyzer.exe as Administrator (Scapy needs raw-socket access).")
    else:
        print("\n✕  PyInstaller finished but NETAnalyzer.exe was not found.")
        print("   Check the build output above for errors.")
        sys.exit(1)


# ══════════════════════════════════════════════════════════════════════════════
# Main
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("═" * 60)
    print("  NETAnalyzer — build script")
    print(f"  Project root: {ROOT}")
    print("═" * 60)

    check_deps()
    make_icon()
    build_frontend()
    write_entrypoint()
    write_spec()
    run_pyinstaller()

    print("\n" + "═" * 60)
    print("  Done!  dist/NETAnalyzer/NETAnalyzer.exe is ready.")
    print("═" * 60)
