// PrintOS Kiosk Terminal - Fullscreen Touchscreen Controller

document.addEventListener("DOMContentLoaded", () => {
  // Global State
  let enteredDigits = [];
  let currentJob = null;
  let kioskData = null;
  let resetCountdownTimer = null;

  // View Sections
  const views = {
    home: document.getElementById("view-home"),
    keypad: document.getElementById("view-keypad"),
    summary: document.getElementById("view-summary"),
    printing: document.getElementById("view-printing"),
    wifi: document.getElementById("view-wifi"),
    usb: document.getElementById("view-usb-browser")
  };

  // Header Elements
  const kioskNameTag = document.getElementById("kiosk-name-tag");
  const paperLevelVal = document.getElementById("paper-level-val");
  const paperProgressFill = document.getElementById("paper-progress-fill");
  const printerStateText = document.getElementById("printer-state-text");
  const printerPulseDot = document.getElementById("printer-pulse-dot");
  const kioskClock = document.getElementById("kiosk-clock");

  // Home Elements
  const cardActionCollect = document.getElementById("card-action-collect");
  const cardActionPhone = document.getElementById("card-action-phone");
  const cardActionUsb = document.getElementById("card-action-usb");

  // Keypad Elements
  const btnBackHome = document.getElementById("btn-back-home");
  const keypadErrorMsg = document.getElementById("keypad-error-msg");
  const numKeys = document.querySelectorAll(".num-key");
  const digitSlots = [
    document.getElementById("slot-0"),
    document.getElementById("slot-1"),
    document.getElementById("slot-2"),
    document.getElementById("slot-3"),
    document.getElementById("slot-4"),
    document.getElementById("slot-5")
  ];

  // Summary Elements
  const btnBackKeypad = document.getElementById("btn-back-keypad");
  const summaryCodeBadge = document.getElementById("summary-code-badge");
  const sumFilename = document.getElementById("sum-filename");
  const sumFilemeta = document.getElementById("sum-filemeta");
  const sumPages = document.getElementById("sum-pages");
  const sumCopies = document.getElementById("sum-copies");
  const sumColor = document.getElementById("sum-color");
  const sumDuplex = document.getElementById("sum-duplex");
  const sumSheets = document.getElementById("sum-sheets");
  const sumTotalPrice = document.getElementById("sum-total-price");
  const chkPaperText = document.getElementById("chk-paper-text");
  const chkPrinterText = document.getElementById("chk-printer-text");
  const preflightOverallBadge = document.getElementById("preflight-overall-badge");
  const kioskMomoPhone = document.getElementById("kiosk-momo-phone");
  const btnPayPrint = document.getElementById("btn-pay-print");

  // Printing View Elements
  const printStepTitle = document.getElementById("print-step-title");
  const printStepDesc = document.getElementById("print-step-desc");
  const ussdSimCard = document.getElementById("ussd-sim-card");
  const ussdPriceVal = document.getElementById("ussd-price-val");
  const printSuccessBox = document.getElementById("print-success-box");
  const resetSeconds = document.getElementById("reset-seconds");
  const btnFinishNow = document.getElementById("btn-finish-now");

  // Wi-Fi View Elements
  const btnBackWifiHome = document.getElementById("btn-back-wifi-home");
  const wifiUrlDisplay = document.getElementById("wifi-url-display");
  const wifiQrCode = document.getElementById("wifi-qr-code");

  // Admin Modal Elements
  const btnAdminGear = document.getElementById("btn-admin-gear");
  const adminModal = document.getElementById("admin-modal");
  const btnCloseAdmin = document.getElementById("btn-close-admin");
  const adminCurPaper = document.getElementById("admin-cur-paper");
  const btnRestock500 = document.getElementById("btn-restock-500");
  const adminMockStatus = document.getElementById("admin-mock-status");
  const btnToggleMock = document.getElementById("btn-toggle-mock");
  const adminHostIp = document.getElementById("admin-host-ip");
  const adminDiskFree = document.getElementById("admin-disk-free");

  // -------------------------------------------------------------------
  // View Routing Function
  // -------------------------------------------------------------------
  function switchView(targetKey) {
    Object.keys(views).forEach((key) => {
      if (key === targetKey) {
        views[key].style.display = "flex";
        views[key].classList.add("view-active");
      } else {
        views[key].style.display = "none";
        views[key].classList.remove("view-active");
      }
    });

    if (targetKey === "keypad") {
      clearKeypad();
    }
  }

  // -------------------------------------------------------------------
  // Real-time Clock
  // -------------------------------------------------------------------
  function updateClock() {
    const now = new Date();
    kioskClock.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  setInterval(updateClock, 1000);
  updateClock();

  // -------------------------------------------------------------------
  // Kiosk Telemetry & Status Polling
  // -------------------------------------------------------------------
  async function fetchKioskStatus() {
    try {
      const res = await fetch("/api/kiosk/status");
      if (!res.ok) return;
      const data = await res.json();
      kioskData = data;

      // Update paper gauge
      const remaining = data.paper_sheets_remaining;
      const capacity = data.paper_capacity;
      const pct = data.paper_percentage;
      paperLevelVal.textContent = `${remaining} / ${capacity} sheets`;
      paperProgressFill.style.width = `${pct}%`;

      if (data.is_low_paper) {
        paperProgressFill.style.background = "var(--amber-warn)";
      } else {
        paperProgressFill.style.background = "var(--green-ready)";
      }

      // Update printer state
      if (data.printer && data.printer.online) {
        printerStateText.textContent = data.mock_mode ? "Virtual Spooler" : "Ready";
        printerPulseDot.style.background = "var(--green-ready)";
        printerPulseDot.style.boxShadow = "0 0 10px var(--green-ready)";
      } else {
        printerStateText.textContent = "Offline";
        printerPulseDot.style.background = "var(--red-alert)";
        printerPulseDot.style.boxShadow = "0 0 10px var(--red-alert)";
      }

      kioskNameTag.textContent = data.kiosk_name;

      // Update Wi-Fi URL display
      if (wifiUrlDisplay && data.pwa_url) {
        wifiUrlDisplay.textContent = data.pwa_url;
      }

      // Admin stats
      if (adminCurPaper) adminCurPaper.textContent = `${remaining} sheets`;
      if (adminMockStatus) adminMockStatus.textContent = data.mock_mode ? "Active (Virtual Spooler)" : "Real Hardware (OS Spooler)";
      if (adminHostIp) adminHostIp.textContent = `${data.local_ip}:8000`;
      if (adminDiskFree) adminDiskFree.textContent = `${data.disk_free_mb} MB Free`;

    } catch (err) {
      console.warn("Failed to fetch kiosk telemetry:", err);
    }
  }

  // Poll every 4 seconds
  setInterval(fetchKioskStatus, 4000);
  fetchKioskStatus();

  // -------------------------------------------------------------------
  // Home View Button Listeners
  // -------------------------------------------------------------------
  cardActionCollect.addEventListener("click", () => switchView("keypad"));
  cardActionPhone.addEventListener("click", () => {
    switchView("wifi");
    generateWifiQR();
  });
  // -------------------------------------------------------------------
  // USB Drive Monitoring & Direct Printing Logic
  // -------------------------------------------------------------------
  let usbPollInterval = null;
  let usbInsertPollInterval = null;
  let activeUsbDrive = null;
  let currentUsbSubfolder = "";

  const btnBackUsbHome = document.getElementById("btn-back-usb-home");
  const usbDriveStatusBadge = document.getElementById("usb-drive-status-badge");
  const usbWaitingView = document.getElementById("usb-waiting-view");
  const usbFilesView = document.getElementById("usb-files-view");
  const usbBreadcrumb = document.getElementById("usb-breadcrumb");
  const btnUsbNavUp = document.getElementById("btn-usb-nav-up");
  const btnRefreshUsb = document.getElementById("btn-refresh-usb");
  const usbFileList = document.getElementById("usb-file-list");

  // USB Insert Modal Elements
  const usbModal = document.getElementById("usb-modal");
  const btnCloseUsb = document.getElementById("btn-close-usb");
  const btnCancelUsb = document.getElementById("btn-cancel-usb");
  const usbModalStatusText = document.getElementById("usb-modal-status-text");
  const usbFileInput = document.getElementById("usb-file-input");

  // Home card click: check immediately if USB is inserted
  cardActionUsb.addEventListener("click", handleUsbCardClick);

  async function handleUsbCardClick() {
    try {
      const res = await fetch("/api/usb/drives");
      if (res.ok) {
        const data = await res.json();
        if (data.inserted && data.drives.length > 0) {
          // USB drive is ALREADY inserted! Automatically open drive location!
          openUsbFileBrowser(data.drives[0]);
          return;
        }
      }
    } catch (e) {
      console.warn("Error checking USB status on click:", e);
    }

    // No USB drive detected: show the popup telling user to insert a USB!
    openUsbInsertModal();
  }

  function openUsbInsertModal() {
    if (!usbModal) return;
    usbModal.style.display = "flex";
    if (usbModalStatusText) {
      usbModalStatusText.textContent = "Listening for USB flash drive in real time...";
    }

    stopUsbInsertPolling();
    // Poll every 1 second while popup is visible
    usbInsertPollInterval = setInterval(async () => {
      try {
        const res = await fetch("/api/usb/drives");
        if (!res.ok) return;
        const data = await res.json();
        if (data.inserted && data.drives.length > 0) {
          // A USB was just plugged in!
          stopUsbInsertPolling();
          if (usbModalStatusText) {
            usbModalStatusText.textContent = `USB Detected (${data.drives[0].letter})! Opening files...`;
          }
          await sleep(500);
          closeUsbInsertModal();
          openUsbFileBrowser(data.drives[0]);
        }
      } catch (err) {
        console.warn("Error polling USB in modal:", err);
      }
    }, 1000);
  }

  function closeUsbInsertModal() {
    stopUsbInsertPolling();
    if (usbModal) {
      usbModal.style.display = "none";
    }
  }

  function stopUsbInsertPolling() {
    if (usbInsertPollInterval) {
      clearInterval(usbInsertPollInterval);
      usbInsertPollInterval = null;
    }
  }

  if (btnCloseUsb) {
    btnCloseUsb.addEventListener("click", closeUsbInsertModal);
  }
  if (btnCancelUsb) {
    btnCancelUsb.addEventListener("click", closeUsbInsertModal);
  }

  // Simulation fallback: user selects a PDF from computer
  if (usbFileInput) {
    usbFileInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      closeUsbInsertModal();

      const formData = new FormData();
      formData.append("file", file);
      formData.append("copies", 1);
      formData.append("color", "BW");
      formData.append("duplex", "SIMPLEX");

      try {
        const res = await fetch("/api/jobs/stage", {
          method: "POST",
          body: formData
        });
        if (!res.ok) throw new Error("Could not stage simulated PDF");
        const data = await res.json();
        // Immediately open Job Summary & Pre-Flight release screen
        lookupStagedJob(data.pickup_code);
      } catch (err) {
        alert("Error reading file: " + err.message);
      }
    });
  }

  function openUsbFileBrowser(drive) {
    activeUsbDrive = drive;
    currentUsbSubfolder = "";
    switchView("usb");

    if (usbDriveStatusBadge) {
      usbDriveStatusBadge.textContent = `${drive.letter} (${drive.label})`;
      usbDriveStatusBadge.className = "code-tag-badge badge-pass";
    }
    if (usbWaitingView) usbWaitingView.style.display = "none";
    if (usbFilesView) usbFilesView.style.display = "flex";

    loadUsbDirectory(drive.path, "");
    startUsbMonitoring();
  }

  if (btnBackUsbHome) {
    btnBackUsbHome.addEventListener("click", () => {
      stopUsbMonitoring();
      stopUsbInsertPolling();
      switchView("home");
    });
  }

  function startUsbMonitoring() {
    stopUsbMonitoring();
    // Poll for USB removal or change every 2 seconds
    usbPollInterval = setInterval(checkUsbStatusDuringBrowse, 2000);
  }

  function stopUsbMonitoring() {
    if (usbPollInterval) {
      clearInterval(usbPollInterval);
      usbPollInterval = null;
    }
  }

  async function checkUsbStatusDuringBrowse() {
    try {
      const res = await fetch("/api/usb/drives");
      if (!res.ok) return;
      const data = await res.json();

      if (data.inserted && data.drives.length > 0) {
        const drive = data.drives[0];
        activeUsbDrive = drive;
        if (usbDriveStatusBadge) {
          usbDriveStatusBadge.textContent = `${drive.letter} (${drive.label})`;
          usbDriveStatusBadge.className = "code-tag-badge badge-pass";
        }
        if (usbWaitingView) usbWaitingView.style.display = "none";
        if (usbFilesView) usbFilesView.style.display = "flex";
      } else {
        // USB was removed while viewing files!
        activeUsbDrive = null;
        if (usbDriveStatusBadge) {
          usbDriveStatusBadge.textContent = "USB Drive Removed";
          usbDriveStatusBadge.className = "code-tag-badge badge-fail";
        }
        if (usbWaitingView) usbWaitingView.style.display = "flex";
        if (usbFilesView) usbFilesView.style.display = "none";
        if (usbFileList) usbFileList.innerHTML = "";
      }
    } catch (e) {
      console.warn("Error checking USB during browse:", e);
    }
  }

  async function loadUsbDirectory(drivePath, folder = "") {
    currentUsbSubfolder = folder;
    usbFileList.innerHTML = "<div class='usb-empty-state'>Loading files from USB drive...</div>";

    try {
      const res = await fetch(`/api/usb/browse?drive=${encodeURIComponent(drivePath)}&folder=${encodeURIComponent(folder)}`);
      if (!res.ok) {
        usbFileList.innerHTML = "<div class='usb-empty-state'>Could not read USB directory.</div>";
        return;
      }

      const data = await res.json();
      usbBreadcrumb.textContent = `📁 USB (${drivePath}) ${folder ? "/ " + folder : ""}`;

      if (data.parent_path !== null && data.parent_path !== folder && folder !== "") {
        btnUsbNavUp.style.display = "inline-block";
        btnUsbNavUp.onclick = () => loadUsbDirectory(drivePath, data.parent_path === "." ? "" : data.parent_path);
      } else {
        btnUsbNavUp.style.display = "none";
      }

      renderUsbContents(data, drivePath);
    } catch (err) {
      usbFileList.innerHTML = `<div class='usb-empty-state'>Error reading files: ${err.message}</div>`;
    }
  }

  function renderUsbContents(data, drivePath) {
    usbFileList.innerHTML = "";

    const hasItems = (data.folders && data.folders.length > 0) || (data.files && data.files.length > 0);
    if (!hasItems) {
      usbFileList.innerHTML = "<div class='usb-empty-state'>This folder is empty.</div>";
      return;
    }

    // Render Folders
    if (data.folders) {
      data.folders.forEach(folder => {
        const row = document.createElement("div");
        row.className = "usb-file-row";
        row.innerHTML = `
          <div class="usb-file-info">
            <div class="usb-file-icon icon-folder">📁</div>
            <div>
              <div class="usb-file-name">${folder.name}</div>
              <div class="usb-file-meta">Folder</div>
            </div>
          </div>
          <button type="button" class="btn-usb-open-folder">Open Folder &rarr;</button>
        `;
        row.querySelector(".btn-usb-open-folder").addEventListener("click", () => {
          loadUsbDirectory(drivePath, folder.rel_path);
        });
        usbFileList.appendChild(row);
      });
    }

    // Render Files
    if (data.files) {
      data.files.forEach(file => {
        const row = document.createElement("div");
        row.className = "usb-file-row";
        const isPdf = file.is_pdf;
        const iconClass = isPdf ? "icon-pdf" : "icon-other";
        const iconText = isPdf ? "PDF" : (file.extension || "FILE");

        row.innerHTML = `
          <div class="usb-file-info">
            <div class="usb-file-icon ${iconClass}">${iconText}</div>
            <div>
              <div class="usb-file-name">${file.name}</div>
              <div class="usb-file-meta">${file.size_formatted} &bull; ${isPdf ? "Ready to Print" : file.extension}</div>
            </div>
          </div>
          ${isPdf ? `<button type="button" class="btn-usb-print">Select to Print &rarr;</button>` : `<span style="font-size: 13px; color: var(--text-dim); padding-right: 12px;">Non-PDF</span>`}
        `;

        if (isPdf) {
          const btnPrint = row.querySelector(".btn-usb-print");
          btnPrint.addEventListener("click", async () => {
            btnPrint.disabled = true;
            btnPrint.textContent = "Loading Document...";
            try {
              const res = await fetch("/api/usb/stage-file", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  drive: drivePath,
                  rel_path: file.rel_path,
                  copies: 1,
                  color: "BW",
                  duplex: "SIMPLEX"
                })
              });
              if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: "Failed to stage USB file." }));
                throw new Error(err.detail);
              }
              const staged = await res.json();
              stopUsbMonitoring();
              // Smoothly transition directly to the Job Summary & Pre-Flight Release Screen!
              lookupStagedJob(staged.pickup_code);
            } catch (err) {
              alert("Error staging USB document: " + err.message);
              btnPrint.disabled = false;
              btnPrint.textContent = "Select to Print →";
            }
          });
        }

        usbFileList.appendChild(row);
      });
    }
  }

  if (btnRefreshUsb) {
    btnRefreshUsb.addEventListener("click", () => {
      if (activeUsbDrive) {
        loadUsbDirectory(activeUsbDrive.path, currentUsbSubfolder);
      } else {
        checkUsbStatus();
      }
    });
  }

  btnBackHome.addEventListener("click", () => {
    stopUsbMonitoring();
    switchView("home");
  });
  btnBackWifiHome.addEventListener("click", () => switchView("home"));
  btnBackKeypad.addEventListener("click", () => switchView("home"));

  // -------------------------------------------------------------------
  // Touchscreen Virtual Keypad Logic
  // -------------------------------------------------------------------
  function updateDigitDisplay() {
    for (let i = 0; i < 6; i++) {
      if (i < enteredDigits.length) {
        digitSlots[i].textContent = enteredDigits[i];
        digitSlots[i].classList.add("filled");
      } else {
        digitSlots[i].textContent = "•";
        digitSlots[i].classList.remove("filled");
      }
    }
  }

  function clearKeypad() {
    enteredDigits = [];
    keypadErrorMsg.style.display = "none";
    updateDigitDisplay();
  }

  function handleKeypadInput(key) {
    keypadErrorMsg.style.display = "none";

    if (key === "CLEAR") {
      enteredDigits = [];
      updateDigitDisplay();
      return;
    }

    if (key === "BACKSPACE") {
      if (enteredDigits.length > 0) {
        enteredDigits.pop();
        updateDigitDisplay();
      }
      return;
    }

    // Number entered
    if (enteredDigits.length < 6 && /^[0-9]$/.test(key)) {
      enteredDigits.push(key);
      updateDigitDisplay();

      // If all 6 digits entered, automatically perform lookup
      if (enteredDigits.length === 6) {
        const fullCode = enteredDigits.join("");
        lookupStagedJob(fullCode);
      }
    }
  }

  numKeys.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.key;
      handleKeypadInput(key);
    });
  });

  // Physical Keyboard Listener (for laptop or attached bar-code reader)
  window.addEventListener("keydown", (e) => {
    if (views.keypad.style.display !== "none") {
      if (/^[0-9]$/.test(e.key)) {
        handleKeypadInput(e.key);
      } else if (e.key === "Backspace") {
        handleKeypadInput("BACKSPACE");
      } else if (e.key === "Escape") {
        handleKeypadInput("CLEAR");
      }
    }
  });

  // -------------------------------------------------------------------
  // Job Lookup & Pre-Flight Validation
  // -------------------------------------------------------------------
  async function lookupStagedJob(code) {
    try {
      const res = await fetch(`/api/jobs/lookup/${code}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Lookup failed." }));
        keypadErrorMsg.textContent = err.detail || "Invalid or expired pickup code.";
        keypadErrorMsg.style.display = "block";
        // Shake feedback
        digitSlots.forEach(s => s.classList.add("shake"));
        setTimeout(() => digitSlots.forEach(s => s.classList.remove("shake")), 500);
        return;
      }

      const data = await res.json();
      currentJob = data.job;
      const preflight = data.preflight;

      // Populate Summary View
      summaryCodeBadge.textContent = `CODE: ${currentJob.formatted_code}`;
      sumFilename.textContent = currentJob.file_name;
      if (sumFilemeta) {
        sumFilemeta.textContent = `${formatBytes(currentJob.file_size_bytes)} • Staged remotely`;
      }
      sumPages.textContent = `${currentJob.page_count} pages`;
      sumCopies.textContent = `${currentJob.copies} cop${currentJob.copies > 1 ? "ies" : "y"}`;
      sumColor.textContent = currentJob.color_mode === "COLOR" ? "Full Color" : "Black & White";
      sumDuplex.textContent = currentJob.duplex_mode === "DUPLEX" ? "Double-Sided (Duplex)" : "Single-Sided";
      sumSheets.textContent = `${currentJob.sheet_count} sheet${currentJob.sheet_count > 1 ? "s" : ""}`;
      sumTotalPrice.textContent = Number(currentJob.total_price).toFixed(2);

      // Pre-populate MoMo phone
      kioskMomoPhone.value = currentJob.phone_number || "";

      // Health checks
      chkPaperText.textContent = `${preflight.paper_available} available (Need ${preflight.sheets_needed})`;
      chkPrinterText.textContent = preflight.printer_detail || "Ready";

      if (preflight.can_print) {
        preflightOverallBadge.textContent = "ALL SYSTEMS GO";
        preflightOverallBadge.className = "preflight-badge badge-pass";
        btnPayPrint.disabled = false;
        btnPayPrint.style.opacity = "1";
      } else {
        preflightOverallBadge.textContent = "HARDWARE BLOCKED";
        preflightOverallBadge.className = "preflight-badge badge-fail";
        btnPayPrint.disabled = true;
        btnPayPrint.style.opacity = "0.5";
        alert("Pre-flight check failed! This kiosk cannot fulfill this print job right now.");
      }

      switchView("summary");
    } catch (err) {
      console.error("Kiosk lookup error:", err);
      keypadErrorMsg.textContent = "Error displaying job details: " + err.message;
      keypadErrorMsg.style.display = "block";
    }
  }

  // -------------------------------------------------------------------
  // Pay & Print Execution Flow
  // -------------------------------------------------------------------
  btnPayPrint.addEventListener("click", async () => {
    if (!currentJob) return;

    const phone = kioskMomoPhone.value.trim() || currentJob.phone_number || "0240000000";

    // Switch to printing animation view
    switchView("printing");

    // Reset stepper
    resetPipelineStepper();

    // Step 1: Hardware Pre-Flight Check
    setPipelineStep(1, "Verifying Hardware...", "Checking paper levels, disk buffer, and printer state...");
    await sleep(800);

    // Step 2: MoMo USSD Push
    setPipelineStep(2, "Dispatching Mobile Money Prompt...", `USSD authorization sent to +233 ${phone}`);
    ussdPriceVal.textContent = Number(currentJob.total_price).toFixed(2);
    ussdSimCard.style.display = "block";

    // Call Backend Payment & Print endpoint
    try {
      const res = await fetch(`/api/jobs/${currentJob.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phone })
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: "Payment or printing failed." }));
        alert("Error: " + (error.detail || "Print job aborted."));
        switchView("summary");
        return;
      }

      const result = await res.json();

      // Step 3: Spooling
      ussdSimCard.style.display = "none";
      setPipelineStep(3, "Payment Confirmed!", "Spooling document to Canon Laser Printer...");
      await sleep(1200);

      // Step 4: Printing
      setPipelineStep(4, "Printing Document...", `Dispensing ${currentJob.sheet_count} page(s) to collection tray...`);
      await sleep(1500);

      // Complete!
      showPrintSuccess();

      // Refresh kiosk telemetry
      fetchKioskStatus();

    } catch (err) {
      alert("Print execution error: " + err.message);
      switchView("summary");
    }
  });

  function resetPipelineStepper() {
    printSuccessBox.style.display = "none";
    ussdSimCard.style.display = "none";
    for (let i = 1; i <= 4; i++) {
      const step = document.getElementById(`pipe-step-${i}`);
      if (step) {
        step.className = "pipe-step";
      }
      const conn = document.getElementById(`pipe-conn-${i}`);
      if (conn) {
        conn.className = "pipe-connector";
      }
    }
  }

  function setPipelineStep(stepNum, title, desc) {
    printStepTitle.textContent = title;
    printStepDesc.textContent = desc;

    for (let i = 1; i <= 4; i++) {
      const step = document.getElementById(`pipe-step-${i}`);
      const conn = document.getElementById(`pipe-conn-${i - 1}`);

      if (i < stepNum) {
        if (step) step.className = "pipe-step step-done";
        if (conn) conn.className = "pipe-connector conn-active";
      } else if (i === stepNum) {
        if (step) step.className = "pipe-step step-active";
      } else {
        if (step) step.className = "pipe-step";
      }
    }
  }

  function showPrintSuccess() {
    printStepTitle.textContent = "Print Job Finished!";
    printStepDesc.textContent = "Document safely unlinked & shredded.";
    for (let i = 1; i <= 4; i++) {
      const step = document.getElementById(`pipe-step-${i}`);
      if (step) step.className = "pipe-step step-done";
    }

    printSuccessBox.style.display = "block";

    let timeLeft = 8;
    resetSeconds.textContent = timeLeft;

    if (resetCountdownTimer) clearInterval(resetCountdownTimer);
    resetCountdownTimer = setInterval(() => {
      timeLeft--;
      resetSeconds.textContent = timeLeft;
      if (timeLeft <= 0) {
        clearInterval(resetCountdownTimer);
        switchView("home");
      }
    }, 1000);
  }

  btnFinishNow.addEventListener("click", () => {
    if (resetCountdownTimer) clearInterval(resetCountdownTimer);
    switchView("home");
  });

  // -------------------------------------------------------------------
  // Wi-Fi Direct QR Code Generator (SVG)
  // -------------------------------------------------------------------
  function generateWifiQR() {
    const url = (kioskData && kioskData.pwa_url) ? kioskData.pwa_url : `${window.location.origin}/upload`;
    wifiUrlDisplay.textContent = url;

    // Render high-contrast SVG QR Code visual
    wifiQrCode.innerHTML = `
      <svg viewBox="0 0 200 200" width="100%" height="100%">
        <!-- Background -->
        <rect width="200" height="200" fill="#ffffff"/>
        <!-- Corner Markers -->
        <rect x="20" y="20" width="50" height="50" fill="#000000"/>
        <rect x="30" y="30" width="30" height="30" fill="#ffffff"/>
        <rect x="40" y="40" width="10" height="10" fill="#000000"/>

        <rect x="130" y="20" width="50" height="50" fill="#000000"/>
        <rect x="140" y="30" width="30" height="30" fill="#ffffff"/>
        <rect x="150" y="40" width="10" height="10" fill="#000000"/>

        <rect x="20" y="130" width="50" height="50" fill="#000000"/>
        <rect x="30" y="140" width="30" height="30" fill="#ffffff"/>
        <rect x="40" y="150" width="10" height="10" fill="#000000"/>

        <!-- Simulated Data Pixels -->
        <rect x="85" y="25" width="10" height="10" fill="#000000"/>
        <rect x="105" y="25" width="10" height="10" fill="#000000"/>
        <rect x="95" y="45" width="10" height="10" fill="#000000"/>
        <rect x="85" y="65" width="10" height="10" fill="#000000"/>
        <rect x="105" y="65" width="10" height="10" fill="#000000"/>

        <rect x="25" y="85" width="10" height="10" fill="#000000"/>
        <rect x="45" y="95" width="10" height="10" fill="#000000"/>
        <rect x="65" y="85" width="10" height="10" fill="#000000"/>
        <rect x="85" y="95" width="10" height="10" fill="#000000"/>
        <rect x="105" y="85" width="10" height="10" fill="#000000"/>
        <rect x="125" y="95" width="10" height="10" fill="#000000"/>
        <rect x="145" y="85" width="10" height="10" fill="#000000"/>
        <rect x="165" y="95" width="10" height="10" fill="#000000"/>

        <rect x="95" y="115" width="10" height="10" fill="#000000"/>
        <rect x="115" y="115" width="10" height="10" fill="#000000"/>
        <rect x="135" y="115" width="10" height="10" fill="#000000"/>
        <rect x="85" y="135" width="10" height="10" fill="#000000"/>
        <rect x="105" y="145" width="10" height="10" fill="#000000"/>
        <rect x="145" y="135" width="10" height="10" fill="#000000"/>
        <rect x="165" y="145" width="10" height="10" fill="#000000"/>

        <rect x="95" y="165" width="10" height="10" fill="#000000"/>
        <rect x="115" y="165" width="10" height="10" fill="#000000"/>
        <rect x="145" y="165" width="10" height="10" fill="#000000"/>
        <rect x="165" y="165" width="10" height="10" fill="#000000"/>
      </svg>
    `;
  }

  // -------------------------------------------------------------------
  // Admin & Technician Modal Logic
  // -------------------------------------------------------------------
  btnAdminGear.addEventListener("click", () => {
    adminModal.style.display = "flex";
  });

  btnCloseAdmin.addEventListener("click", () => {
    adminModal.style.display = "none";
  });

  btnRestock500.addEventListener("click", async () => {
    try {
      const res = await fetch("/api/kiosk/restock?sheets=500", { method: "POST" });
      if (res.ok) {
        alert("Paper supply successfully reset to 500 sheets.");
        fetchKioskStatus();
      }
    } catch (e) {
      alert("Error restocking paper: " + e.message);
    }
  });

  btnToggleMock.addEventListener("click", async () => {
    try {
      const res = await fetch("/api/kiosk/toggle-mock", { method: "POST" });
      if (res.ok) {
        const d = await res.json();
        alert(`Mock Mode is now: ${d.mock_mode ? "ENABLED (Virtual Spooler)" : "DISABLED (Physical Hardware)"}`);
        fetchKioskStatus();
      }
    } catch (e) {
      alert("Error toggling mock mode: " + e.message);
    }
  });

  // Helpers
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }
});
