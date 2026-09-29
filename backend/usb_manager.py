import os
import sys
import ctypes
import shutil
import platform
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional

logger = logging.getLogger("PrintOS.USBManager")

def get_removable_drives() -> List[Dict[str, Any]]:
    """
    Detects removable USB storage drives connected to the system.
    """
    drives = []
    system = platform.system()

    if system == "Windows":
        kernel32 = ctypes.windll.kernel32
        volumeNameBuffer = ctypes.create_unicode_buffer(1024)
        fileSystemNameBuffer = ctypes.create_unicode_buffer(1024)

        # Scan drive letters D through Z
        for letter in "DEFGHIJKLMNOPQRSTUVWXYZ":
            root = f"{letter}:\\"
            dtype = kernel32.GetDriveTypeW(root)
            # 2 = DRIVE_REMOVABLE
            if dtype == 2:
                label = "USB Flash Drive"
                try:
                    res = kernel32.GetVolumeInformationW(
                        root, volumeNameBuffer, 1024, None, None, None, fileSystemNameBuffer, 1024
                    )
                    if res and volumeNameBuffer.value:
                        label = volumeNameBuffer.value
                except Exception:
                    pass

                # Check if drive is currently accessible (has media inserted)
                is_accessible = False
                total_bytes = 0
                free_bytes = 0
                try:
                    usage = shutil.disk_usage(root)
                    total_bytes = usage.total
                    free_bytes = usage.free
                    is_accessible = True
                except Exception:
                    is_accessible = False

                if is_accessible:
                    drives.append({
                        "letter": f"{letter}:",
                        "path": root,
                        "label": label,
                        "total_gb": round(total_bytes / (1024**3), 2),
                        "free_gb": round(free_bytes / (1024**3), 2),
                        "is_inserted": True
                    })
    elif system == "Darwin":
        # macOS USB mount points under /Volumes
        volumes_dir = Path("/Volumes")
        if volumes_dir.exists():
            for p in volumes_dir.iterdir():
                if p.is_dir() and p.name != "Macintosh HD":
                    drives.append({
                        "letter": p.name,
                        "path": str(p),
                        "label": p.name,
                        "is_inserted": True
                    })
    else:
        # Linux mount points under /media or /run/media
        for base in ["/media", "/run/media"]:
            base_path = Path(base)
            if base_path.exists():
                for user_dir in base_path.iterdir():
                    if user_dir.is_dir():
                        for drive_dir in user_dir.iterdir():
                            if drive_dir.is_dir():
                                drives.append({
                                    "letter": drive_dir.name,
                                    "path": str(drive_dir),
                                    "label": drive_dir.name,
                                    "is_inserted": True
                                })

    # If no physical drives detected, provide virtual simulated drive for kiosk testing
    sim_dir = Path(__file__).resolve().parent.parent / "storage" / "simulated_usb"
    sim_dir.mkdir(parents=True, exist_ok=True)
    sample_src = Path(__file__).resolve().parent.parent / "storage" / "sample_assignment.pdf"
    if sample_src.exists():
        dest = sim_dir / "Bio101_Lecture_Notes.pdf"
        if not dest.exists():
            try:
                shutil.copy2(str(sample_src), str(dest))
            except Exception:
                pass
        dest2 = sim_dir / "CS302_Term_Project_Final.pdf"
        if not dest2.exists():
            try:
                shutil.copy2(str(sample_src), str(dest2))
            except Exception:
                pass

    if not drives:
        drives.append({
            "letter": "USB (Virtual):",
            "path": str(sim_dir),
            "label": "SanDisk 32GB (Simulated)",
            "total_gb": 32.0,
            "free_gb": 28.4,
            "is_inserted": True,
            "is_simulated": True
        })

    return drives


def count_pdf_pages(file_path: Path) -> int:
    """Extracts actual page count from PDF using pypdf or byte scan."""
    try:
        from pypdf import PdfReader
        reader = PdfReader(str(file_path))
        return len(reader.pages)
    except Exception:
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


def count_docx_pages(file_path: Path) -> int:
    """Estimates or extracts page count from docx metadata or word count."""
    try:
        import zipfile
        import xml.etree.ElementTree as ET
        with zipfile.ZipFile(str(file_path)) as z:
            for name in z.namelist():
                if name.endswith("app.xml"):
                    tree = ET.fromstring(z.read(name))
                    for elem in tree.iter():
                        if elem.tag.endswith("Pages") and elem.text and elem.text.isdigit():
                            pages = int(elem.text)
                            if pages > 0:
                                return pages
    except Exception:
        pass

    # Fallback: estimate from paragraph & word count via python-docx
    try:
        import docx
        doc = docx.Document(str(file_path))
        total_words = sum(len(p.text.split()) for p in doc.paragraphs)
        # Average academic/formal paper has ~400-500 words per page
        est = max(1, math.ceil(total_words / 450))
        return est
    except Exception:
        pass

    return 1


def list_drive_files(drive_path: str, subfolder: str = "") -> Dict[str, Any]:
    """
    Safely lists printable documents (PDF, DOCX, DOC) and folders inside the USB drive.
    Includes page count for printable documents.
    """
    base = Path(drive_path).resolve()
    target = (base / subfolder).resolve()

    # Prevent escaping the drive boundary
    try:
        target.relative_to(base)
    except ValueError:
        target = base

    if not target.exists() or not target.is_dir():
        return {"error": "Invalid USB path", "folders": [], "files": []}

    folders = []
    files = []

    try:
        for entry in os.scandir(str(target)):
            name = entry.name
            # Skip hidden / system folders
            if name.startswith(".") or name.startswith("$") or name in ("System Volume Information", "RECYCLE.BIN"):
                continue

            if entry.is_dir():
                folders.append({
                    "name": name,
                    "rel_path": str(Path(subfolder) / name).replace("\\", "/")
                })
            elif entry.is_file():
                ext = name.lower().split(".")[-1] if "." in name else ""
                is_pdf = (ext == "pdf")
                is_docx = (ext in ("docx", "doc"))
                is_printable = is_pdf or is_docx
                size = 0
                page_count = 0
                try:
                    size = entry.stat().st_size
                    if is_pdf:
                        page_count = count_pdf_pages(Path(entry.path))
                    elif is_docx:
                        page_count = count_docx_pages(Path(entry.path))
                except Exception:
                    pass

                files.append({
                    "name": name,
                    "rel_path": str(Path(subfolder) / name).replace("\\", "/"),
                    "size_bytes": size,
                    "size_formatted": format_bytes(size),
                    "is_pdf": is_pdf,
                    "is_docx": is_docx,
                    "is_printable": is_printable,
                    "page_count": max(1, page_count) if is_printable else 0,
                    "extension": ext.upper()
                })
    except Exception as e:
        logger.error(f"Error reading USB files: {e}")
        return {"error": str(e), "folders": [], "files": []}

    # Sort: Printable documents first, then alphabetically
    files.sort(key=lambda x: (not x["is_printable"], x["name"].lower()))
    folders.sort(key=lambda x: x["name"].lower())

    return {
        "current_path": subfolder,
        "parent_path": str(Path(subfolder).parent).replace("\\", "/") if subfolder else None,
        "folders": folders,
        "files": files
    }


def format_bytes(b: int) -> str:
    if b < 1024:
        return f"{b} B"
    elif b < 1024 * 1024:
        return f"{b / 1024:.1f} KB"
    else:
        return f"{b / (1024 * 1024):.1f} MB"

