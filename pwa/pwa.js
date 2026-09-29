// ==========================================================================
// PrintOS Customer Web & Smartphone PWA - 3-Step Wizard Controller
// Responsive, Multi-Step State Flow with Instant PDF/DOCX Page Detection
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
  // Application State
  let currentFile = null;
  let pageCount = 0;
  let copies = 1;
  let colorMode = "BW"; // 'BW' | 'COLOR'
  let duplexMode = "SIMPLEX"; // 'SIMPLEX' | 'DUPLEX'
  let currentStep = 1;

  // DOM Elements - Stepper Navigation
  const stepNav1 = document.getElementById("step-nav-1");
  const stepNav2 = document.getElementById("step-nav-2");
  const stepNav3 = document.getElementById("step-nav-3");
  const stepConn1 = document.getElementById("step-conn-1");
  const stepConn2 = document.getElementById("step-conn-2");

  // DOM Elements - Wizard Screens
  const screenStep1 = document.getElementById("screen-step-1");
  const screenStep2 = document.getElementById("screen-step-2");
  const screenStep3 = document.getElementById("screen-step-3");

  // DOM Elements - Screen 1: Dropzone & File Summary
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");
  const dropZoneIdle = document.getElementById("drop-zone-idle");
  const fileSelectedCard = document.getElementById("file-selected-card");
  const fileTypeBadge = document.getElementById("file-type-badge");
  const fileNameDisplay = document.getElementById("file-name-display");
  const fileSizeDisplay = document.getElementById("file-size-display");
  const detectedPagesBadge = document.getElementById("detected-pages-badge");
  const btnChangeFile = document.getElementById("btn-change-file");

  const fileSummaryCard = document.getElementById("file-summary-card");
  const summaryPageCount = document.getElementById("summary-page-count");
  const summaryFormat = document.getElementById("summary-format");
  const summarySize = document.getElementById("summary-size");
  const btnToStep2 = document.getElementById("btn-to-step-2");

  // DOM Elements - Screen 2: Print Parameters
  const btnBackToStep1 = document.getElementById("btn-back-to-step-1");
  const screen2FileText = document.getElementById("screen2-file-text");

  const btnCopyMinus = document.getElementById("btn-copy-minus");
  const btnCopyPlus = document.getElementById("btn-copy-plus");
  const copiesDisplay = document.getElementById("copies-display");

  const colorButtons = document.querySelectorAll("#color-toggle .pill-btn");
  const duplexButtons = document.querySelectorAll("#duplex-toggle .pill-btn");
  const phoneInput = document.getElementById("phone-input");

  const totalPriceDisplay = document.getElementById("total-price-display");
  const summarySheetsSub = document.getElementById("summary-sheets-sub");
  const btnStageJob = document.getElementById("btn-stage-job");
  const btnSpinner = document.getElementById("btn-spinner");

  // DOM Elements - Screen 3: Voucher Pass
  const displayPickupCode = document.getElementById("display-pickup-code");
  const btnCopyCode = document.getElementById("btn-copy-code");
  const copyBtnLabel = document.getElementById("copy-btn-label");
  const modalFilename = document.getElementById("modal-filename");
  const modalSheets = document.getElementById("modal-sheets");
  const modalMode = document.getElementById("modal-mode");
  const modalPrice = document.getElementById("modal-price");
  const btnStageAnother = document.getElementById("btn-stage-another");

  const kioskStatusBadge = document.getElementById("kiosk-status-badge");
  const kioskStatusText = document.getElementById("kiosk-status-text");

  // -------------------------------------------------------------------------
  // Kiosk Telemetry Check
  // -------------------------------------------------------------------------
  async function checkKioskStatus() {
    try {
      const res = await fetch("/api/kiosk/status");
      if (res.ok) {
        const data = await res.json();
        if (data.is_online) {
          if (kioskStatusText) kioskStatusText.textContent = `Kiosk #01 (${data.paper_sheets_remaining} Sheets)`;
          if (kioskStatusBadge) kioskStatusBadge.style.display = "inline-flex";
        } else {
          if (kioskStatusText) kioskStatusText.textContent = "Kiosk Maintenance";
        }
      }
    } catch (e) {
      console.warn("Could not reach kiosk status endpoint:", e);
    }
  }
  checkKioskStatus();

  // -------------------------------------------------------------------------
  // Wizard Navigation Controller
  // -------------------------------------------------------------------------
  function setWizardStep(step) {
    currentStep = step;

    // Reset screens
    if (screenStep1) screenStep1.style.display = step === 1 ? "flex" : "none";
    if (screenStep2) screenStep2.style.display = step === 2 ? "flex" : "none";
    if (screenStep3) screenStep3.style.display = step === 3 ? "flex" : "none";

    // Stepper header visuals
    if (stepNav1) stepNav1.classList.remove("active", "completed");
    if (stepNav2) stepNav2.classList.remove("active", "completed");
    if (stepNav3) stepNav3.classList.remove("active", "completed");
    if (stepConn1) stepConn1.classList.remove("completed");
    if (stepConn2) stepConn2.classList.remove("completed");

    if (step === 1) {
      if (stepNav1) stepNav1.classList.add("active");
    } else if (step === 2) {
      if (stepNav1) stepNav1.classList.add("completed");
      if (stepConn1) stepConn1.classList.add("completed");
      if (stepNav2) stepNav2.classList.add("active");

      // Update Screen 2 active document pill
      if (currentFile && screen2FileText) {
        screen2FileText.textContent = `${currentFile.name} (${pageCount} page${pageCount > 1 ? "s" : ""})`;
      }
      updatePriceCalculation();
    } else if (step === 3) {
      if (stepNav1) stepNav1.classList.add("completed");
      if (stepConn1) stepConn1.classList.add("completed");
      if (stepNav2) stepNav2.classList.add("completed");
      if (stepConn2) stepConn2.classList.add("completed");
      if (stepNav3) stepNav3.classList.add("active");
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // -------------------------------------------------------------------------
  // File Sizing Formatter
  // -------------------------------------------------------------------------
  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return "0 B";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  // -------------------------------------------------------------------------
  // Client-Side Page Detection (PDF & Word DOCX)
  // -------------------------------------------------------------------------
  async function detectDocumentPages(file) {
    const nameLower = file.name.toLowerCase();

    // 1. PDF Page Detection
    if (nameLower.endsWith(".pdf") || file.type === "application/pdf") {
      try {
        const buffer = await file.arrayBuffer();

        // Primary: PDF-lib
        if (window.PDFLib && window.PDFLib.PDFDocument) {
          try {
            const pdfDoc = await window.PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
            const count = pdfDoc.getPageCount();
            if (count > 0) return count;
          } catch (err) {
            console.warn("PDF-lib parse error, falling back to byte scan:", err);
          }
        }

        // Fast fallback: scan for /Type /Page tags
        const bytes = new Uint8Array(buffer);
        const text = new TextDecoder("latin1").decode(bytes);
        const matches = text.match(/\/Type\s*\/Page\b/g);
        if (matches && matches.length > 0) {
          return matches.length;
        }
      } catch (err) {
        console.warn("Could not parse PDF client-side:", err);
      }
      return 1;
    }

    // 2. Word DOCX Page Detection via OpenXML docProps/app.xml
    if (nameLower.endsWith(".docx")) {
      try {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
        const pageMatch = text.match(/<Pages>(\d+)<\/Pages>/i);
        if (pageMatch && parseInt(pageMatch[1], 10) > 0) {
          return parseInt(pageMatch[1], 10);
        }
      } catch (e) {
        console.warn("Client DOCX scan warning:", e);
      }
      return 1;
    }

    return 1;
  }

  // -------------------------------------------------------------------------
  // File Selection & Upload Handling
  // -------------------------------------------------------------------------
  async function handleFileSelect(file) {
    if (!file) return;

    const nameLower = file.name.toLowerCase();
    const isPdf = nameLower.endsWith(".pdf") || file.type === "application/pdf";
    const isDocx = nameLower.endsWith(".docx") || nameLower.endsWith(".doc");

    if (!isPdf && !isDocx) {
      alert("Unsupported file format. Please select a PDF or Word document (.docx).");
      return;
    }

    currentFile = file;
    if (fileNameDisplay) fileNameDisplay.textContent = file.name;
    if (fileSizeDisplay) fileSizeDisplay.textContent = formatBytes(file.size);
    if (detectedPagesBadge) detectedPagesBadge.textContent = "Detecting pages...";

    // Set badge style
    if (fileTypeBadge) {
      if (isDocx) {
        fileTypeBadge.textContent = "DOCX";
        fileTypeBadge.classList.add("docx-badge");
      } else {
        fileTypeBadge.textContent = "PDF";
        fileTypeBadge.classList.remove("docx-badge");
      }
    }

    if (summaryFormat) summaryFormat.textContent = isDocx ? "Word Document" : "Adobe PDF";
    if (summarySize) summarySize.textContent = formatBytes(file.size);
    if (summaryPageCount) summaryPageCount.textContent = "Parsing...";

    if (dropZoneIdle) dropZoneIdle.style.display = "none";
    if (fileSelectedCard) fileSelectedCard.style.display = "flex";
    if (fileSummaryCard) fileSummaryCard.style.display = "flex";

    // Detect pages
    pageCount = await detectDocumentPages(file);
    if (detectedPagesBadge) detectedPagesBadge.textContent = `${pageCount} page${pageCount > 1 ? "s" : ""}`;
    if (summaryPageCount) summaryPageCount.textContent = `${pageCount} page${pageCount > 1 ? "s" : ""}`;

    // Enable Screen 1 continuation button
    if (btnToStep2) btnToStep2.disabled = false;
  }

  // Event Listeners for Dropzone & Inputs
  if (dropZone) {
    dropZone.addEventListener("click", (e) => {
      if (e.target !== btnChangeFile && (!fileSelectedCard || !fileSelectedCard.contains(e.target))) {
        if (fileInput) fileInput.click();
      }
    });

    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.classList.add("dragover");
    });

    dropZone.addEventListener("dragleave", () => {
      dropZone.classList.remove("dragover");
    });

    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.classList.remove("dragover");
      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    });
  }

  if (btnChangeFile) {
    btnChangeFile.addEventListener("click", (e) => {
      e.stopPropagation();
      if (fileInput) fileInput.click();
    });
  }

  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
      }
    });
  }

  // Step 1 -> Step 2 Navigation
  if (btnToStep2) {
    btnToStep2.addEventListener("click", () => {
      if (currentFile && pageCount > 0) {
        setWizardStep(2);
      }
    });
  }

  // Step 2 -> Step 1 Back Navigation
  if (btnBackToStep1) {
    btnBackToStep1.addEventListener("click", () => {
      setWizardStep(1);
    });
  }

  // -------------------------------------------------------------------------
  // Parameter Steppers & Toggles
  // -------------------------------------------------------------------------
  if (btnCopyMinus) {
    btnCopyMinus.addEventListener("click", () => {
      if (copies > 1) {
        copies--;
        if (copiesDisplay) copiesDisplay.textContent = copies;
        updatePriceCalculation();
      }
    });
  }

  if (btnCopyPlus) {
    btnCopyPlus.addEventListener("click", () => {
      if (copies < 50) {
        copies++;
        if (copiesDisplay) copiesDisplay.textContent = copies;
        updatePriceCalculation();
      }
    });
  }

  if (colorButtons && colorButtons.length > 0) {
    colorButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        colorButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        colorMode = btn.dataset.color || "BW";
        updatePriceCalculation();
      });
    });
  }

  if (duplexButtons && duplexButtons.length > 0) {
    duplexButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        duplexButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        duplexMode = btn.dataset.duplex || "SIMPLEX";
        updatePriceCalculation();
      });
    });
  }

  // -------------------------------------------------------------------------
  // Live Price Calculation
  // -------------------------------------------------------------------------
  function updatePriceCalculation() {
    if (!currentFile || pageCount <= 0) {
      if (totalPriceDisplay) totalPriceDisplay.textContent = "0.00";
      if (summarySheetsSub) summarySheetsSub.textContent = "0 sheets needed";
      if (btnStageJob) btnStageJob.disabled = true;
      return;
    }

    // Physical sheets needed calculation:
    // SIMPLEX: 1 sheet per page * copies
    // DUPLEX: ceil(pages / 2) * copies
    let sheetsPerCopy = (duplexMode === "DUPLEX") ? Math.ceil(pageCount / 2) : pageCount;
    let totalSheets = sheetsPerCopy * copies;

    // Unit rate: GH₵0.50 for BW, GH₵1.00 for Color
    let rate = (colorMode === "COLOR") ? 1.00 : 0.50;
    let totalPrice = (totalSheets * rate).toFixed(2);

    if (totalPriceDisplay) totalPriceDisplay.textContent = totalPrice;
    if (summarySheetsSub) summarySheetsSub.textContent = `${totalSheets} physical sheet${totalSheets > 1 ? "s" : ""}`;
    if (btnStageJob) btnStageJob.disabled = false;
  }

  // -------------------------------------------------------------------------
  // Screen 2 Submission: Stage Job & Move to Screen 3
  // -------------------------------------------------------------------------
  async function triggerJobStaging() {
    if (!currentFile || pageCount <= 0) return;

    if (btnStageJob) btnStageJob.disabled = true;
    if (btnSpinner) btnSpinner.style.display = "inline-block";

    const formData = new FormData();
    formData.append("file", currentFile);
    formData.append("pages", pageCount);
    formData.append("copies", copies);
    formData.append("color", colorMode);
    formData.append("duplex", duplexMode);
    formData.append("phone", phoneInput ? phoneInput.value.trim() : "");

    try {
      const res = await fetch("/api/jobs/stage", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: "Failed to stage job." }));
        throw new Error(errorData.detail || "Server error staging job");
      }

      const data = await res.json();
      renderVoucherPass(data);
      setWizardStep(3);

    } catch (err) {
      alert("Error staging document: " + err.message);
    } finally {
      if (btnStageJob) btnStageJob.disabled = false;
      if (btnSpinner) btnSpinner.style.display = "none";
    }
  }

  if (btnStageJob) {
    btnStageJob.addEventListener("click", triggerJobStaging);
  }

  // -------------------------------------------------------------------------
  // Screen 3: Voucher Pass Presentation
  // -------------------------------------------------------------------------
  function renderVoucherPass(data) {
    // Large, bold monospaced pickup code display (4 8 2 - 9 0 1)
    if (displayPickupCode) displayPickupCode.textContent = data.formatted_code;

    if (modalFilename) modalFilename.textContent = data.file_name;
    if (modalSheets) modalSheets.textContent = `${data.page_count} pages (${data.sheet_count} physical sheets)`;
    if (modalMode) modalMode.textContent = `${data.color_mode === "COLOR" ? "Color" : "B&W"} • ${data.duplex_mode === "DUPLEX" ? "Double-Sided" : "Single-Sided"} • ${copies} ${copies === 1 ? "Copy" : "Copies"}`;
    if (modalPrice) modalPrice.textContent = `GH₵ ${data.total_price.toFixed(2)}`;
  }

  // Copy Code Action
  if (btnCopyCode) {
    btnCopyCode.addEventListener("click", async () => {
      const code = displayPickupCode ? displayPickupCode.textContent.trim() : "";
      try {
        await navigator.clipboard.writeText(code);
        if (copyBtnLabel) copyBtnLabel.textContent = "Copied!";
        btnCopyCode.style.background = "var(--emerald)";
        btnCopyCode.style.borderColor = "var(--emerald)";
        btnCopyCode.style.color = "#FFFFFF";
        setTimeout(() => {
          if (copyBtnLabel) copyBtnLabel.textContent = "Copy Code";
          btnCopyCode.style.background = "var(--card-bg)";
          btnCopyCode.style.borderColor = "var(--primary-border)";
          btnCopyCode.style.color = "var(--primary)";
        }, 2000);
      } catch (err) {
        alert("Pickup Code: " + code);
      }
    });
  }

  // Stage Another Document Reset (Back to Step 1)
  if (btnStageAnother) {
    btnStageAnother.addEventListener("click", () => {
      currentFile = null;
      pageCount = 0;
      copies = 1;
      colorMode = "BW";
      duplexMode = "SIMPLEX";

      if (fileInput) fileInput.value = "";
      if (dropZoneIdle) dropZoneIdle.style.display = "flex";
      if (fileSelectedCard) fileSelectedCard.style.display = "none";
      if (fileSummaryCard) fileSummaryCard.style.display = "none";

      if (copiesDisplay) copiesDisplay.textContent = "1";
      if (colorButtons && colorButtons[0]) colorButtons[0].click();
      if (duplexButtons && duplexButtons[0]) duplexButtons[0].click();
      if (phoneInput) phoneInput.value = "";

      if (btnToStep2) btnToStep2.disabled = true;
      setWizardStep(1);
    });
  }

  // Initial step setup
  setWizardStep(1);
});
