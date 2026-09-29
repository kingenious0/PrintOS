import sys
import os
from pathlib import Path

# Add backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = BASE_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import uvicorn
from app import app, get_local_ip

if __name__ == "__main__":
    if "--real" in sys.argv or "--hardware" in sys.argv:
        os.environ["PRINTOS_MOCK_PRINTER"] = "0"
    
    import printer
    target_printer = printer.get_system_default_printer()
    is_mock = printer.is_mock_mode()
    local_ip = get_local_ip()
    port = 8000

    print("=" * 70)
    print(">>  PrintOS V1 - Autonomous Self-Service Printing Kiosk")
    print("=" * 70)
    print(f"[*] Kiosk Touchscreen Screen:  http://localhost:{port}/kiosk")
    print(f"[*] Customer Mobile PWA:       http://{local_ip}:{port}/pwa")
    print(f"[*] Walk-in Direct Upload:     http://{local_ip}:{port}/upload")
    print(f"[*] Hub & Launcher Portal:     http://localhost:{port}/")
    print("-" * 70)
    if is_mock:
        print(f"[*] Spooler Subsystem:         [VIRTUAL MOCK SPOOLER]")
        print(f"                               Detected Hardware: '{target_printer}'")
        print(f"                               (Run 'python run.py --real' to print physical paper)")
    else:
        print(f"[✓] Spooler Subsystem:         [LIVE PHYSICAL HARDWARE]")
        print(f"                               Target Printer: '{target_printer}'")
    print("=" * 70)
    print("Tip: Connect your phone to the same Wi-Fi and open the PWA URL above!")
    print("=" * 70)

    uvicorn.run("backend.app:app", host="0.0.0.0", port=port, reload=True)
