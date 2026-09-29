import os
import urllib.request
import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
KIOSK_FONTS_DIR = BASE_DIR / "kiosk_ui" / "fonts"
PWA_FONTS_DIR = BASE_DIR / "pwa" / "fonts"
PWA_VENDOR_DIR = BASE_DIR / "pwa" / "vendor"

KIOSK_FONTS_DIR.mkdir(parents=True, exist_ok=True)
PWA_FONTS_DIR.mkdir(parents=True, exist_ok=True)
PWA_VENDOR_DIR.mkdir(parents=True, exist_ok=True)

# 1. Download pdf-lib.min.js
pdf_lib_url = "https://unpkg.com/pdf-lib/dist/pdf-lib.min.js"
pdf_lib_target = PWA_VENDOR_DIR / "pdf-lib.min.js"
print(f"Downloading pdf-lib from {pdf_lib_url} -> {pdf_lib_target}")
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
req = urllib.request.Request(pdf_lib_url, headers=UA)
pdf_data = urllib.request.urlopen(req, timeout=15).read()
with open(pdf_lib_target, "wb") as f:
    f.write(pdf_data)
print(f"pdf-lib saved: {pdf_lib_target.stat().st_size} bytes")

# 2. Download Fonts
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
font_api_url = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700;800&display=swap"

req = urllib.request.Request(font_api_url, headers=UA)
css_content = urllib.request.urlopen(req, timeout=15).read().decode('utf-8')

latin_blocks = css_content.split('/* latin */')[1:]
downloaded_fonts = []

for block in latin_blocks:
    clean_block = block.split('/*')[0]
    fam_match = re.search(r'font-family:\s*[\'"]([^\'"]+)[\'"]', clean_block)
    weight_match = re.search(r'font-weight:\s*(\d+)', clean_block)
    src_match = re.search(r'src:\s*url\((https://[^\)]+\.woff2)\)', clean_block)
    
    if fam_match and weight_match and src_match:
        family = fam_match.group(1)
        weight = weight_match.group(1)
        src_url = src_match.group(1)
        
        slug = family.lower().replace(' ', '-')
        filename = f"{slug}-v1-{weight}.woff2"
        
        # Download font file
        kiosk_file = KIOSK_FONTS_DIR / filename
        pwa_file = PWA_FONTS_DIR / filename
        
        print(f"Downloading {family} ({weight}) from {src_url}...")
        font_req = urllib.request.Request(src_url, headers=UA)
        font_data = urllib.request.urlopen(font_req, timeout=15).read()
        
        with open(kiosk_file, "wb") as f:
            f.write(font_data)
        with open(pwa_file, "wb") as f:
            f.write(font_data)
            
        downloaded_fonts.append({
            "family": family,
            "weight": weight,
            "filename": filename
        })
        print(f"Saved {filename} ({len(font_data)} bytes)")

# Generate local fonts.css for both kiosk_ui and pwa
font_css_lines = ["/* Local Offline-First Self-Hosted Fonts for PrintOS */"]
for item in downloaded_fonts:
    font_css_lines.append(f"""@font-face {{
  font-family: '{item["family"]}';
  font-style: normal;
  font-weight: {item["weight"]};
  font-display: swap;
  src: url('fonts/{item["filename"]}') format('woff2');
}}""")

css_output = "\n".join(font_css_lines) + "\n"

with open(KIOSK_FONTS_DIR.parent / "fonts.css", "w", encoding="utf-8") as f:
    f.write(css_output)

with open(PWA_FONTS_DIR.parent / "fonts.css", "w", encoding="utf-8") as f:
    f.write(css_output)

print(f"Generated fonts.css with {len(downloaded_fonts)} local font rules!")
