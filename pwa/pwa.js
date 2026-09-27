// PrintOS PWA - Customer Staging Logic

document.addEventListener("DOMContentLoaded", () => {
  // State
  let currentFile = null;
  let pageCount = 0;
  let copies = 1;
  let colorMode = "BW"; // 'BW' | 'COLOR'
  let duplexMode = "SIMPLEX"; // 'SIMPLEX' | 'DUPLEX'
  let stagedJob = null;

  // DOM Elements
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");
  const dropZoneIdle = document.getElementById("drop-zone-idle");
  const fileSelectedCard = document.getElementById("file-selected-card");
  const fileNameDisplay = document.getElementById("file-name-display");
  const fileSizeDisplay = document.getElementById("file-size-display");
  const detectedPagesBadge = document.getElementById("detected-pages-badge");
  const btnChangeFile = document.getElementById("btn-change-file");

  const btnCopyMinus = document.getElementById("btn-copy-minus");
  const btnCopyPlus = document.getElementById("btn-copy-plus");
  const copiesDisplay = document.getElementById("copies-display");

  const colorToggle = document.getElementById("color-toggle");
  const duplexToggle = document.getElementById("duplex-toggle");
  const phoneInput = document.getElementById("phone-input");

  const totalPriceDisplay = document.getElementById("total-price-display");
  const summaryPages = document.getElementById("summary-pages");
  const summarySheets = document.getElementById("summary-sheets");
  const summaryRate = document.getElementById("summary-rate");
  const btnStageJob = document.getElementById("btn-stage-job");
  const btnSpinner = document.getElementById("btn-spinner");
  const btnText = btnStageJob.querySelector(".btn-text");

  // Modal Elements
  const successModal = document.getElementById("success-modal");
  const displayPickupCode = document.getElementById("display-pickup-code");
  const btnCopyCode = document.getElementById("btn-copy-code");
  const modalFilename = document.getElementById("modal-filename");
  const modalSheets = document.getElementById("modal-sheets");
  const modalMode = document.getElementById("modal-mode");
  const modalPrice = document.getElementById("modal-price");
  const btnStageAnother = document.getElementById("btn-stage-another");

  const kioskStatusPill = document.getElementById("kiosk-status-pill");
  const kioskStatusText = document.getElementById("kiosk-status-text");

  // Fetch Kiosk Status on startup
  async function checkKioskStatus() {
    try {
      const res = await fetch("/api/kiosk/status");
      if (res.ok) {
        const data = await res.json();
        if (data.is_online) {
          kioskStatusText.textContent = `Kiosk #01 Online (${data.paper_sheets_remaining} sheets)`;
          kioskStatusPill.style.borderColor = "rgba(16, 185, 129, 0.3)";
        } else {
          kioskStatusText.textContent = "Kiosk Maintenance";
          kioskStatusPill.style.borderColor = "rgba(239, 68, 68, 0.4)";
        }
      }
    } catch (e) {
      console.warn("Could not reach kiosk status endpoint:", e);
    }
  }
  checkKioskStatus();

  // Format File Size
  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  // Client-side Page Detection using PDF-lib or fallback regex
  async function detectPdfPages(file) {
    try {
      const buffer = await file.arrayBuffer();

      // Attempt with PDF-lib
      if (window.PDFLib && window.PDFLib.PDFDocument) {
        try {
          const pdfDoc = await window.PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
          const count = pdfDoc.getPageCount();
          if (count > 0) return count;
        } catch (err) {
          console.warn("PDF-lib parse error, falling back to byte inspection:", err);
        }
      }

      // Fast fallback byte inspection
      const bytes = new Uint8Array(buffer);
      const text = new TextDecoder("latin1").decode(bytes);
      const matches = text.match(/\/Type\s*\/Page\b/g);
      if (matches && matches.length > 0) {
        return matches.length;
      }
    } catch (err) {
      console.error("Error reading PDF bytes:", err);
    }
    return 1; // Minimum 1 page default
  }

  // Handle File Selection
  async function handleFileSelect(file) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      alert("Please upload a PDF document.");
      return;
    }

    currentFile = file;
    fileNameDisplay.textContent = file.name;
    fileSizeDisplay.textContent = formatBytes(file.size);
    detectedPagesBadge.textContent = "Detecting pages...";

    dropZoneIdle.style.display = "none";
    fileSelectedCard.style.display = "flex";

    // Detect pages
    pageCount = await detectPdfPages(file);
    detectedPagesBadge.textContent = `${pageCount} page${pageCount > 1 ? "s" : ""}`;

    updatePriceCalculation();
  }

  // Drag and Drop listeners
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
    if (e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  });

  btnChangeFile.addEventListener("click", (e) => {
    e.stopPropagation();
    fileInput.value = "";
    fileInput.click();
  });

  // Copies Stepper
  btnCopyMinus.addEventListener("click", () => {
    if (copies > 1) {
      copies--;
      copiesDisplay.textContent = copies;
      updatePriceCalculation();
    }
  });

  btnCopyPlus.addEventListener("click", () => {
    if (copies < 50) {
      copies++;
      copiesDisplay.textContent = copies;
      updatePriceCalculation();
    }
  });

  // Color Mode Toggle
  colorToggle.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      colorToggle.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      colorMode = btn.dataset.color;
      updatePriceCalculation();
    });
  });

  // Duplex Mode Toggle
  duplexToggle.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      duplexToggle.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      duplexMode = btn.dataset.duplex;
      updatePriceCalculation();
    });
  });

  // Calculate Sheets & Price
  function updatePriceCalculation() {
    if (!currentFile || pageCount <= 0) {
      totalPriceDisplay.textContent = "0.00";
      summaryPages.textContent = "0 pages";
      summarySheets.textContent = "0 sheets";
      summaryRate.textContent = colorMode === "COLOR" ? "GH₵ 1.00 / sheet" : "GH₵ 0.50 / sheet";
      btnStageJob.disabled = true;
      return;
    }

    const sheetsPerCopy = duplexMode === "DUPLEX" ? Math.ceil(pageCount / 2) : pageCount;
    const totalSheets = sheetsPerCopy * copies;
    const rate = colorMode === "COLOR" ? 1.00 : 0.50;
    const totalPrice = (totalSheets * rate).toFixed(2);

    totalPriceDisplay.textContent = totalPrice;
    summaryPages.textContent = `${pageCount} page${pageCount > 1 ? "s" : ""} × ${copies} cop${copies > 1 ? "ies" : "y"}`;
    summarySheets.textContent = `${totalSheets} physical sheet${totalSheets > 1 ? "s" : ""}`;
    summaryRate.textContent = `GH₵ ${rate.toFixed(2)} / sheet`;

    btnStageJob.disabled = false;
  }

  // Submit Job Staging
  btnStageJob.addEventListener("click", async () => {
    if (!currentFile) return;

    btnStageJob.disabled = true;
    btnSpinner.style.display = "inline-block";
    btnText.textContent = "Staging Document...";

    try {
      const formData = new FormData();
      formData.append("file", currentFile);
      formData.append("pages", pageCount);
      formData.append("copies", copies);
      formData.append("color", colorMode);
      formData.append("duplex", duplexMode);
      formData.append("phone", phoneInput.value.trim());

      const res = await fetch("/api/jobs/stage", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: "Failed to stage job." }));
        throw new Error(errorData.detail || "Server error staging job.");
      }

      const data = await res.json();
      stagedJob = data;
      showSuccessModal(data);
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      btnStageJob.disabled = false;
      btnSpinner.style.display = "none";
      btnText.textContent = "Generate 6-Digit Pickup Code";
    }
  });

  // Display Success Modal
  function showSuccessModal(job) {
    const raw = job.pickup_code;
    const formatted = raw.length === 6 ? `${raw.slice(0, 3)} - ${raw.slice(3)}` : raw;

    displayPickupCode.textContent = formatted;
    modalFilename.textContent = job.file_name;
    modalSheets.textContent = `${job.page_count} pages (${job.sheet_count} sheets)`;
    modalMode.textContent = `${job.color_mode === "COLOR" ? "Full Color" : "Black & White"} • ${job.duplex_mode === "DUPLEX" ? "Double-Sided" : "Single-Sided"}`;
    modalPrice.textContent = `GH₵ ${Number(job.total_price).toFixed(2)}`;

    successModal.style.display = "flex";
  }

  // Copy Code Button
  btnCopyCode.addEventListener("click", () => {
    if (!stagedJob) return;
    const code = stagedJob.pickup_code;
    navigator.clipboard.writeText(code).then(() => {
      btnCopyCode.textContent = "Copied to Clipboard!";
      setTimeout(() => {
        btnCopyCode.textContent = "Copy Code";
      }, 2500);
    }).catch(() => {
      // Fallback
      prompt("Copy your pickup code:", code);
    });
  });

  // Stage Another Document Reset
  btnStageAnother.addEventListener("click", () => {
    successModal.style.display = "none";
    currentFile = null;
    pageCount = 0;
    copies = 1;
    copiesDisplay.textContent = "1";
    fileInput.value = "";
    dropZoneIdle.style.display = "block";
    fileSelectedCard.style.display = "none";
    phoneInput.value = "";
    updatePriceCalculation();
  });
});
