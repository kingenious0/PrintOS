# PrintOS V1 — Autonomous Self-Service Printing Kiosk (Lab Prototype)

Autonomous, unattended printing kiosk system designed for university campuses to eliminate print shop queues, paper forms, and counter staff.

---

## 🏗️ System Architecture

```
                    ┌─────────────────────────┐
                    │  Customer Phone (PWA)   │
                    │  (Free Remote Staging)  │
                    └────────────┬────────────┘
                                 │ HTTP (Local Wi-Fi or LAN)
                                 ▼
┌──────────────────────────────────────────────────────────────┐
│  Laptop / Edge Device Station                                │
│                                                              │
│  ┌───────────────────────┐       ┌────────────────────────┐  │
│  │  Kiosk Touchscreen    │       │  FastAPI Backend Server│  │
│  │  - Fullscreen ATM UI  │◄─────►│  - Staging Engine      │  │
│  │  - Virtual Keypad     │       │  - SQLite (Jobs/Health)│  │
│  │  - Health Monitors    │       │  - Mock Paystack MoMo  │  │
│  └───────────────────────┘       └───────────┬────────────┘  │
│                                              │               │
│                                  ┌───────────▼────────────┐  │
│                                  │  OS Print Subsystem    │  │
│                                  │  (Windows / CUPS /     │  │
│                                  │   Mock Spooler)        │  │
│                                  └───────────┬────────────┘  │
└──────────────────────────────────────────────┼───────────────┘
                                               │ USB Spool
                                               ▼
                                  ┌─────────────────────────┐
                                  │ Canon Laser Printer     │
                                  └─────────────────────────┘
```

---

## 📁 Project Structure

```
PrintOS/
├── backend/
│   ├── app.py              # FastAPI server (Endpoints, CORS, static mounts)
│   ├── database.py         # SQLite schema & helpers (Jobs & Kiosk state)
│   ├── printer.py          # OS print abstraction (Windows win32/registry, POSIX cups, Mock mode)
│   └── test_pipeline.py    # Automated end-to-end integration test suite
├── kiosk_ui/               # Kiosk Touchscreen Interface
│   ├── index.html          # Fullscreen ATM-style touch layout
│   ├── kiosk.css           # High-contrast, tactile UI styling
│   └── kiosk.js            # Virtual on-screen numpad, lookup, & print pipeline
├── pwa/                    # Customer Smartphone Interface
│   ├── index.html          # Responsive mobile web app
│   ├── pwa.css             # Modern dark glassmorphic styling
│   └── pwa.js              # Client-side page detection & dynamic price calculator
├── storage/                # Scratch directory for PDF buffer & SQLite DB
├── requirements.txt        # Python backend dependencies
└── run.py                  # One-click launcher script
```

---

## 🚀 Quick Start Guide

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Launch the System
```bash
python run.py
```

Console will display:
- **Kiosk Terminal Screen:** `http://localhost:8000/kiosk`
- **Customer Phone PWA:** `http://<your-local-ip>:8000/pwa`
- **Walk-in Direct Upload:** `http://<your-local-ip>:8000/upload`
- **System Launch Portal:** `http://localhost:8000/`

---

## 🧪 Testing the Complete Workflow

### Flow A: Remote Staging via Smartphone PWA
1. Open `http://localhost:8000/pwa` on your browser (or open `http://<local-ip>:8000/pwa` on a phone on the same Wi-Fi).
2. Upload a PDF document (e.g. `storage/sample_assignment.pdf`).
3. Select your settings:
   - **Copies:** 1 or more.
   - **Color:** Black & White (GH₵ 0.50/sheet) vs Full Color (GH₵ 1.00/sheet).
   - **Layout:** Single-sided (SIMPLEX) vs Double-sided (DUPLEX — cuts sheets in half).
4. Tap **[Generate 6-Digit Pickup Code]**.
5. Note the generated 6-digit code (e.g. `863-060`).

### Flow B: Kiosk Touchscreen Collection & Release
1. Open `http://localhost:8000/kiosk` on the screen.
2. Tap **[Collect Staged Job]**.
3. Use the on-screen tactile virtual numeric keypad to type the 6 digits.
4. The system validates the code and performs an instant **Hardware Pre-flight Check**:
   - Paper sheets available $\ge$ sheets needed.
   - Printer online / spooler ready.
   - Disk scratch buffer $> 50\text{ MB}$.
5. Confirm price and tap **[Pay with MoMo & Print]**.
6. Watch the real-time execution pipeline:
   - Mobile Money USSD prompt dispatched to phone.
   - Payment confirmed & job transitioned to `PAID`.
   - Spooled to printer subsystem.
   - Physical paper counter decremented.
   - Privacy auto-shredding deletes the temporary PDF payload.
   - Collect pages from the collection tray!

### Flow C: Walk-In Local Wi-Fi Direct Upload
1. From the Kiosk home screen, tap **[Local Wi-Fi Upload]**.
2. Scan the dynamic QR code on screen with a smartphone camera.
3. Upload document directly over local LAN without consuming external mobile data.

### Flow D: USB Flash Drive Direct Printing
1. Tap **[USB Drive Printing]** on the Kiosk screen.
2. If no USB is detected, the kiosk displays a real-time prompt requesting USB insertion.
3. As soon as a flash drive is plugged into the kiosk, the system detects it automatically and opens its directory structure.
4. Browse files, select any PDF document, and tap **[Select to Print]**.
5. Configure color/B&W, verify pre-flight hardware checks, and release your print via MoMo.

---

## 🔒 Security & Privacy Guarantees
- **Atomic Document Auto-Shredding:** Uploaded PDF buffers in `storage/` are securely overwritten with zero bytes and unlinked immediately after spooling is handed to the printer.
- **PIN-Free Architecture:** The kiosk never requests, stores, or handles Mobile Money PINs. All authorization happens via telecom USSD prompts on the customer's personal device.
- **USB Sandbox Isolation:** Drive browsing restricts file operations strictly within the selected removable volume boundaries.
