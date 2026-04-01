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
