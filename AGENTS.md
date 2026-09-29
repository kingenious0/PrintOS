# AGENTS.md — PrintOS Agent Guidelines & Architecture Rules

## Core System Architecture & Design Standard
PrintOS operates under the **Kingenious Starter Kit Architecture** (`../kingenious-frontend-starter-kit/ARCHITECTURE.md`):

1. **4-Tier Dark Hardware Surface System**:
   - Tier 1 (Root Chassis): `#0D1115`
   - Tier 2 (Station Panels & Modals): `#161D22`
   - Tier 3 (Keypad & Action Tiles): `#1C232B`
   - Tier 4 (Inner Highlights & Badges): `#242B32`
   - Hairline Borders: `1px solid rgba(255, 255, 255, 0.08)`
   - Brand Accent: Electric Blue / Cyan (`#2563EB` / `#0284C7`) with subtle neon glow (`0 0 20px -4px rgba(37, 99, 235, 0.4)`)
   - Text Palette: Primary `#EFEFF1`, Muted `#949599`, Subtle `#494F55`

2. **Touchscreen Physical Feedback**:
   - `button:not(:disabled):active { transform: translateY(2px) scale(0.97) !important; }`
   - Tactile numeric keypad tiles with instant active tap highlight.

3. **Customer Phone Interface (PWA)**:
   - 3-step wizard flow: Upload ➔ Options ➔ Digital Pickup Pass.
   - 6-digit release voucher formatted in JetBrains Mono with `letter-spacing: 0.25em`.
   - Pure white QR code container for instant optical scanning by kiosk cameras.

4. **Kiosk Touchscreen Interface (`kiosk_ui/`)**:
   - Top status bar with live telemetry and pulsing radar ring (`@keyframes pingRing`).
   - USB File Explorer with distinct colored file type badges (Folder = amber, PDF = crimson, DOCX = blue, other = slate).
   - Selecting any file MUST open the print configuration drawer (`openPrintConfigModal()`). Never skip directly to payment.

5. **Stability Rules**:
   - Do NOT rename or alter existing HTML element IDs or JS class selectors in `kiosk.js` or `pwa.js`.
   - Do NOT run automated browser subagents (`browser_subagent`) — the user performs manual browser checks.
