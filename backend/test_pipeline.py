import sys
from pathlib import Path

# Add backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = BASE_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from fastapi.testclient import TestClient
from app import app
import database

client = TestClient(app)

def run_tests():
    print("=" * 65)
    print("[TEST] PrintOS V1 End-to-End Pipeline Integration Test")
    print("=" * 65)

    # 1. Health & Kiosk Status
    print("\n[Step 1] Checking Kiosk Telemetry & Status...")
    status_resp = client.get("/api/kiosk/status")
    assert status_resp.status_code == 200, f"Status failed: {status_resp.text}"
    status_data = status_resp.json()
    print(f"  ✓ Kiosk: {status_data['kiosk_name']}")
    print(f"  ✓ Initial Paper: {status_data['paper_sheets_remaining']} sheets")
    print(f"  ✓ Printer: {status_data['printer']['printer_name']}")
    print(f"  ✓ Local IP: {status_data['local_ip']}")

    # 2. Stage Print Job
    print("\n[Step 2] Staging Print Job from Customer PWA...")
    sample_pdf = BASE_DIR / "storage" / "sample_assignment.pdf"
    assert sample_pdf.exists(), "Sample PDF not found!"

    with open(sample_pdf, "rb") as f:
        stage_resp = client.post(
            "/api/jobs/stage",
            files={"file": ("semester_assignment.pdf", f, "application/pdf")},
            data={
                "pages": 4,
                "copies": 2,
                "color": "BW",
                "duplex": "DUPLEX",
                "phone": "0241234567"
            }
        )

    assert stage_resp.status_code == 200, f"Staging failed: {stage_resp.text}"
    stage_data = stage_resp.json()
    job_id = stage_data["job_id"]
    code = stage_data["pickup_code"]
    formatted_code = stage_data["formatted_code"]
    sheets = stage_data["sheet_count"]
    price = stage_data["total_price"]

    print(f"  ✓ Job ID: {job_id}")
    print(f"  ✓ Pickup Code Generated: {formatted_code} (raw: {code})")
    print(f"  ✓ Pages: {stage_data['page_count']} | Physical Sheets: {sheets} (Duplex ceil(4/2)*2 = 4 sheets)")
    print(f"  ✓ Calculated Price: GH₵ {price:.2f} (@ GH₵ {stage_data['rate_per_sheet']:.2f}/sheet)")
    assert sheets == 4, f"Expected 4 sheets, got {sheets}"
    assert price == 2.0, f"Expected GH₵ 2.00, got {price}"

    # 3. Kiosk Code Lookup & Pre-Flight Check
    print("\n[Step 3] Entering Code on Kiosk Touchscreen Keypad...")
    lookup_resp = client.get(f"/api/jobs/lookup/{code}")
    assert lookup_resp.status_code == 200, f"Lookup failed: {lookup_resp.text}"
    lookup_data = lookup_resp.json()
    print(f"  ✓ Kiosk verified job: '{lookup_data['job']['file_name']}'")
    print(f"  ✓ Pre-flight Hardware Verification: {lookup_data['preflight']['can_print']}")
    print(f"  ✓ Pre-flight Paper Available: {lookup_data['preflight']['paper_available']} sheets (Needed: {sheets})")
    print(f"  ✓ Pre-flight Printer Online: {lookup_data['preflight']['printer_online']}")
    assert lookup_data["preflight"]["can_print"] is True

    # 4. Trigger Pay & Print Pipeline
    print("\n[Step 4] Executing Pay & Print Release Flow...")
    initial_paper = lookup_data["preflight"]["paper_available"]
    pay_resp = client.post(
        f"/api/jobs/{job_id}/pay",
        json={"phone_number": "0241234567", "network": "MTN"}
    )
    assert pay_resp.status_code == 200, f"Pay failed: {pay_resp.text}"
    pay_data = pay_resp.json()
    print(f"  ✓ Paystack Reference: {pay_data['paystack_reference']}")
    print(f"  ✓ Sheets Spooled: {pay_data['sheets_printed']}")
    print(f"  ✓ Updated Kiosk Paper: {pay_data['paper_sheets_remaining']} sheets")
    print(f"  ✓ Confirmation Message: {pay_data['message']}")
    assert pay_data["paper_sheets_remaining"] == initial_paper - sheets

    # 5. Verify Security Document Shredding
    print("\n[Step 5] Verifying Atomic Document Disposal (Privacy Auto-Shredding)...")
    staged_file_path = Path(lookup_data["job"]["file_path"])
    print(f"  ✓ Checking if temporary file was unlinked: {staged_file_path.name}")
    assert not staged_file_path.exists(), "Security flaw: temporary PDF was not shred/deleted after print!"
    print("  ✓ PASSED: Temporary print payload has been destroyed.")

    # 6. Verify Code Expiration / Single Use
    print("\n[Step 6] Verifying Pickup Code is Single-Use...")
    relookup = client.get(f"/api/jobs/lookup/{code}")
    assert relookup.status_code == 400
    print(f"  ✓ PASSED: Re-using code rejected with: '{relookup.json()['detail']}'")

    print("\n" + "=" * 65)
    print("[SUCCESS] ALL PRINTOS V1 INTEGRATION TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 65)

if __name__ == "__main__":
    run_tests()
