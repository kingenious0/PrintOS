import os
import sys
import uuid
import math
import random
import shutil
import socket
import logging
from pathlib import Path
from typing import Optional

BASE_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import database
import printer
import usb_manager

# Set up logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] [SERVER] %(message)s")
logger = logging.getLogger("PrintOS.Server")
STORAGE_DIR = BASE_DIR / "storage"
KIOSK_DIR = BASE_DIR / "kiosk_ui"
PWA_DIR = BASE_DIR / "pwa"

STORAGE_DIR.mkdir(parents=True, exist_ok=True)
database.init_db()

app = FastAPI(
    title="PrintOS V1 - Kiosk & Staging Backend",
    description="Autonomous self-service printing kiosk local laboratory server.",
    version="1.0.0"
)

# Enable CORS for local network and mobile testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_local_ip() -> str:
    """Finds the local LAN IP address of this machine for mobile device access."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip


def generate_unique_code() -> str:
    """Generates an unambiguous 6-digit numeric pickup code."""
    for _ in range(100):
        code = f"{random.randint(100000, 999999)}"
        existing = database.get_job_by_code(code)
        if not existing:
            return code
    return f"{random.randint(100000, 999999)}"


def count_pdf_pages(file_path: Path) -> int:
    """Extracts actual page count from uploaded PDF using pypdf or byte scan."""
    try:
        from pypdf import PdfReader
        reader = PdfReader(str(file_path))
        return len(reader.pages)
    except Exception as e:
        logger.warning(f"Could not read PDF with pypdf: {e}. Fallback to byte scan.")
        try:
            with open(file_path, "rb") as f:
                content = f.read()
            import re
            matches = re.findall(rb"/Type\s*/Page\b", content)
            if matches:
                return len(matches)
        except Exception:
            pass
    return 1


# --- API Routes ---

@app.get("/api/kiosk/status")
async def get_kiosk_status():
    """Returns kiosk paper, toner, printer health, and network connectivity."""
    state = database.get_kiosk_state()
    printer_health = printer.check_printer_health()
    local_ip = get_local_ip()

    # Pre-flight disk space check (at least 50MB)
    stat = shutil.disk_usage(str(STORAGE_DIR))
    disk_free_mb = round(stat.free / (1024 * 1024), 2)
    disk_ok = disk_free_mb >= 50.0

    # Low paper threshold warning (<= 15% of 500 = 75 sheets)
    remaining_sheets = state.get("paper_sheets_remaining", 500)
    capacity = state.get("paper_capacity", 500)
    paper_pct = round((remaining_sheets / max(1, capacity)) * 100)
    is_low_paper = remaining_sheets <= 75

    return {
        "kiosk_id": state.get("id", "kiosk-01"),
        "kiosk_name": state.get("name", "PrintOS Kiosk #01"),
        "is_online": bool(state.get("is_online", 1)),
        "paper_sheets_remaining": remaining_sheets,
        "paper_capacity": capacity,
        "paper_percentage": paper_pct,
        "is_low_paper": is_low_paper,
        "toner_level_pct": state.get("toner_level_pct", 95),
        "toner_ok": bool(state.get("toner_ok", 1)),
        "disk_free_mb": disk_free_mb,
        "disk_ok": disk_ok,
        "printer": printer_health,
        "mock_mode": printer.is_mock_mode(),
        "local_ip": local_ip,
        "pwa_url": f"http://{local_ip}:8000/pwa",
        "kiosk_url": f"http://{local_ip}:8000/kiosk"
    }


@app.post("/api/kiosk/restock")
async def restock_kiosk(sheets: int = 500):
    """Restocks kiosk paper supply to full capacity."""
    new_count = database.restock_paper(sheets)
    return {"message": "Paper restocked successfully", "paper_sheets_remaining": new_count}


@app.post("/api/kiosk/toggle-mock")
async def toggle_mock_mode(enabled: Optional[bool] = None):
    """Toggles or sets the printer mock mode."""
    if enabled is None:
        new_mode = not printer.is_mock_mode()
    else:
        new_mode = enabled
    printer.set_mock_mode(new_mode)
    return {"mock_mode": printer.is_mock_mode()}


# --- USB Flash Drive Endpoints ---

@app.get("/api/usb/drives")
async def get_usb_drives():
    """Detects connected removable USB flash drives."""
    drives = usb_manager.get_removable_drives()
    return {
        "inserted": len(drives) > 0,
        "count": len(drives),
        "drives": drives
    }


@app.get("/api/usb/browse")
async def browse_usb_drive(drive: str, folder: str = ""):
    """Lists files and folders on a specific USB drive."""
    res = usb_manager.list_drive_files(drive, folder)
    if "error" in res and res["error"] != "Invalid USB path":
        raise HTTPException(status_code=400, detail=res["error"])
    return {
        "drive": drive,
        **res
    }


@app.get("/api/usb/inspect-file")
async def inspect_usb_file(drive: str, rel_path: str):
    """
    Inspects a printable document (PDF or DOCX) on the USB drive to return detected page count,
    file size, and pricing unit rates prior to staging.
    """
    source_path = Path(drive).resolve() / rel_path
    if not source_path.exists() or not source_path.is_file():
        raise HTTPException(status_code=404, detail="File not found on USB drive.")

    file_size = source_path.stat().st_size
    ext = source_path.suffix.lower()
    if ext == ".pdf":
        detected_pages = count_pdf_pages(source_path)
    elif ext in (".docx", ".doc"):
        detected_pages = usb_manager.count_docx_pages(source_path)
    else:
        detected_pages = 1
    page_count = detected_pages if detected_pages > 0 else 1

    return {
        "file_name": source_path.name,
        "rel_path": rel_path,
        "drive": drive,
        "file_size_bytes": file_size,
        "size_formatted": usb_manager.format_bytes(file_size),
        "page_count": page_count,
        "is_docx": ext in (".docx", ".doc"),
        "rates": {
            "BW": 0.50,
            "COLOR": 1.00
        }
    }


class USBStageRequest(BaseModel):
    drive: str
    rel_path: str
    copies: int = 1
    color: str = "BW"
    duplex: str = "SIMPLEX"
    phone: str = ""


@app.post("/api/usb/stage-file")
async def stage_usb_file(payload: USBStageRequest):
    """
    Direct USB Staging:
    Copies document directly from physical flash drive into kiosk scratch buffer,
    counts pages (PDF or DOCX), and generates a staged job for immediate release.
    """
    source_path = Path(payload.drive).resolve() / payload.rel_path
    if not source_path.exists() or not source_path.is_file():
        raise HTTPException(status_code=404, detail="File not found on USB drive.")

    job_id = str(uuid.uuid4())
    filename = source_path.name
    clean_filename = f"{job_id[:8]}_{filename}"
    saved_path = STORAGE_DIR / clean_filename

    # Copy binary from USB to kiosk storage
    try:
        shutil.copy2(str(source_path), str(saved_path))
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Failed to copy file from USB: {str(err)}")

    file_size = saved_path.stat().st_size
    ext = saved_path.suffix.lower()
    if ext == ".pdf":
        detected_pages = count_pdf_pages(saved_path)
    elif ext in (".docx", ".doc"):
        detected_pages = usb_manager.count_docx_pages(saved_path)
    else:
        detected_pages = 1
    page_count = detected_pages if detected_pages > 0 else 1

    copies = max(1, payload.copies)
    color = "COLOR" if payload.color.upper() in ("COLOR", "COLOUR") else "BW"
    duplex = "DUPLEX" if payload.duplex.upper() == "DUPLEX" else "SIMPLEX"

    if duplex == "DUPLEX":
        sheets_per_copy = math.ceil(page_count / 2)
    else:
        sheets_per_copy = page_count
    sheet_count = sheets_per_copy * copies

    rate_per_sheet = 1.00 if color == "COLOR" else 0.50
    total_price = round(sheet_count * rate_per_sheet, 2)

    pickup_code = generate_unique_code()
    formatted_code = f"{pickup_code[:3]}-{pickup_code[3:]}"

    job_data = {
        "id": job_id,
        "pickup_code": pickup_code,
        "file_path": str(saved_path),
        "file_name": filename,
        "file_size_bytes": file_size,
        "page_count": page_count,
        "sheet_count": sheet_count,
        "copies": copies,
        "color_mode": color,
        "duplex_mode": duplex,
        "total_price": total_price,
        "phone_number": payload.phone,
        "status": "STAGED",
        "paystack_reference": None
    }

    created = database.create_job(job_data)
    logger.info(f"USB File Staged: {filename} from {payload.drive}, Code={formatted_code}")

    return {
        "status": "STAGED",
        "job_id": job_id,
        "pickup_code": pickup_code,
        "formatted_code": formatted_code,
        "file_name": filename,
        "page_count": page_count,
        "sheet_count": sheet_count,
        "total_price": total_price,
        "currency": "GHS"
    }


@app.post("/api/jobs/stage")
async def stage_print_job(
    file: UploadFile = File(...),
    pages: Optional[int] = Form(None),
    copies: int = Form(1),
    color: str = Form("BW"),
    duplex: str = Form("SIMPLEX"),
    phone: str = Form("")
):
    """
    Job Staging Engine:
    Receives document, counts pages, calculates required sheets & price, saves locally,
    generates 6-digit Pickup Code, and sets state to STAGED without charging.
    """
    if copies < 1:
        copies = 1
    color = "COLOR" if color.upper() in ("COLOR", "COLOUR") else "BW"
    duplex = "DUPLEX" if duplex.upper() == "DUPLEX" else "SIMPLEX"

    job_id = str(uuid.uuid4())
    filename = file.filename or "document.pdf"
    clean_filename = f"{job_id[:8]}_{filename}"
    saved_path = STORAGE_DIR / clean_filename

    # Save uploaded payload
    file_bytes = await file.read()
    with open(saved_path, "wb") as f:
        f.write(file_bytes)

    file_size = len(file_bytes)

    # Validate actual page count
    ext = saved_path.suffix.lower()
    if ext == ".pdf":
        detected_pages = count_pdf_pages(saved_path)
    elif ext in (".docx", ".doc"):
        detected_pages = usb_manager.count_docx_pages(saved_path)
    else:
        detected_pages = 1
    page_count = detected_pages if detected_pages > 0 else (pages or 1)

    # Compute sheet count:
    # Single-sided: 1 sheet per page * copies
    # Duplex: ceil(pages / 2) * copies
    if duplex == "DUPLEX":
        sheets_per_copy = math.ceil(page_count / 2)
    else:
        sheets_per_copy = page_count

    sheet_count = sheets_per_copy * copies

    # Pricing logic (Approach C):
    # GH₵0.50 per sheet for BW, GH₵1.00 per sheet for Color
    rate_per_sheet = 1.00 if color == "COLOR" else 0.50
    total_price = round(sheet_count * rate_per_sheet, 2)

    pickup_code = generate_unique_code()
    formatted_code = f"{pickup_code[:3]}-{pickup_code[3:]}"

    job_data = {
        "id": job_id,
        "pickup_code": pickup_code,
        "file_path": str(saved_path),
        "file_name": filename,
        "file_size_bytes": file_size,
        "page_count": page_count,
        "sheet_count": sheet_count,
        "copies": copies,
        "color_mode": color,
        "duplex_mode": duplex,
        "total_price": total_price,
        "phone_number": phone,
        "status": "STAGED",
        "paystack_reference": None
    }

    created = database.create_job(job_data)

    logger.info(
        f"New Job Staged: ID={job_id}, Code={formatted_code}, Pages={page_count}, "
        f"Sheets={sheet_count}, Price=GH₵{total_price:.2f}"
    )

    return {
        "status": "STAGED",
        "job_id": job_id,
        "pickup_code": pickup_code,
        "formatted_code": formatted_code,
        "file_name": filename,
        "page_count": page_count,
        "sheet_count": sheet_count,
        "copies": copies,
        "color_mode": color,
        "duplex_mode": duplex,
        "rate_per_sheet": rate_per_sheet,
        "total_price": total_price,
        "currency": "GHS",
        "customer_phone": phone
    }


@app.get("/api/jobs/lookup/{code}")
async def lookup_job(code: str):
    """
    Kiosk Job Lookup:
    Validates 6-digit code entered on touchscreen, verifies active status,
    and returns job parameters along with pre-flight availability.
    """
    job = database.get_job_by_code(code)
    if not job:
        raise HTTPException(status_code=404, detail="Invalid Pickup Code. Please check and try again.")

    if job["status"] == "COMPLETED":
        raise HTTPException(status_code=400, detail="This document has already been printed.")
    if job["status"] in ("CANCELLED", "EXPIRED"):
        raise HTTPException(status_code=400, detail=f"This job is {job['status'].lower()}.")

    # Pre-flight kiosk health check against this specific job
    kiosk_state = database.get_kiosk_state()
    paper_rem = kiosk_state.get("paper_sheets_remaining", 0)
    sheets_needed = job["sheet_count"]

    paper_ok = paper_rem >= sheets_needed
    printer_health = printer.check_printer_health()

    stat = shutil.disk_usage(str(STORAGE_DIR))
    disk_ok = (stat.free / (1024 * 1024)) >= 50.0

    preflight_ok = paper_ok and printer_health["online"] and disk_ok

    raw_code = job["pickup_code"]
    formatted_code = f"{raw_code[:3]}-{raw_code[3:]}" if len(raw_code) == 6 else raw_code

    return {
        "job": {
            **job,
            "formatted_code": formatted_code
        },
        "preflight": {
            "can_print": preflight_ok,
            "paper_available": paper_rem,
            "sheets_needed": sheets_needed,
            "paper_ok": paper_ok,
            "printer_online": printer_health["online"],
            "disk_ok": disk_ok,
            "printer_detail": printer_health.get("detail", "Ready")
        }
    }


class JobConfigureRequest(BaseModel):
    copies: int = 1
    color: str = "BW"
    duplex: str = "SIMPLEX"
    phone: Optional[str] = ""


@app.post("/api/jobs/{job_id}/configure")
async def configure_job(job_id: str, payload: JobConfigureRequest):
    """
    Updates print configuration parameters for a staged job:
    copies, color mode (BW vs COLOR), and duplex mode (SIMPLEX vs DUPLEX).
    Recalculates sheet count and total price in GHS.
    """
    job = database.get_job_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    if job["status"] != "STAGED":
        raise HTTPException(status_code=400, detail=f"Cannot reconfigure job with status '{job['status']}'.")

    page_count = job["page_count"]
    copies = max(1, payload.copies)
    color = "COLOR" if payload.color.upper() in ("COLOR", "COLOUR") else "BW"
    duplex = "DUPLEX" if payload.duplex.upper() == "DUPLEX" else "SIMPLEX"

    if duplex == "DUPLEX":
        sheets_per_copy = math.ceil(page_count / 2)
    else:
        sheets_per_copy = page_count
    sheet_count = sheets_per_copy * copies

    rate_per_sheet = 1.00 if color == "COLOR" else 0.50
    total_price = round(sheet_count * rate_per_sheet, 2)

    phone = payload.phone if payload.phone is not None else job.get("phone_number", "")

    database.update_job_config(
        job_id=job_id,
        copies=copies,
        color_mode=color,
        duplex_mode=duplex,
        sheet_count=sheet_count,
        total_price=total_price,
        phone_number=phone
    )

    updated_job = database.get_job_by_id(job_id)
    raw_code = updated_job["pickup_code"]
    formatted_code = f"{raw_code[:3]}-{raw_code[3:]}" if len(raw_code) == 6 else raw_code

    kiosk_state = database.get_kiosk_state()
    paper_rem = kiosk_state.get("paper_sheets_remaining", 0)
    paper_ok = paper_rem >= sheet_count
    printer_health = printer.check_printer_health()

    return {
        "status": "STAGED",
        "job": {
            **updated_job,
            "formatted_code": formatted_code
        },
        "preflight": {
            "can_print": paper_ok and printer_health["online"],
            "paper_available": paper_rem,
            "sheets_needed": sheet_count,
            "paper_ok": paper_ok,
            "printer_online": printer_health["online"],
            "printer_detail": printer_health.get("detail", "Ready")
        }
    }


@app.post("/api/jobs/{job_id}/cancel")
async def cancel_job_endpoint(job_id: str):
    """Cancels a staged job and cleans up temporary storage if not already printed."""
    job = database.get_job_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    if job["status"] == "COMPLETED":
        raise HTTPException(status_code=400, detail="Cannot cancel completed job.")

    database.cancel_job(job_id)
    if job.get("file_path"):
        try:
            printer.secure_cleanup(job["file_path"])
        except Exception:
            pass

    return {"success": True, "message": "Job cancelled and temporary file cleaned."}


class PayRequest(BaseModel):
    phone_number: Optional[str] = None
    network: Optional[str] = "MTN"


@app.post("/api/jobs/{job_id}/pay")
async def pay_and_print_job(job_id: str, payload: Optional[PayRequest] = None):
    """
    Execute Pre-Flight Check, Mock Paystack USSD Prompt, and Print Pipeline:
    1. Pre-flight check (Paper >= sheets, Printer ready, Disk space)
    2. Transition -> PAYMENT_PENDING
    3. Simulate Mobile Money USSD approval -> PAID
    4. Transition -> PRINTING
    5. Spool document to printer
    6. Decrement physical paper counter
    7. Atomic file shredding of temporary file
    8. Transition -> COMPLETED
    """
    job = database.get_job_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    if job["status"] == "COMPLETED":
        raise HTTPException(status_code=400, detail="Job already completed.")

    # 1. Pre-flight health check
    kiosk_state = database.get_kiosk_state()
    paper_rem = kiosk_state.get("paper_sheets_remaining", 0)
    sheets_needed = job["sheet_count"]

    if paper_rem < sheets_needed:
        database.update_job_status(job_id, "FAILED")
        raise HTTPException(
            status_code=400,
            detail=f"Pre-flight failed: Insufficient paper in kiosk ({paper_rem} sheets available, {sheets_needed} required). Maintenance has been notified."
        )

    printer_health = printer.check_printer_health()
    if not printer_health["online"]:
        database.update_job_status(job_id, "FAILED")
        raise HTTPException(
            status_code=400,
            detail="Pre-flight failed: Printer hardware is offline or spooler unavailable."
        )

    # 2. Transition to PAYMENT_PENDING
    database.update_job_status(job_id, "PAYMENT_PENDING")

    # 3. Simulate Paystack MoMo deduction
    mock_paystack_ref = f"pstk_{uuid.uuid4().hex[:12]}"
    phone = (payload.phone_number if payload and payload.phone_number else job.get("phone_number")) or "0240000000"
    logger.info(f"Paystack USSD Push dispatched to {phone} for GH₵{job['total_price']:.2f}. Ref: {mock_paystack_ref}")

    # Mark as PAID
    database.update_job_status(job_id, "PAID", paystack_ref=mock_paystack_ref)

    # 4. Transition to PRINTING
    database.update_job_status(job_id, "PRINTING")

    # 5. Dispatch print document
    try:
        print_result = printer.print_document(
            file_path=job["file_path"],
            copies=job["copies"],
            color_mode=job["color_mode"],
            duplex_mode=job["duplex_mode"],
            job_id=job_id
        )
    except Exception as print_err:
        logger.error(f"Printing failed: {print_err}")
        database.update_job_status(job_id, "FAILED")
        raise HTTPException(status_code=500, detail=f"Printing failed: {str(print_err)}")

    # 6. Decrement physical paper sheets
    new_paper_level = database.decrement_paper(sheets_needed)

    # 7. Atomic file shredding
    printer.secure_cleanup(job["file_path"])

    # 8. Mark COMPLETED
    database.update_job_status(job_id, "COMPLETED")

    logger.info(
        f"Job {job_id} COMPLETED. {sheets_needed} sheets printed. "
        f"Paper remaining: {new_paper_level}/500."
    )

    return {
        "success": True,
        "status": "COMPLETED",
        "message": "Payment verified and document successfully printed! Please collect your sheets below.",
        "job_id": job_id,
        "sheets_printed": sheets_needed,
        "paper_sheets_remaining": new_paper_level,
        "paystack_reference": mock_paystack_ref,
        "print_detail": print_result
    }


# Static Mounts
app.mount("/kiosk", StaticFiles(directory=str(KIOSK_DIR), html=True), name="kiosk")
app.mount("/pwa", StaticFiles(directory=str(PWA_DIR), html=True), name="pwa")
app.mount("/upload", StaticFiles(directory=str(PWA_DIR), html=True), name="upload")


@app.get("/")
async def root_portal(request: Request):
    """Default landing portal giving quick access to both Kiosk Touchscreen and Customer PWA."""
    local_ip = get_local_ip()
    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>PrintOS V1 - Commercial Kiosk & Staging Portal</title>
      <!-- Self-Hosted Offline Fonts (Zero CDN, 100% Offline-Proof) -->
      <link rel="stylesheet" href="/kiosk/fonts.css?v=1">
      <style>
        :root {{
          --kiosk-bg: #0D1115;
          --kiosk-card: #161D22;
          --kiosk-elevated: #1C232B;
          --kiosk-inner: #242B32;
          --border: rgba(255, 255, 255, 0.08);
          --border-strong: rgba(255, 255, 255, 0.16);
          --primary: #2563EB;
          --primary-hover: #1D4ED8;
          --cyan-accent: #0284C7;
          --emerald: #10B981;
          --text-primary: #EFEFF1;
          --text-secondary: #949599;
          --text-muted: #64748B;
        }}
        * {{ margin: 0; padding: 0; box-sizing: border-box; font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif; }}
        body {{
          background-color: var(--kiosk-bg);
          background: radial-gradient(circle at 50% 0%, #161D22 0%, #0D1115 75%);
          color: var(--text-primary);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }}
        .portal-container {{
          max-width: 920px;
          width: 100%;
          background: var(--kiosk-card);
          border: 1px solid var(--border);
          border-radius: 28px;
          padding: 48px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7);
        }}
        .header {{ text-align: center; margin-bottom: 40px; }}
        .badge {{
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 18px;
          background: rgba(37, 99, 235, 0.15);
          border: 1px solid rgba(37, 99, 235, 0.35);
          border-radius: 100px;
          color: #60A5FA;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          margin-bottom: 16px;
        }}
        .badge .dot {{
          width: 8px;
          height: 8px;
          background: var(--emerald);
          border-radius: 50%;
          box-shadow: 0 0 10px var(--emerald);
        }}
        h1 {{ font-size: 42px; font-weight: 800; letter-spacing: -1px; margin-bottom: 12px; color: var(--text-primary); }}
        h1 span {{ color: var(--primary); text-shadow: 0 0 20px rgba(37, 99, 235, 0.4); }}
        p.subtitle {{ color: var(--text-secondary); font-size: 16px; max-width: 600px; margin: 0 auto; line-height: 1.6; }}
        .grid {{
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 24px;
          margin-top: 36px;
        }}
        .portal-card {{
          background: var(--kiosk-elevated);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 32px;
          text-decoration: none;
          color: inherit;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
        }}
        .portal-card:hover {{
          transform: translateY(-3px);
          background: var(--kiosk-inner);
          border-color: rgba(37, 99, 235, 0.5);
          box-shadow: 0 12px 30px rgba(37, 99, 235, 0.25);
        }}
        .card-icon {{
          width: 58px;
          height: 58px;
          border-radius: 16px;
          background: rgba(37, 99, 235, 0.15);
          border: 1px solid rgba(37, 99, 235, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          margin-bottom: 20px;
        }}
        .card-title {{ font-size: 22px; font-weight: 800; margin-bottom: 8px; color: var(--text-primary); }}
        .card-desc {{ color: var(--text-secondary); font-size: 14px; line-height: 1.6; margin-bottom: 24px; }}
        .card-btn {{
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 800;
          font-size: 15px;
          color: #60A5FA;
        }}
        .info-bar {{
          margin-top: 36px;
          padding: 16px 24px;
          background: var(--kiosk-elevated);
          border-radius: 16px;
          border: 1px solid var(--border);
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
          color: var(--text-secondary);
        }}
        .info-item {{ display: flex; align-items: center; gap: 8px; }}
        .info-item code {{
          font-family: 'JetBrains Mono', monospace;
          background: var(--kiosk-inner);
          border: 1px solid var(--border);
          padding: 4px 10px;
          border-radius: 6px;
          color: #60A5FA;
          font-weight: 700;
        }}
      </style>
    </head>
    <body>
      <div class="portal-container">
        <div class="header">
          <div class="badge"><span class="dot"></span> Commercial Kiosk Lab Active</div>
          <h1>Print<span>OS</span> V1</h1>
          <p class="subtitle">Autonomous, unattended self-service printing kiosk system with anti-glare POS interface, 60s idle timeout, and Mobile Money release pipeline.</p>
        </div>

        <div class="grid">
          <!-- Kiosk Terminal Screen -->
          <a href="/kiosk" class="portal-card">
            <div>
              <div class="card-icon">🖥️</div>
              <h2 class="card-title">Kiosk Touchscreen UI</h2>
              <p class="card-desc">High-contrast ATM-style touch interface with large numeric keypad, pre-flight hardware monitor, USB configuration drawer, and Paystack release flow.</p>
            </div>
            <div class="card-btn">Launch Kiosk Terminal &rarr;</div>
          </a>

          <!-- Customer Smartphone PWA -->
          <a href="/pwa" class="portal-card">
            <div>
              <div class="card-icon">📱</div>
              <h2 class="card-title">Customer Mobile PWA</h2>
              <p class="card-desc">Zero-cost remote staging interface. Instant client-side page detection, duplex toggles, live price calculation, and 6-digit Pickup Codes.</p>
            </div>
            <div class="card-btn">Open Customer PWA &rarr;</div>
          </a>
        </div>

        <div class="info-bar">
          <div class="info-item">
            <span>Local Wi-Fi IP:</span>
            <code>{local_ip}:8000</code>
          </div>
          <div class="info-item">
            <span>Station Status:</span>
            <code id="hw-status">Ready (Virtual Spooler Safe)</code>
          </div>
          <div class="info-item">
            <span>Walk-In Portal:</span>
            <code>http://{local_ip}:8000/upload</code>
          </div>
        </div>
      </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)


if __name__ == "__main__":
    import uvicorn
    local_ip = get_local_ip()
    print("=" * 65)
    print("🚀 PrintOS V1 Local Laboratory Server Starting")
    print(f"📡 Local Kiosk UI:     http://localhost:8000/kiosk")
    print(f"📱 Customer Phone PWA: http://{local_ip}:8000/pwa")
    print(f"📶 Walk-in Portal:    http://{local_ip}:8000/upload")
    print("=" * 65)
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
