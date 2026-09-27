import sqlite3
import datetime
from pathlib import Path
from typing import Optional, Dict, Any

BASE_DIR = Path(__file__).resolve().parent.parent
STORAGE_DIR = BASE_DIR / "storage"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = STORAGE_DIR / "printos.db"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    # Kiosk state table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS kiosk_state (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL DEFAULT 'PrintOS Kiosk #01 (Library Walkway)',
        paper_sheets_remaining INTEGER DEFAULT 500,
        paper_capacity INTEGER DEFAULT 500,
        is_online INTEGER DEFAULT 1,
        toner_level_pct INTEGER DEFAULT 95,
        toner_ok INTEGER DEFAULT 1,
        last_ping TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Print jobs table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        pickup_code TEXT UNIQUE NOT NULL,
        file_path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_size_bytes INTEGER NOT NULL,
        page_count INTEGER NOT NULL,
        sheet_count INTEGER NOT NULL,
        copies INTEGER DEFAULT 1,
        color_mode TEXT DEFAULT 'BW',
        duplex_mode TEXT DEFAULT 'SIMPLEX',
        total_price REAL NOT NULL,
        phone_number TEXT,
        status TEXT DEFAULT 'STAGED',
        paystack_reference TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Seed initial kiosk state if not present
    cursor.execute("SELECT COUNT(*) FROM kiosk_state")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
        INSERT INTO kiosk_state (id, name, paper_sheets_remaining, paper_capacity, is_online, toner_level_pct, toner_ok, last_ping)
        VALUES ('kiosk-01', 'PrintOS Kiosk #01 (Library Walkway)', 500, 500, 1, 95, 1, datetime('now'))
        """)

    conn.commit()
    conn.close()


def create_job(data: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()
    cursor.execute("""
    INSERT INTO jobs (
        id, pickup_code, file_path, file_name, file_size_bytes,
        page_count, sheet_count, copies, color_mode, duplex_mode,
        total_price, phone_number, status, paystack_reference, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data["id"],
        data["pickup_code"],
        data["file_path"],
        data["file_name"],
        data["file_size_bytes"],
        data["page_count"],
        data["sheet_count"],
        data.get("copies", 1),
        data.get("color_mode", "BW"),
        data.get("duplex_mode", "SIMPLEX"),
        data["total_price"],
        data.get("phone_number", ""),
        data.get("status", "STAGED"),
        data.get("paystack_reference", None),
        now_str,
        now_str
    ))
    conn.commit()
    conn.close()
    return get_job_by_id(data["id"])


def get_job_by_id(job_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def get_job_by_code(pickup_code: str) -> Optional[Dict[str, Any]]:
    # Normalize code (strip whitespace and hyphens)
    clean_code = pickup_code.replace("-", "").replace(" ", "").strip()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM jobs WHERE pickup_code = ?", (clean_code,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def update_job_status(job_id: str, status: str, paystack_ref: Optional[str] = None) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()
    if paystack_ref is not None:
        cursor.execute(
            "UPDATE jobs SET status = ?, paystack_reference = ?, updated_at = ? WHERE id = ?",
            (status, paystack_ref, now_str, job_id)
        )
    else:
        cursor.execute(
            "UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?",
            (status, now_str, job_id)
        )
    affected = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return affected


def get_kiosk_state(kiosk_id: str = "kiosk-01") -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM kiosk_state WHERE id = ?", (kiosk_id,))
    row = cursor.fetchone()
    if not row:
        init_db()
        cursor.execute("SELECT * FROM kiosk_state WHERE id = ?", (kiosk_id,))
        row = cursor.fetchone()
    conn.close()
    return dict(row) if row else {}


def decrement_paper(sheets: int, kiosk_id: str = "kiosk-01") -> int:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE kiosk_state SET paper_sheets_remaining = MAX(0, paper_sheets_remaining - ?), last_ping = datetime('now') WHERE id = ?",
        (sheets, kiosk_id)
    )
    conn.commit()
    cursor.execute("SELECT paper_sheets_remaining FROM kiosk_state WHERE id = ?", (kiosk_id,))
    rem = cursor.fetchone()[0]
    conn.close()
    return rem


def restock_paper(sheets: int = 500, kiosk_id: str = "kiosk-01") -> int:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE kiosk_state SET paper_sheets_remaining = ?, paper_capacity = ?, last_ping = datetime('now') WHERE id = ?",
        (sheets, max(500, sheets), kiosk_id)
    )
    conn.commit()
    conn.close()
    return sheets


def update_kiosk_health(
    kiosk_id: str = "kiosk-01",
    is_online: Optional[int] = None,
    toner_level_pct: Optional[int] = None,
    paper_sheets_remaining: Optional[int] = None
) -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    updates = ["last_ping = datetime('now')"]
    params = []

    if is_online is not None:
        updates.append("is_online = ?")
        params.append(is_online)
    if toner_level_pct is not None:
        updates.append("toner_level_pct = ?")
        updates.append("toner_ok = ?")
        params.append(toner_level_pct)
        params.append(1 if toner_level_pct > 10 else 0)
    if paper_sheets_remaining is not None:
        updates.append("paper_sheets_remaining = ?")
        params.append(paper_sheets_remaining)

    params.append(kiosk_id)
    sql = f"UPDATE kiosk_state SET {', '.join(updates)} WHERE id = ?"
    cursor.execute(sql, params)
    conn.commit()
    conn.close()
    return get_kiosk_state(kiosk_id)


# Auto-initialize when module is loaded
init_db()
