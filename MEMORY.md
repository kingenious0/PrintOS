# PrintOS Memory & Architecture Rules

## Kingenious 4-Tier Dark Architecture & Design System

PrintOS (both the Kiosk Touchscreen Terminal and the Customer Phone PWA) follows the Kingenious Starter Kit design architecture (`../kingenious-frontend-starter-kit/ARCHITECTURE.md`):

### 1. 4-Tier Dark Surface System
- **Tier 1 (Chassis / Root Base):** `#0D1115` - Deep root background for terminal chassis.
- **Tier 2 (Panels & Stations):** `#161D22` - Cards, dialog overlays, sidebars, file browser containers.
- **Tier 3 (Active Controls & Tiles):** `#1C232B` - Keypads, touch input fields, action buttons, file rows.
- **Tier 4 (Elevated Badges & Insets):** `#242B32` - Status badges, breadcrumb badges, stat boxes.
- **Hairline Borders:** `1px solid rgba(255, 255, 255, 0.08)` for crisp elevation without visual noise.
- **Brand Accent:** Electric Blue / Cyan (`#2563EB` / `#0284C7`) with neon glow (`0 0 20px -4px rgba(37, 99, 235, 0.4)`).
- **Text Hierarchy:**
  - Primary: `#EFEFF1`
  - Muted: `#949599`
  - Subtle / Disabled: `#494F55`

### 2. Touchscreen Tactile Physics
- Physical button depression on tap/click:
  ```css
  button:not(:disabled):active {
    transform: translateY(2px) scale(0.97) !important;
  }
  ```
- Numeric keypad tiles in `kiosk_ui`: Elevated hardware tiles with tactile feedback and highlight on tap.

### 3. PWA Digital Release Pass
- 6-digit release code formatted as a high-security digital pass:
  - Font: `JetBrains Mono` with wide letter-spacing (`0.25em` to `0.3em`).
  - Glowing digital voucher badge.
  - High-contrast pure white QR code frame (`#FFFFFF`) optimized for hardware optical scanner cameras.

### 4. Hardware Telemetry & Status Badges
- Top navigation telemetry pills with ambient pulsing green radar dot (`@keyframes pingRing`) for live connectivity.
- Live paper meters and toner status.

### 5. Glassmorphism & Overlays
- Modal dialogs (Payment, Print Configuration Drawer, Error Alerts) use:
  ```css
  background: rgba(22, 29, 34, 0.94);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7);
  ```

### 6. USB File Explorer Standard
- Container: `.usb-browser-wrapper` and `.usb-main-layout` with `flex: 1; min-height: 0;`.
- Toolbar: `.usb-browser-toolbar` with breadcrumbs and `.btn-toolbar` action buttons.
- File rows: `.usb-file-row` displaying distinct colored badges:
  - Folders: Amber (`#F59E0B`)
  - PDFs: Crimson (`#EF4444`)
  - DOCX: Electric Blue (`#60A5FA`)
  - Other: Slate (`#94A3B8`)
- Selecting any printable document opens the dedicated Print Configuration Drawer (Never skips directly to payment).

### Critical Constraint
Never modify or break existing HTML element IDs, class selectors used in `kiosk.js` or `pwa.js`, or the Python FastAPI backend endpoints.
