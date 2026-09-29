// ==========================================================================
// PrintOS Kiosk Terminal - Commercial POS / ATM Touchscreen Controller
// Complete State Architecture, USB Workflow Fix & Strict HCI Standards
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
  // Global State
  let enteredDigits = [];
  let currentJob = null;
  let kioskData = null;
  let activeUsbDrive = null;
  let currentUsbSubfolder = "";
  let usbPollInterval = null;

  // Staged USB File pending configuration
  let pendingUsbFile = null;
  let cfgCopies = 1;
  let cfgColor = "BW";
  let cfgDuplex = "SIMPLEX";
  let cfgPageCount = 1;

  // MoMo Phone input state on Screen 4
  let momoDigits = ["0", "2", "4", "1", "2", "3", "4", "5", "6", "7"];

  // Inactivity Timer State (Strict 60-Second Guard)
  const INACTIVITY_TIMEOUT_SEC = 60;
  let inactivityRemaining = INACTIVITY_TIMEOUT_SEC;
  let inactivityTimer = null;
  let completionTimer = null;

  // -------------------------------------------------------------------------
  // DOM References
  // -------------------------------------------------------------------------
  const views = {
    home: document.getElementById("view-home"),
    keypad: document.getElementById("view-keypad"),
    usb: document.getElementById("view-usb-browser"),
    summary: document.getElementById("view-summary"),
    printing: document.getElementById("view-printing"),
    completion: document.getElementById("view-completion"),
    wifi: document.getElementById("view-wifi")
  };

  // Header Elements
  const kioskNameTag = document.getElementById("kiosk-name-tag");
  const stationStatusPill = document.getElementById("station-status-pill");
  const stationStatusText = document.getElementById("station-status-text");
  const paperLevelVal = document.getElementById("paper-level-val");
  const paperProgressFill = document.getElementById("paper-progress-fill");
  const sessionTimeoutPill = document.getElementById("session-timeout-pill");
  const sessionCountdownSeconds = document.getElementById("session-countdown-seconds");
  const kioskClock = document.getElementById("kiosk-clock");
  const btnAdminGear = document.getElementById("btn-admin-gear");

  // Home Screen Actions
  const cardActionCollect = document.getElementById("card-action-collect");
  const cardActionPhone = document.getElementById("card-action-phone");
  const cardActionUsb = document.getElementById("card-action-usb");

  // Keypad Screen Elements
  const btnBackHome = document.getElementById("btn-back-home");
  const digitSlots = [
    document.getElementById("slot-0"),
    document.getElementById("slot-1"),
    document.getElementById("slot-2"),
    document.getElementById("slot-3"),
    document.getElementById("slot-4"),
    document.getElementById("slot-5")
  ];
  const keypadErrorMsg = document.getElementById("keypad-error-msg");
  const keypadErrorText = document.getElementById("keypad-error-text");
  const keypadVerifyingMsg = document.getElementById("keypad-verifying-msg");
  const numpadButtons = document.querySelectorAll(".virtual-keypad-matrix .num-key");

  // USB Browser Elements
  const btnBackUsbHome = document.getElementById("btn-back-usb-home");
  const usbDriveStatusBadge = document.getElementById("usb-drive-status-badge");
  const usbDriveLabelText = document.getElementById("usb-drive-label-text");
  const usbWaitingView = document.getElementById("usb-waiting-view");
  const usbFilesView = document.getElementById("usb-files-view");
  const usbPathText = document.getElementById("usb-path-text");
  const btnUsbNavUp = document.getElementById("btn-usb-nav-up");
  const btnRefreshUsb = document.getElementById("btn-refresh-usb");
  const usbFileList = document.getElementById("usb-file-list");
  const btnOpenSimulatedUsb = document.getElementById("btn-open-simulated-usb");
  const kioskUsbFilePicker = document.getElementById("kiosk-usb-file-picker");

  // Print Configuration Modal Elements (The Fix)
  const configModal = document.getElementById("config-modal");
  const btnCloseConfig = document.getElementById("btn-close-config");
  const cfgFilename = document.getElementById("cfg-filename");
  const cfgFilesize = document.getElementById("cfg-filesize");
  const cfgPages = document.getElementById("cfg-pages");
  const cfgBtnMinus = document.getElementById("cfg-btn-minus");
  const cfgBtnPlus = document.getElementById("cfg-btn-plus");
  const cfgCopiesVal = document.getElementById("cfg-copies-val");
  const cfgColorCards = document.querySelectorAll("#cfg-color-options .selectable-pill-card");
  const cfgDuplexCards = document.querySelectorAll("#cfg-duplex-options .selectable-pill-card");
  const cfgSummarySheets = document.getElementById("cfg-summary-sheets");
  const cfgSummaryPrice = document.getElementById("cfg-summary-price");
  const btnCfgContinue = document.getElementById("btn-cfg-continue");

  // Summary & Pre-Flight Checkout Elements
  const btnBackSummary = document.getElementById("btn-back-summary");
  const summaryCodeBadge = document.getElementById("summary-code-badge");
  const sumFilename = document.getElementById("sum-filename");
  const sumPages = document.getElementById("sum-pages");
  const sumCopies = document.getElementById("sum-copies");
  const sumColor = document.getElementById("sum-color");
  const sumDuplex = document.getElementById("sum-duplex");
  const sumSheets = document.getElementById("sum-sheets");
  const sumTotalPrice = document.getElementById("sum-total-price");
  const preflightOverallBadge = document.getElementById("preflight-overall-badge");
  const chkPaperItem = document.getElementById("chk-paper-item");
  const chkPaperText = document.getElementById("chk-paper-text");
  const chkPrinterItem = document.getElementById("chk-printer-item");
  const chkPrinterText = document.getElementById("chk-printer-text");
  const momoPhoneDisplay = document.getElementById("momo-phone-display");
  const momoKeypadButtons = document.querySelectorAll("#momo-keypad-matrix .mini-num-key");
  const btnPayPrint = document.getElementById("btn-pay-print");
  const btnPayText = document.getElementById("btn-pay-text");

  // Live Printing Process Elements
  const procIcon = document.getElementById("proc-icon");
  const printStepTitle = document.getElementById("print-step-title");
  const printStepDesc = document.getElementById("print-step-desc");
  const pipeSteps = [
    document.getElementById("pipe-step-1"),
    document.getElementById("pipe-step-2"),
    document.getElementById("pipe-step-3"),
    document.getElementById("pipe-step-4")
  ];
  const pipeConns = [
    document.getElementById("pipe-conn-1"),
    document.getElementById("pipe-conn-2"),
    document.getElementById("pipe-conn-3")
  ];
  const ussdSimCard = document.getElementById("ussd-sim-card");
  const ussdPromptMsg = document.getElementById("ussd-prompt-msg");
  const ussdProgressFill = document.getElementById("ussd-progress-fill");

  // Completion Elements
  const resetSeconds = document.getElementById("reset-seconds");
  const btnFinishNow = document.getElementById("btn-finish-now");

  // Wi-Fi View Elements
  const btnBackWifiHome = document.getElementById("btn-back-wifi-home");
  const btnWifiToKeypad = document.getElementById("btn-wifi-to-keypad");
  const wifiUrlDisplay = document.getElementById("wifi-url-display");
  const wifiQrCode = document.getElementById("wifi-qr-code");

  // Admin Modal Elements
  const adminModal = document.getElementById("admin-modal");
  const btnCloseAdmin = document.getElementById("btn-close-admin");
  const adminCurPaper = document.getElementById("admin-cur-paper");
  const btnRestock500 = document.getElementById("btn-restock-500");
  const adminMockStatus = document.getElementById("admin-mock-status");
  const btnToggleMock = document.getElementById("btn-toggle-mock");
  const adminHostIp = document.getElementById("admin-host-ip");
  const adminDiskFree = document.getElementById("admin-disk-free");

  // Track the origin of the current flow (for Back navigation)
  let flowOrigin = "keypad"; // "keypad" | "usb"

  // -------------------------------------------------------------------------
  // INACTIVITY SESSION TIMEOUT (Strict 60s Guard with Temporary File Wipe)
  // -------------------------------------------------------------------------
  function resetInactivityTimer() {
    inactivityRemaining = INACTIVITY_TIMEOUT_SEC;
    if (sessionCountdownSeconds) {
      sessionCountdownSeconds.textContent = `${inactivityRemaining}s`;
    }
  }

  function startInactivityCountdown() {
    stopInactivityCountdown();
    resetInactivityTimer();
    sessionTimeoutPill.style.display = "flex";

    inactivityTimer = setInterval(async () => {
      inactivityRemaining--;
      if (sessionCountdownSeconds) {
        sessionCountdownSeconds.textContent = `${inactivityRemaining}s`;
      }

      if (inactivityRemaining <= 0) {
        stopInactivityCountdown();
        await handleInactivityTimeout();
      }
    }, 1000);
  }

  function stopInactivityCountdown() {
    if (inactivityTimer) {
      clearInterval(inactivityTimer);
      inactivityTimer = null;
    }
    if (sessionTimeoutPill) {
      sessionTimeoutPill.style.display = "none";
    }
  }

  async function handleInactivityTimeout() {
    // If a temporary job was staged during this session and not completed, cancel and shred it
    if (currentJob && currentJob.status === "STAGED") {
      try {
        await fetch(`/api/jobs/${currentJob.id}/cancel`, { method: "POST" });
        console.info(`[Kiosk] Inactivity session reset: Cancelled staged job ${currentJob.id}`);
      } catch (err) {
        console.warn("Could not cancel abandoned job on timeout:", err);
      }
    }

    currentJob = null;
    pendingUsbFile = null;
    enteredDigits = [];
    closeConfigModal();
    switchView("home");
  }

  // Any user touch or click resets the inactivity guard
  window.addEventListener("pointerdown", () => {
    if (inactivityTimer) {
      resetInactivityTimer();
    }
  }, { passive: true });

  window.addEventListener("keydown", () => {
    if (inactivityTimer) {
      resetInactivityTimer();
    }
  }, { passive: true });

  // -------------------------------------------------------------------------
  // Real-Time Clock
  // -------------------------------------------------------------------------
  function updateClock() {
    const now = new Date();
    kioskClock.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  setInterval(updateClock, 1000);
  updateClock();

  // -------------------------------------------------------------------------
  // View Router
  // -------------------------------------------------------------------------
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

    if (targetKey === "home") {
      stopInactivityCountdown();
      stopUsbMonitoring();
      clearKeypad();
    } else if (targetKey === "completion") {
      stopInactivityCountdown();
      startCompletionCountdown();
    } else {
      // Any interactive inner view starts the 60s inactivity guard
      startInactivityCountdown();
    }
  }

  // -------------------------------------------------------------------------
  // Telemetry Polling
  // -------------------------------------------------------------------------
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
        paperProgressFill.style.background = "var(--amber)";
      } else {
        paperProgressFill.style.background = "var(--emerald)";
      }

      // Update station status pill
      if (data.is_online && data.printer && data.printer.online) {
        stationStatusText.textContent = data.mock_mode ? "Virtual Spooler" : "Ready";
        stationStatusPill.className = "status-pill";
        stationStatusPill.style.background = "var(--emerald-light)";
        stationStatusPill.style.color = "var(--emerald)";
        stationStatusPill.style.borderColor = "var(--emerald-border)";
      } else {
        stationStatusText.textContent = "Offline";
        stationStatusPill.className = "status-pill";
        stationStatusPill.style.background = "var(--rose-light)";
        stationStatusPill.style.color = "var(--rose)";
        stationStatusPill.style.borderColor = "var(--rose-border)";
      }

      kioskNameTag.textContent = data.kiosk_name;

      // Wi-Fi Display
      if (wifiUrlDisplay && data.pwa_url) {
        wifiUrlDisplay.textContent = data.pwa_url;
      }

      // Admin stats
      if (adminCurPaper) adminCurPaper.textContent = `${remaining} sheets remaining`;
      if (adminMockStatus) adminMockStatus.textContent = data.mock_mode ? "Active (Virtual Spooler)" : "Real Hardware (OS Spooler)";
      if (adminHostIp) adminHostIp.textContent = `${data.local_ip}:8000`;
      if (adminDiskFree) adminDiskFree.textContent = `${data.disk_free_mb} MB Free`;

    } catch (err) {
      console.warn("Failed to fetch kiosk telemetry:", err);
    }
  }

  setInterval(fetchKioskStatus, 4000);
  fetchKioskStatus();

  // -------------------------------------------------------------------------
  // Home View Button Listeners
  // -------------------------------------------------------------------------
  cardActionCollect.addEventListener("click", () => {
    flowOrigin = "keypad";
    switchView("keypad");
  });

  cardActionPhone.addEventListener("click", () => {
    switchView("wifi");
    generateWifiQR();
  });

  cardActionUsb.addEventListener("click", () => {
    flowOrigin = "usb";
    switchView("usb");
    checkUsbDrives();
    startUsbMonitoring();
  });

  btnBackHome.addEventListener("click", () => switchView("home"));
  btnBackUsbHome.addEventListener("click", () => switchView("home"));
  btnBackWifiHome.addEventListener("click", () => switchView("home"));
  btnWifiToKeypad.addEventListener("click", () => {
    flowOrigin = "keypad";
    switchView("keypad");
  });

  // -------------------------------------------------------------------------
  // SCREEN 2: Virtual Touch Keypad Logic (Unmasked 6-Digit Display)
  // -------------------------------------------------------------------------
  function updateDigitDisplay() {
    for (let i = 0; i < 6; i++) {
      if (i < enteredDigits.length) {
        // STRICT HCI RULE: Visible numbers, NEVER masked dots!
        digitSlots[i].textContent = enteredDigits[i];
        digitSlots[i].classList.add("filled");
      } else {
        digitSlots[i].innerHTML = "&nbsp;";
        digitSlots[i].classList.remove("filled");
      }
    }
  }

  function clearKeypad() {
    enteredDigits = [];
    updateDigitDisplay();
    hideKeypadFeedback();
  }

  function hideKeypadFeedback() {
    keypadErrorMsg.style.display = "none";
    keypadVerifyingMsg.style.display = "none";
  }

  numpadButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.key;
      hideKeypadFeedback();

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

      // Add numeric digit
      if (enteredDigits.length < 6) {
        enteredDigits.push(key);
        updateDigitDisplay();

        // When 6th digit entered, auto-verify immediately!
        if (enteredDigits.length === 6) {
          verifyPickupCode(enteredDigits.join(""));
        }
      }
    });
  });

  async function verifyPickupCode(code) {
    keypadVerifyingMsg.style.display = "inline-flex";
    keypadErrorMsg.style.display = "none";

    try {
      const res = await fetch(`/api/jobs/lookup/${code}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Invalid or expired pickup code.");
      }

      // Valid Code found!
      currentJob = data.job;
      flowOrigin = "keypad";
      keypadVerifyingMsg.style.display = "none";
      
      // Populate Summary & Pre-Flight Checkout
      renderCheckoutView(data);
      switchView("summary");

    } catch (err) {
      keypadVerifyingMsg.style.display = "none";
      keypadErrorText.textContent = err.message || "Invalid pickup code. Please check and try again.";
      keypadErrorMsg.style.display = "inline-flex";
    }
  }

  // -------------------------------------------------------------------------
  // SCREEN 3: USB Drive Browser & Detection Logic
  // -------------------------------------------------------------------------
  function startUsbMonitoring() {
    stopUsbMonitoring();
    usbPollInterval = setInterval(checkUsbDrives, 2500);
  }

  function stopUsbMonitoring() {
    if (usbPollInterval) {
      clearInterval(usbPollInterval);
      usbPollInterval = null;
    }
  }

  async function checkUsbDrives() {
    try {
      const res = await fetch("/api/usb/drives");
      if (!res.ok) return;
      const data = await res.json();

      if (data.inserted && data.drives && data.drives.length > 0) {
        const drive = data.drives[0];
        activeUsbDrive = drive;
        usbDriveLabelText.textContent = `${drive.letter} (${drive.label})`;
        usbDriveStatusBadge.style.display = "inline-flex";
        usbWaitingView.style.display = "none";
        usbFilesView.style.display = "flex";

        if (!currentUsbSubfolder && usbFileList.children.length === 0) {
          loadUsbDirectory(drive.path, "");
        }
      } else {
        activeUsbDrive = null;
        usbDriveLabelText.textContent = "No USB Detected";
        usbWaitingView.style.display = "flex";
        usbFilesView.style.display = "none";
        usbFileList.innerHTML = "";
      }
    } catch (e) {
      console.warn("Error checking USB drives:", e);
    }
  }

  async function loadUsbDirectory(drivePath, folder = "") {
    currentUsbSubfolder = folder;
    usbFileList.innerHTML = "<div class='usb-empty-state'>Scanning files on USB drive...</div>";
    usbPathText.textContent = `USB Drive (${drivePath})${folder ? ' / ' + folder : ''}`;

    try {
      const res = await fetch(`/api/usb/browse?drive=${encodeURIComponent(drivePath)}&folder=${encodeURIComponent(folder)}`);
      if (!res.ok) {
        usbFileList.innerHTML = "<div class='usb-empty-state'>Could not read USB directory.</div>";
        return;
      }

      const data = await res.json();

      if (data.parent_path !== null && data.parent_path !== folder && folder !== "") {
        btnUsbNavUp.style.display = "inline-flex";
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
      usbFileList.innerHTML = "<div class='usb-empty-state'>No documents found in this folder.</div>";
      return;
    }

    // Folders
    if (data.folders) {
      data.folders.forEach(f => {
        const row = document.createElement("div");
        row.className = "usb-file-row";
        row.innerHTML = `
          <div class="usb-file-left">
            <div class="usb-file-icon icon-folder">📁</div>
            <div class="usb-file-meta-col">
              <div class="usb-file-name">${f.name}</div>
              <div class="usb-file-sub">Folder</div>
            </div>
          </div>
          <button type="button" class="btn-toolbar">Open &rarr;</button>
        `;
        row.addEventListener("click", () => loadUsbDirectory(drivePath, f.rel_path));
        usbFileList.appendChild(row);
      });
    }

    // Files
    if (data.files) {
      data.files.forEach(f => {
        const row = document.createElement("div");
        row.className = "usb-file-row";
        const fileNameLower = (f.name || "").toLowerCase();
        const extLower = (f.extension || "").toLowerCase();
        const isPdf = Boolean(f.is_pdf) || fileNameLower.endsWith(".pdf") || extLower === "pdf";
        const isDocx = Boolean(f.is_docx) || fileNameLower.endsWith(".docx") || fileNameLower.endsWith(".doc") || extLower === "docx" || extLower === "doc";
        const isPrintable = Boolean(f.is_printable) || isPdf || isDocx;

        let iconClass = "icon-other";
        if (isPdf) iconClass = "icon-pdf";
        else if (isDocx) iconClass = "icon-docx";

        const iconText = isPdf ? "PDF" : (isDocx ? "DOCX" : (f.extension || "FILE"));
        const pageCount = f.page_count || 1;
        const pageBadge = isPrintable ? `<span class="usb-page-pill">${pageCount} ${pageCount === 1 ? 'Page' : 'Pages'}</span>` : "";

        row.innerHTML = `
          <div class="usb-file-left">
            <div class="usb-file-icon ${iconClass}">${iconText}</div>
            <div class="usb-file-meta-col">
              <div class="usb-file-name">${f.name}</div>
              <div class="usb-file-sub">
                <span>${f.size_formatted}</span>
                ${pageBadge}
              </div>
            </div>
          </div>
          ${isPrintable ? `<button type="button" class="btn-select-file">Configure & Print &rarr;</button>` : `<span style="font-size: 13px; color: var(--text-muted);">Non-Printable</span>`}
        `;

        if (isPrintable) {
          row.addEventListener("click", () => {
            // CRITICAL FIX: NEVER skip to payment! Open configuration drawer/modal!
            openPrintConfigModal({
              drive: drivePath,
              rel_path: f.rel_path,
              name: f.name,
              size_formatted: f.size_formatted,
              page_count: f.page_count || 1
            });
          });
        }

        usbFileList.appendChild(row);
      });
    }
  }

  btnRefreshUsb.addEventListener("click", () => {
    if (activeUsbDrive) {
      loadUsbDirectory(activeUsbDrive.path, currentUsbSubfolder);
    } else {
      checkUsbDrives();
    }
  });

  // Simulated USB options
  btnOpenSimulatedUsb.addEventListener("click", async () => {
    try {
      const res = await fetch("/api/usb/drives");
      if (res.ok) {
        const data = await res.json();
        if (data.drives && data.drives.length > 0) {
          const simDrive = data.drives[0];
          activeUsbDrive = simDrive;
          usbWaitingView.style.display = "none";
          usbFilesView.style.display = "flex";
          loadUsbDirectory(simDrive.path, "");
          return;
        }
      }
    } catch (e) {
      console.warn("Could not load simulated USB drive:", e);
    }
    // Fallback: trigger file picker
    kioskUsbFilePicker.click();
  });

  kioskUsbFilePicker.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Open configuration modal directly for this simulated file
    openPrintConfigModal({
      isLocalUpload: true,
      fileObj: file,
      name: file.name,
      size_formatted: `${(file.size / 1024).toFixed(1)} KB`,
      page_count: 4 // default estimated
    });
  });

  // -------------------------------------------------------------------------
  // PRINT CONFIGURATION MODAL (THE CRITICAL FIX)
  // -------------------------------------------------------------------------
  function openPrintConfigModal(fileData) {
    pendingUsbFile = fileData;
    cfgCopies = 1;
    cfgColor = "BW";
    cfgDuplex = "SIMPLEX";
    cfgPageCount = fileData.page_count || 1;

    // Populate Modal Info
    cfgFilename.textContent = fileData.name;
    cfgFilesize.textContent = fileData.size_formatted;
    cfgPages.textContent = `${cfgPageCount} ${cfgPageCount === 1 ? 'Page' : 'Pages'} Detected`;

    cfgCopiesVal.textContent = cfgCopies;
    updateConfigSelectionUI();
    recalculateConfigSummary();

    configModal.style.display = "flex";
  }

  function closeConfigModal() {
    configModal.style.display = "none";
    pendingUsbFile = null;
  }

  btnCloseConfig.addEventListener("click", closeConfigModal);

  // Stepper Handlers
  cfgBtnMinus.addEventListener("click", () => {
    if (cfgCopies > 1) {
      cfgCopies--;
      cfgCopiesVal.textContent = cfgCopies;
      recalculateConfigSummary();
    }
  });

  cfgBtnPlus.addEventListener("click", () => {
    if (cfgCopies < 50) {
      cfgCopies++;
      cfgCopiesVal.textContent = cfgCopies;
      recalculateConfigSummary();
    }
  });

  // Color Mode Pill Selection
  cfgColorCards.forEach(card => {
    card.addEventListener("click", () => {
      cfgColor = card.dataset.color;
      updateConfigSelectionUI();
      recalculateConfigSummary();
    });
  });

  // Duplex Mode Pill Selection
  cfgDuplexCards.forEach(card => {
    card.addEventListener("click", () => {
      cfgDuplex = card.dataset.duplex;
      updateConfigSelectionUI();
      recalculateConfigSummary();
    });
  });

  function updateConfigSelectionUI() {
    cfgColorCards.forEach(c => {
      if (c.dataset.color === cfgColor) {
        c.classList.add("selected");
      } else {
        c.classList.remove("selected");
      }
    });

    cfgDuplexCards.forEach(d => {
      if (d.dataset.duplex === cfgDuplex) {
        d.classList.add("selected");
      } else {
        d.classList.remove("selected");
      }
    });
  }

  function recalculateConfigSummary() {
    let sheetsPerCopy = (cfgDuplex === "DUPLEX") ? Math.ceil(cfgPageCount / 2) : cfgPageCount;
    let totalSheets = sheetsPerCopy * cfgCopies;
    let rate = (cfgColor === "COLOR") ? 1.00 : 0.50;
    let price = (totalSheets * rate).toFixed(2);

    cfgSummarySheets.textContent = `${totalSheets} ${totalSheets === 1 ? 'Sheet' : 'Sheets'} Required`;
    cfgSummaryPrice.textContent = `GH₵ ${price}`;
  }

  // Continue to Payment from Configuration Screen
  btnCfgContinue.addEventListener("click", async () => {
    if (!pendingUsbFile) return;

    btnCfgContinue.disabled = true;
    btnCfgContinue.textContent = "Preparing Document...";

    try {
      let stagedData = null;

      if (pendingUsbFile.isLocalUpload) {
        // Upload simulated file with configuration parameters
        const formData = new FormData();
        formData.append("file", pendingUsbFile.fileObj);
        formData.append("copies", cfgCopies);
        formData.append("color", cfgColor);
        formData.append("duplex", cfgDuplex);

        const res = await fetch("/api/jobs/stage", {
          method: "POST",
          body: formData
        });
        if (!res.ok) throw new Error("Could not stage simulated file.");
        stagedData = await res.json();

      } else {
        // Direct USB file staging with customized copies, color, and duplex!
        const res = await fetch("/api/usb/stage-file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            drive: pendingUsbFile.drive,
            rel_path: pendingUsbFile.rel_path,
            copies: cfgCopies,
            color: cfgColor,
            duplex: cfgDuplex
          })
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: "Failed to stage USB file." }));
          throw new Error(err.detail);
        }
        stagedData = await res.json();
      }

      // Close modal and lookup staged job to show Screen 4 Pre-Flight & Payment!
      closeConfigModal();
      stopUsbMonitoring();

      const lookupRes = await fetch(`/api/jobs/lookup/${stagedData.pickup_code}`);
      const fullData = await lookupRes.json();

      currentJob = fullData.job;
      flowOrigin = "usb";
      renderCheckoutView(fullData);
      switchView("summary");

    } catch (err) {
      alert("Error configuring document: " + err.message);
    } finally {
      btnCfgContinue.disabled = false;
      btnCfgContinue.innerHTML = `<span>Continue to Payment</span> <span>&rarr;</span>`;
    }
  });

  // -------------------------------------------------------------------------
  // SCREEN 4: Pre-Flight Health & Payment Screen Logic
  // -------------------------------------------------------------------------
  function renderCheckoutView(data) {
    const job = data.job;
    const preflight = data.preflight;

    summaryCodeBadge.textContent = `PICKUP CODE: ${job.formatted_code}`;
    sumFilename.textContent = job.file_name;
    sumPages.textContent = `${job.page_count} ${job.page_count === 1 ? 'page' : 'pages'}`;
    sumCopies.textContent = `${job.copies} ${job.copies === 1 ? 'copy' : 'copies'}`;
    sumColor.textContent = job.color_mode === "COLOR" ? "Full Color" : "Black & White";
    sumDuplex.textContent = job.duplex_mode === "DUPLEX" ? "Double-Sided (Duplex)" : "Single-Sided";
    sumSheets.textContent = `${job.sheet_count} ${job.sheet_count === 1 ? 'sheet' : 'sheets'}`;
    sumTotalPrice.textContent = job.total_price.toFixed(2);
    btnPayText.textContent = `Pay GH₵ ${job.total_price.toFixed(2)} via Mobile Money & Print`;

    // Pre-flight indicators
    if (preflight.paper_ok) {
      chkPaperItem.className = "check-item ok";
      chkPaperItem.querySelector(".check-icon").textContent = "✓";
      chkPaperText.textContent = `${preflight.paper_available} Available (Need ${preflight.sheets_needed})`;
    } else {
      chkPaperItem.className = "check-item warn";
      chkPaperItem.querySelector(".check-icon").textContent = "⚠️";
      chkPaperText.textContent = `Low Paper: ${preflight.paper_available} sheets (Need ${preflight.sheets_needed})`;
    }

    if (preflight.printer_online) {
      chkPrinterItem.className = "check-item ok";
      chkPrinterItem.querySelector(".check-icon").textContent = "✓";
      chkPrinterText.textContent = "Online & Ready";
    } else {
      chkPrinterItem.className = "check-item warn";
      chkPrinterItem.querySelector(".check-icon").textContent = "⚠️";
      chkPrinterText.textContent = "Offline";
    }

    if (preflight.can_print) {
      preflightOverallBadge.textContent = "All Systems Ready";
      preflightOverallBadge.className = "preflight-badge-pass";
      btnPayPrint.disabled = false;
    } else {
      preflightOverallBadge.textContent = "Hardware Attention Required";
      preflightOverallBadge.className = "preflight-badge-fail";
      btnPayPrint.disabled = true;
    }

    // Set phone number if job has one
    if (job.phone_number && job.phone_number.length >= 9) {
      momoDigits = job.phone_number.replace(/\D/g, "").split("");
    }
    updateMomoDisplay();
  }

  // MoMo On-Screen Keypad Handler
  function updateMomoDisplay() {
    if (momoDigits.length === 0) {
      momoPhoneDisplay.textContent = "Tap numbers below";
      momoPhoneDisplay.classList.add("empty");
    } else {
      momoPhoneDisplay.textContent = formatPhone(momoDigits.join(""));
      momoPhoneDisplay.classList.remove("empty");
    }
  }

  function formatPhone(digits) {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;
  }

  momoKeypadButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const val = btn.dataset.momo;
      if (val === "CLEAR") {
        momoDigits = [];
        updateMomoDisplay();
        return;
      }
      if (val === "BACK") {
        if (momoDigits.length > 0) {
          momoDigits.pop();
          updateMomoDisplay();
        }
        return;
      }
      if (momoDigits.length < 10) {
        momoDigits.push(val);
        updateMomoDisplay();
      }
    });
  });

  // Back button from summary checkout screen
  btnBackSummary.addEventListener("click", () => {
    if (flowOrigin === "usb") {
      switchView("usb");
    } else {
      switchView("keypad");
    }
  });

  // -------------------------------------------------------------------------
  // SCREEN 5: Pay & Spool Print Pipeline
  // -------------------------------------------------------------------------
  btnPayPrint.addEventListener("click", async () => {
    if (!currentJob) return;

    const phoneStr = momoDigits.join("");
    if (phoneStr.length < 9) {
      alert("Please enter a valid 10-digit Mobile Money phone number.");
      return;
    }

    btnPayPrint.disabled = true;
    switchView("printing");
    await executePrintPipeline(currentJob, phoneStr);
  });

  async function executePrintPipeline(job, phone) {
    // Step 1: Health Check Active
    setPipelineStep(0, "Hardware Pre-Flight Check", "Verifying paper levels and spooler readiness...");
    await sleep(700);

    // Step 2: MoMo Approval USSD Push
    setPipelineStep(1, "Mobile Money USSD Prompt", `USSD prompt dispatched to +233 ${formatPhone(phone)}. Please approve on your phone...`);
    ussdSimCard.style.display = "block";
    ussdPromptMsg.textContent = `"Pay GH₵ ${job.total_price.toFixed(2)} to PrintOS Kiosk #01? Approving simulated transaction..."`;

    // Simulate animated USSD approval fill
    animateProgressBar(ussdProgressFill, 1400);
    await sleep(1500);

    // Step 3: Spooling File & Hardware Print Dispatch
    setPipelineStep(2, "Spooling Document to Printer", "Transferring document stream to local physical print spooler...");
    ussdSimCard.style.display = "none";

    try {
      const res = await fetch(`/api/jobs/${job.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: phone,
          network: "MTN"
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Printing transaction failed." }));
        throw new Error(err.detail);
      }

      const result = await res.json();

      // Step 4: Printing Out & Paper feed
      setPipelineStep(3, "Printing Complete", "Physical sheets fed through output tray. File shredding complete.");
      await sleep(1000);

      // Refresh kiosk telemetry
      fetchKioskStatus();

      // Navigate to Screen 6 Completion Screen
      switchView("completion");

    } catch (err) {
      alert("Print failed: " + err.message);
      switchView("summary");
      btnPayPrint.disabled = false;
    }
  }

  function setPipelineStep(stepIndex, title, desc) {
    printStepTitle.textContent = title;
    printStepDesc.textContent = desc;

    pipeSteps.forEach((step, idx) => {
      if (idx < stepIndex) {
        step.className = "step-node done";
        step.querySelector(".step-circle").textContent = "✓";
      } else if (idx === stepIndex) {
        step.className = "step-node active";
        step.querySelector(".step-circle").textContent = `${idx + 1}`;
      } else {
        step.className = "step-node";
        step.querySelector(".step-circle").textContent = `${idx + 1}`;
      }
    });

    pipeConns.forEach((conn, idx) => {
      if (idx < stepIndex) {
        conn.classList.add("filled");
      } else {
        conn.classList.remove("filled");
      }
    });
  }

  function animateProgressBar(element, durationMs) {
    element.style.width = "0%";
    const start = performance.now();
    function tick(now) {
      const elapsed = now - start;
      const pct = Math.min(100, Math.round((elapsed / durationMs) * 100));
      element.style.width = `${pct}%`;
      if (pct < 100) {
        requestAnimationFrame(tick);
      }
    }
    requestAnimationFrame(tick);
  }

  // -------------------------------------------------------------------------
  // SCREEN 6: Completion Screen & Auto-Reset Logic
  // -------------------------------------------------------------------------
  function startCompletionCountdown() {
    let seconds = 10;
    resetSeconds.textContent = seconds;

    if (completionTimer) clearInterval(completionTimer);

    completionTimer = setInterval(() => {
      seconds--;
      resetSeconds.textContent = seconds;
      if (seconds <= 0) {
        clearInterval(completionTimer);
        completionTimer = null;
        switchView("home");
      }
    }, 1000);
  }

  btnFinishNow.addEventListener("click", () => {
    if (completionTimer) {
      clearInterval(completionTimer);
      completionTimer = null;
    }
    switchView("home");
  });

  // -------------------------------------------------------------------------
  // Technician & Maintenance Admin Modal
  // -------------------------------------------------------------------------
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
        alert("Paper supply restocked to 500 sheets!");
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
        fetchKioskStatus();
      }
    } catch (e) {
      alert("Error toggling mock: " + e.message);
    }
  });

  // -------------------------------------------------------------------------
  // Offline SVG QR Code Generator for Wi-Fi Screen
  // -------------------------------------------------------------------------
  function generateWifiQR() {
    if (!wifiQrCode) return;
    // Generate clean, high-contrast SVG representation
    wifiQrCode.innerHTML = `
      <svg viewBox="0 0 200 200" width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="#FFFFFF"/>
        <!-- Top-Left Finder -->
        <rect x="20" y="20" width="45" height="45" fill="#0F172A" rx="6"/>
        <rect x="28" y="28" width="29" height="29" fill="#FFFFFF" rx="4"/>
        <rect x="34" y="34" width="17" height="17" fill="#0F172A" rx="2"/>

        <!-- Top-Right Finder -->
        <rect x="135" y="20" width="45" height="45" fill="#0F172A" rx="6"/>
        <rect x="143" y="28" width="29" height="29" fill="#FFFFFF" rx="4"/>
        <rect x="149" y="34" width="17" height="17" fill="#0F172A" rx="2"/>

        <!-- Bottom-Left Finder -->
        <rect x="20" y="135" width="45" height="45" fill="#0F172A" rx="6"/>
        <rect x="28" y="143" width="29" height="29" fill="#FFFFFF" rx="4"/>
        <rect x="34" y="149" width="17" height="17" fill="#0F172A" rx="2"/>

        <!-- Data Grid Modules -->
        <rect x="75" y="25" width="12" height="12" fill="#0F172A" rx="2"/>
        <rect x="95" y="25" width="12" height="12" fill="#0F172A" rx="2"/>
        <rect x="115" y="25" width="12" height="12" fill="#0F172A" rx="2"/>
        <rect x="75" y="45" width="12" height="12" fill="#0F172A" rx="2"/>
        <rect x="105" y="45" width="12" height="12" fill="#0F172A" rx="2"/>

        <rect x="25" y="75" width="12" height="12" fill="#0F172A" rx="2"/>
        <rect x="45" y="85" width="12" height="12" fill="#0F172A" rx="2"/>
        <rect x="65" y="75" width="12" height="12" fill="#0F172A" rx="2"/>
        <rect x="85" y="85" width="12" height="12" fill="#0F172A" rx="2"/>
        <rect x="105" y="75" width="12" height="12" fill="#0F172A" rx="2"/>
        <rect x="125" y="85" width="12" height="12" fill="#0F172A" rx="2"/>
        <rect x="145" y="75" width="12" height="12" fill="#0F172A" rx="2"/>
        <rect x="165" y="85" width="12" height="12" fill="#0F172A" rx="2"/>

        <rect x="75" y="105" width="12" height="12" fill="#0F172A" rx="2"/>
        <rect x="95" y="115" width="12" height="12" fill="#0F172A" rx="2"/>
        <rect x="115" y="105" width="12" height="12" fill="#0F172A" rx="2"/>
        <rect x="135" y="115" width="12" height="12" fill="#0F172A" rx="2"/>
        <rect x="155" y="105" width="12" height="12" fill="#0F172A" rx="2"/>

        <rect x="75" y="135" width="12" height="12" fill="#0F172A" rx="2"/>
        <rect x="95" y="145" width="12" height="12" fill="#0F172A" rx="2"/>
        <rect x="115" y="135" width="12" height="12" fill="#0F172A" rx="2"/>
        <rect x="135" y="155" width="12" height="12" fill="#0F172A" rx="2"/>
        <rect x="155" y="135" width="12" height="12" fill="#0F172A" rx="2"/>
        <rect x="165" y="155" width="12" height="12" fill="#0F172A" rx="2"/>
      </svg>
    `;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
});
