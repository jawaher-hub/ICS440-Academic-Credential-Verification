let provider = null;
let signer = null;
let contract = null;
let currentAccount = null;

// In-memory store for Mock Mode testing before Sepolia deployment
const mockStore = new Map();

// QR scanner state
let cameraStream = null;
let scanAnimationId = null;

const DEFAULT_VERIFY_URL = "https://academic-credential-verification.netlify.app/";

const $ = (id) => document.getElementById(id);

function showAlert(msg) {
  const box = $("alertBox");
  box.textContent = msg;
  box.classList.remove("hidden");
}

function hideAlert() {
  $("alertBox").classList.add("hidden");
}

function setQrStatus(msg, isError = false) {
  const el = $("qrStatusMessage");
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? "#f87171" : "#7dd3fc";
}

function stopCameraScan() {
  if (scanAnimationId) {
    cancelAnimationFrame(scanAnimationId);
    scanAnimationId = null;
  }
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
  if ($("qrCameraWrapper")) $("qrCameraWrapper").classList.add("hidden");
  if ($("startCameraQrBtn")) $("startCameraQrBtn").disabled = false;
  if ($("stopCameraQrBtn")) $("stopCameraQrBtn").disabled = true;
}

function activateTab(tabName) {
  document.querySelectorAll(".nav-btn").forEach((t) => t.classList.remove("active"));
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));

  const targetBtn = document.querySelector(`.nav-btn[data-tab="${tabName}"]`);
  const targetView = $(tabName);
  if (targetBtn) targetBtn.classList.add("active");
  if (targetView) targetView.classList.add("active");

  if (tabName !== "verifier") {
    stopCameraScan();
  }
}

document.querySelectorAll(".nav-btn").forEach((tab) => {
  tab.addEventListener("click", () => {
    activateTab(tab.dataset.tab);
  });
});

async function refreshNetworkAndContract() {
  if (!window.ethereum || CONFIG.USE_MOCK) {
    $("networkStatus").textContent = CONFIG.USE_MOCK ? "Network: Mock" : "Network: --";
    return;
  }

  provider = new ethers.BrowserProvider(window.ethereum);
  const network = await provider.getNetwork();

  if (network.chainId !== BigInt(CONFIG.SEPOLIA_CHAIN_ID_DEC)) {
    $("networkStatus").innerHTML = `<span class="badge badge-err">Wrong Network (${network.chainId})</span>`;
    showAlert("Please switch MetaMask to the Sepolia Test Network.");
    return;
  }

  hideAlert();
  $("networkStatus").innerHTML = `<span class="badge badge-ok">Sepolia</span>`;
  signer = await provider.getSigner();
  contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, CONFIG.ABI, signer);
}

function disconnectWallet() {
  provider = null;
  signer = null;
  contract = null;
  currentAccount = null;
  $("walletAddress").textContent = "Not connected";
  $("connectBtn").textContent = "Connect wallet";
  $("networkStatus").textContent = CONFIG.USE_MOCK ? "Network: Mock" : "Network: --";
}

async function toggleWalletConnection() {
  if (currentAccount) {
    disconnectWallet();
    return;
  }

  if (CONFIG.USE_MOCK) {
    currentAccount = "0xInst1tutionMockAddress000000000000000000001";
    $("walletAddress").textContent = currentAccount;
    $("connectBtn").textContent = "Disconnect";
    return;
  }

  if (!window.ethereum) {
    showAlert("MetaMask is not installed. Please install the MetaMask browser extension.");
    return;
  }

  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  currentAccount = accounts[0];
  $("walletAddress").textContent = currentAccount;
  $("connectBtn").textContent = "Disconnect";
  await refreshNetworkAndContract();
}

$("connectBtn").addEventListener("click", toggleWalletConnection);

if (window.ethereum) {
  window.ethereum.on("accountsChanged", async (accounts) => {
    currentAccount = accounts[0] || null;
    $("walletAddress").textContent = currentAccount || "Not connected";
    $("connectBtn").textContent = currentAccount ? "Disconnect" : "Connect wallet";
    await refreshNetworkAndContract();
  });

  window.ethereum.on("chainChanged", async () => {
    if (!CONFIG.USE_MOCK) {
      await refreshNetworkAndContract();
    }
  });
}

// Selective-Disclosure Smart QR Helpers
function getSelectedQrMode() {
  return document.querySelector('input[name="qrMode"]:checked')?.value || "privacy";
}

function updateQrModeExplanation() {
  const note = $("qrModeExplanation");
  if (!note) return;
  const mode = getSelectedQrMode();
  if (mode === "transcript") {
    note.innerHTML =
      "<strong>Full Transcript QR active:</strong> Embeds <code>credId</code>, <code>instCode</code>, claimed student fields (name, program, graduation date, GPA), and a <code>?qr=</code> deep link so a scan auto-fills and verifies the salted hash in one step—and any field edit in the payload triggers a <strong>Hash Mismatch</strong>.";
  } else {
    note.innerHTML =
      "<strong>Privacy Mode active:</strong> Only <code>credId</code> and <code>instCode</code> are inside the QR code—no student attributes are exposed in the QR payload, so the verifier supplies fields separately.";
  }
}

function getBaseDeployUrl() {
  const originAndPath = `${window.location.origin}${window.location.pathname}`;
  return originAndPath.startsWith("http") ? originAndPath : DEFAULT_VERIFY_URL;
}

function collectCurrentClaimFields(credId) {
  const issueIdVal = ($("issueCredId")?.value || "").trim();
  const matchesIssue = issueIdVal && issueIdVal === credId;

  return {
    studentName: matchesIssue
      ? ($("issueStudentName")?.value || "").trim()
      : ($("verifyStudentName")?.value || $("issueStudentName")?.value || "").trim(),
    program: matchesIssue
      ? ($("issueProgram")?.value || "").trim()
      : ($("verifyProgram")?.value || $("issueProgram")?.value || "").trim(),
    gradDate: matchesIssue
      ? ($("issueGradDate")?.value || "").trim()
      : ($("verifyGradDate")?.value || $("issueGradDate")?.value || "").trim(),
    gpa: matchesIssue
      ? ($("issueGpa")?.value || "").trim()
      : ($("verifyGpa")?.value || $("issueGpa")?.value || "").trim()
  };
}

function buildQrPayload(credId, claimsOverride = null) {
  const cleanId = (credId || "").trim();
  const instCode = CONFIG.INST_CODE || "8d192376";
  const mode = getSelectedQrMode();

  if (mode === "transcript") {
    const claims = claimsOverride || collectCurrentClaimFields(cleanId);
    const transcriptObj = {
      type: "ICS440_FULL_TRANSCRIPT_QR",
      instCode,
      credId: cleanId,
      studentName: claims.studentName,
      program: claims.program,
      gradDate: claims.gradDate,
      gpa: claims.gpa
    };
    const encodedParam = encodeURIComponent(JSON.stringify(transcriptObj));
    const verifyUrl = `${getBaseDeployUrl()}?qr=${encodedParam}`;
    return {
      mode,
      // Embed the deep link URL so standard phone cameras open the verifier directly with ?qr=
      qrValue: verifyUrl,
      verifyUrl,
      jsonPayload: JSON.stringify(transcriptObj, null, 2)
    };
  }

  const privacyObj = {
    type: "ICS440_PRIVACY_ID_QR",
    instCode,
    credId: cleanId
  };
  return {
    mode,
    qrValue: JSON.stringify(privacyObj),
    verifyUrl: null,
    jsonPayload: JSON.stringify(privacyObj, null, 2)
  };
}

function renderCredentialQR(credId, claimsOverride = null) {
  const cleanId = (credId || "").trim();
  const canvasBox = $("qrCodeCanvas");
  const payloadEl = $("qrPayloadText");
  const downloadBtn = $("downloadQrBtn");
  const deepLinkWrap = $("qrDeepLinkWrap");
  const deepLinkAnchor = $("qrDeepLinkAnchor");

  if (!canvasBox || !payloadEl) return;

  if (!cleanId) {
    setQrStatus("Enter a Credential ID before generating a QR code.", true);
    return;
  }

  if (typeof QRCode === "undefined") {
    setQrStatus("QR generator library failed to load.", true);
    return;
  }

  const built = buildQrPayload(cleanId, claimsOverride);
  canvasBox.innerHTML = "";
  new QRCode(canvasBox, {
    text: built.qrValue,
    width: 172,
    height: 172,
    correctLevel: QRCode.CorrectLevel.M
  });

  if ($("qrSourceCredId")) $("qrSourceCredId").value = cleanId;
  payloadEl.textContent = built.mode === "transcript" ? built.jsonPayload : built.qrValue;
  if ($("qrManualPayloadInput")) {
    $("qrManualPayloadInput").value = built.mode === "transcript" ? built.jsonPayload : built.qrValue;
  }

  if (deepLinkWrap && deepLinkAnchor) {
    if (built.verifyUrl) {
      deepLinkAnchor.href = built.verifyUrl;
      deepLinkAnchor.textContent = built.verifyUrl;
      deepLinkWrap.classList.remove("hidden");
    } else {
      deepLinkAnchor.href = "#";
      deepLinkAnchor.textContent = "";
      deepLinkWrap.classList.add("hidden");
    }
  }

  if (downloadBtn) downloadBtn.disabled = false;
  setQrStatus(
    built.mode === "transcript"
      ? `Generated Full Transcript QR + ?qr= deep link for ${cleanId}.`
      : `Generated Privacy Mode (ID-only) QR for ${cleanId}.`
  );
}

function downloadQrPng() {
  const box = $("qrCodeCanvas");
  const img = box?.querySelector("img");
  const canvas = box?.querySelector("canvas");
  const dataUrl = img?.src || canvas?.toDataURL("image/png");
  if (!dataUrl) return;

  const credId = ($("qrSourceCredId")?.value || "credential").trim();
  const mode = getSelectedQrMode();
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `${credId}-${mode}-qr.png`;
  link.click();
}

function parseQrInput(rawText) {
  let trimmed = (rawText || "").trim();
  if (!trimmed) return null;

  // Support full ?qr=... URLs pasted or opened from mobile camera
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const urlObj = new URL(trimmed);
      const qrParam = urlObj.searchParams.get("qr");
      if (qrParam) {
        trimmed = decodeURIComponent(qrParam).trim();
      }
    } catch (_) {
      // Fall through to raw string handling
    }
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object") {
      if (parsed.instCode && CONFIG.INST_CODE && parsed.instCode !== CONFIG.INST_CODE) {
        setQrStatus(
          `Warning: QR institution code (${parsed.instCode}) differs from ${CONFIG.INST_CODE}.`,
          true
        );
      }

      const hasTranscriptFields =
        Object.prototype.hasOwnProperty.call(parsed, "studentName") ||
        Object.prototype.hasOwnProperty.call(parsed, "program") ||
        Object.prototype.hasOwnProperty.call(parsed, "gradDate") ||
        Object.prototype.hasOwnProperty.call(parsed, "gpa");

      return {
        credId: String(parsed.credId || parsed.credentialId || "").trim(),
        hasTranscriptFields,
        studentName: parsed.studentName !== undefined ? String(parsed.studentName) : null,
        program: parsed.program !== undefined ? String(parsed.program) : null,
        gradDate: parsed.gradDate !== undefined ? String(parsed.gradDate) : null,
        gpa: parsed.gpa !== undefined ? String(parsed.gpa) : null
      };
    }
  } catch (_) {
    // Plain text string — treat directly as ID-only lookup
  }

  return {
    credId: trimmed,
    hasTranscriptFields: false,
    studentName: null,
    program: null,
    gradDate: null,
    gpa: null
  };
}

function applyDecodedQrText(rawText, autoVerify = true) {
  const parsed = parseQrInput(rawText);
  if (!parsed || !parsed.credId) {
    setQrStatus("Could not find a valid Credential ID in the QR data.", true);
    return;
  }

  activateTab("verifier");

  const credInput = $("verifyCredId");
  if (credInput) {
    credInput.value = parsed.credId;
    credInput.dispatchEvent(new Event("input", { bubbles: true }));
  }

  if (parsed.hasTranscriptFields) {
    if ($("verifyStudentName") && parsed.studentName !== null) $("verifyStudentName").value = parsed.studentName;
    if ($("verifyProgram") && parsed.program !== null) $("verifyProgram").value = parsed.program;
    if ($("verifyGradDate") && parsed.gradDate !== null) $("verifyGradDate").value = parsed.gradDate;
    if ($("verifyGpa") && parsed.gpa !== null) $("verifyGpa").value = parsed.gpa;
    setQrStatus(
      `Decoded Full Transcript QR for ${parsed.credId} — auto-filled fields and verifying salted hash...`
    );
  } else {
    setQrStatus(
      `Decoded Privacy Mode QR for ${parsed.credId} (ID-only; enter student fields if you want a hash match check).`
    );
  }

  const verifyForm = $("verifyForm");
  if (autoVerify && verifyForm) {
    if (typeof verifyForm.requestSubmit === "function") {
      verifyForm.requestSubmit();
    } else {
      verifyForm.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    }
  }
}

function tickCameraFrame() {
  const video = $("qrVideo");
  const scanCanvas = $("qrScanCanvas");
  if (!cameraStream || !video || !scanCanvas) return;

  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    scanCanvas.width = video.videoWidth;
    scanCanvas.height = video.videoHeight;
    const ctx = scanCanvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, scanCanvas.width, scanCanvas.height);

    const imageData = ctx.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
    const code = typeof jsQR === "function"
      ? jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" })
      : null;

    if (code && code.data) {
      stopCameraScan();
      applyDecodedQrText(code.data, true);
      return;
    }
  }

  scanAnimationId = requestAnimationFrame(tickCameraFrame);
}

async function startCameraScan() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setQrStatus("Camera scanning is unavailable in this browser. Upload a QR image instead.", true);
    return;
  }
  if (typeof jsQR === "undefined") {
    setQrStatus("QR scanner library failed to load.", true);
    return;
  }

  try {
    stopCameraScan();
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }
    });
    const video = $("qrVideo");
    video.srcObject = cameraStream;
    await video.play();

    $("qrCameraWrapper")?.classList.remove("hidden");
    if ($("startCameraQrBtn")) $("startCameraQrBtn").disabled = true;
    if ($("stopCameraQrBtn")) $("stopCameraQrBtn").disabled = false;
    setQrStatus("Camera active — point it at a credential QR code.");

    scanAnimationId = requestAnimationFrame(tickCameraFrame);
  } catch (err) {
    setQrStatus(`Camera error: ${err.message}`, true);
  }
}

function handleQrImageUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (typeof jsQR === "undefined") {
    setQrStatus("QR scanner library failed to load.", true);
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const scanCanvas = $("qrScanCanvas");
      scanCanvas.width = img.width;
      scanCanvas.height = img.height;
      const ctx = scanCanvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code && code.data) {
        applyDecodedQrText(code.data, true);
      } else {
        setQrStatus("Could not detect a QR code in the uploaded image.", true);
      }
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
  event.target.value = "";
}

document.querySelectorAll('input[name="qrMode"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    updateQrModeExplanation();
    const currentId = ($("qrSourceCredId")?.value || $("issueCredId")?.value || "").trim();
    if (currentId) {
      renderCredentialQR(currentId);
    }
  });
});

$("generateQrBtn")?.addEventListener("click", () => renderCredentialQR($("qrSourceCredId")?.value));
$("downloadQrBtn")?.addEventListener("click", downloadQrPng);
$("startCameraQrBtn")?.addEventListener("click", startCameraScan);
$("stopCameraQrBtn")?.addEventListener("click", stopCameraScan);
$("qrFileInput")?.addEventListener("change", handleQrImageUpload);
$("applyQrPayloadBtn")?.addEventListener("click", () => applyDecodedQrText($("qrManualPayloadInput")?.value, true));
window.addEventListener("beforeunload", stopCameraScan);

// Issue Credential
$("issueForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const out = $("issueResult");
  out.classList.remove("hidden");

  try {
    const rawCredId = $("issueCredId").value.trim();
    const credIdBytes32 = toCredentialIdBytes32(rawCredId);
    const holder = $("issueHolder").value.trim();
    if (!ethers.isAddress(holder)) throw new Error("Invalid holder wallet address.");

    const claims = {
      studentName: $("issueStudentName").value,
      program: $("issueProgram").value,
      gradDate: $("issueGradDate").value,
      gpa: $("issueGpa").value
    };
    const credHash = computeSaltedCredentialHash(claims);

    if (CONFIG.USE_MOCK) {
      if (mockStore.has(credIdBytes32)) throw new Error("Credential already exists (mock).");
      mockStore.set(credIdBytes32, {
        credentialHash: credHash,
        holderAddress: holder,
        issueDate: BigInt(Math.floor(Date.now() / 1000)),
        revoked: false,
        exists: true
      });
      renderCredentialQR(rawCredId, claims);
      out.innerHTML = `<span class="badge badge-ok">Issued (Mock)</span><br/>
        <strong>ID (bytes32):</strong> <span class="mono">${credIdBytes32}</span><br/>
        <strong>Salted Hash:</strong> <span class="mono">${credHash}</span>`;
      return;
    }

    if (!contract) {
      await toggleWalletConnection();
      if (!contract) throw new Error("Connect MetaMask on Sepolia before issuing.");
    }

    out.textContent = "Waiting for MetaMask confirmation...";
    const tx = await contract.issueCredential(credIdBytes32, credHash, holder);
    out.textContent = `Transaction sent (${tx.hash}). Waiting for confirmation...`;
    const receipt = await tx.wait();

    renderCredentialQR(rawCredId, claims);
    out.innerHTML = `<span class="badge badge-ok">Issued On-Chain</span><br/>
      <strong>Tx Hash:</strong> <span class="mono">${receipt.hash}</span><br/>
      <strong>ID (bytes32):</strong> <span class="mono">${credIdBytes32}</span><br/>
      <strong>Salted Hash:</strong> <span class="mono">${credHash}</span>`;
  } catch (err) {
    out.innerHTML = `<span class="badge badge-err">Error</span> ${err.shortMessage || err.message}`;
  }
});

// Revoke Credential
$("revokeForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const out = $("revokeResult");
  out.classList.remove("hidden");

  try {
    const credIdBytes32 = toCredentialIdBytes32($("revokeCredId").value);

    if (CONFIG.USE_MOCK) {
      const rec = mockStore.get(credIdBytes32);
      if (!rec || !rec.exists) throw new Error("Credential does not exist (mock).");
      if (rec.revoked) throw new Error("Credential already revoked (mock).");
      rec.revoked = true;
      out.innerHTML = `<span class="badge badge-warn">Revoked (Mock)</span> <span class="mono">${credIdBytes32}</span>`;
      return;
    }

    if (!contract) {
      await toggleWalletConnection();
      if (!contract) throw new Error("Connect MetaMask on Sepolia before revoking.");
    }

    out.textContent = "Waiting for MetaMask confirmation...";
    const tx = await contract.revokeCredential(credIdBytes32);
    out.textContent = `Transaction sent (${tx.hash}). Waiting for confirmation...`;
    const receipt = await tx.wait();

    out.innerHTML = `<span class="badge badge-warn">Revoked On-Chain</span><br/>
      <strong>Tx Hash:</strong> <span class="mono">${receipt.hash}</span>`;
  } catch (err) {
    out.innerHTML = `<span class="badge badge-err">Error</span> ${err.shortMessage || err.message}`;
  }
});

// Verify Credential
$("verifyForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const out = $("verifyResult");
  out.classList.remove("hidden");

  try {
    const credIdBytes32 = toCredentialIdBytes32($("verifyCredId").value);
    const hasFields =
      $("verifyStudentName").value.trim() ||
      $("verifyProgram").value.trim() ||
      $("verifyGradDate").value.trim() ||
      $("verifyGpa").value.trim();

    const presentedHash = hasFields
      ? computeSaltedCredentialHash({
          studentName: $("verifyStudentName").value,
          program: $("verifyProgram").value,
          gradDate: $("verifyGradDate").value,
          gpa: $("verifyGpa").value
        })
      : ethers.ZeroHash;

    let exists, isValid, hashMatches, details;

    if (CONFIG.USE_MOCK) {
      const rec = mockStore.get(credIdBytes32);
      exists = Boolean(rec && rec.exists);
      isValid = Boolean(exists && !rec.revoked);
      hashMatches = Boolean(exists && rec.credentialHash === presentedHash);
      details = rec || {
        credentialHash: ethers.ZeroHash,
        holderAddress: ethers.ZeroAddress,
        issueDate: 0n,
        revoked: false,
        exists: false
      };
    } else {
      const readProvider = provider || (window.ethereum ? new ethers.BrowserProvider(window.ethereum) : null);
      if (!readProvider) {
        throw new Error("Connect MetaMask or open in a Web3-enabled browser to query Sepolia.");
      }
      const readContract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, CONFIG.ABI, readProvider);
      [exists, isValid, hashMatches] = await readContract.verifyCredential(credIdBytes32, presentedHash);
      details = await readContract.getCredentialDetails(credIdBytes32);
    }

    const statusBadge = !exists
      ? `<span class="badge badge-err">Not Found</span>`
      : isValid
      ? `<span class="badge badge-ok">Active & Valid</span>`
      : `<span class="badge badge-warn">Revoked</span>`;

    const hashBadge = !hasFields
      ? `<span class="badge badge-neutral">No Data Presented</span>`
      : hashMatches
      ? `<span class="badge badge-ok">Hash Matches</span>`
      : `<span class="badge badge-err">Hash Mismatch (Tampered / Wrong Data)</span>`;

    const dateStr =
      Number(details.issueDate) > 0
        ? new Date(Number(details.issueDate) * 1000).toLocaleString()
        : "N/A";

    out.innerHTML = `
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">${statusBadge} ${hashBadge}</div>
      <div><strong>ID (bytes32):</strong> <span class="mono">${credIdBytes32}</span></div>
      <div><strong>Holder:</strong> <span class="mono">${details.holderAddress}</span></div>
      <div><strong>Stored Hash:</strong> <span class="mono">${details.credentialHash}</span></div>
      <div><strong>Issue Date:</strong> ${dateStr}</div>
    `;
  } catch (err) {
    out.innerHTML = `<span class="badge badge-err">Error</span> ${err.shortMessage || err.message}`;
  }
});

// Shared sample records (replace "Software Engineering" with your exact Appendix A index 2 program)
const VALID_SAMPLE = {
  credId: "CRED-2026-001",
  holder: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
  studentName: "Dena Alharbi",
  program: "Software Engineering",
  gradDate: "2027-05-15",
  gpa: "3.64"
};

const INVALID_SAMPLE = {
  credId: "CRED-2026-999",
  studentName: "Jawaher Awadallah",
  program: "Software Engineering",
  gradDate: "2027-05-15",
  gpa: "3.90"
};

// Registrar: load Dena Alharbi valid sample for issuing
$("fillIssueSampleBtn").addEventListener("click", () => {
  $("issueCredId").value = VALID_SAMPLE.credId;
  $("issueHolder").value = VALID_SAMPLE.holder;
  $("issueStudentName").value = VALID_SAMPLE.studentName;
  $("issueProgram").value = VALID_SAMPLE.program;
  $("issueGradDate").value = VALID_SAMPLE.gradDate;
  $("issueGpa").value = VALID_SAMPLE.gpa;
  renderCredentialQR(VALID_SAMPLE.credId, {
    studentName: VALID_SAMPLE.studentName,
    program: VALID_SAMPLE.program,
    gradDate: VALID_SAMPLE.gradDate,
    gpa: VALID_SAMPLE.gpa
  });
});

// Verify: valid Dena Alharbi credential
$("fillSampleValidBtn").addEventListener("click", () => {
  $("verifyCredId").value = VALID_SAMPLE.credId;
  $("verifyStudentName").value = VALID_SAMPLE.studentName;
  $("verifyProgram").value = VALID_SAMPLE.program;
  $("verifyGradDate").value = VALID_SAMPLE.gradDate;
  $("verifyGpa").value = VALID_SAMPLE.gpa;
});

// Verify: Dena Alharbi credential ID with tampered GPA
$("fillSampleTamperedBtn").addEventListener("click", () => {
  $("verifyCredId").value = VALID_SAMPLE.credId;
  $("verifyStudentName").value = VALID_SAMPLE.studentName;
  $("verifyProgram").value = VALID_SAMPLE.program;
  $("verifyGradDate").value = VALID_SAMPLE.gradDate;
  $("verifyGpa").value = "4.00";
});

// Verify: invalid / unissued Jawaher Awadallah credential
$("fillSampleInvalidBtn").addEventListener("click", () => {
  $("verifyCredId").value = INVALID_SAMPLE.credId;
  $("verifyStudentName").value = INVALID_SAMPLE.studentName;
  $("verifyProgram").value = INVALID_SAMPLE.program;
  $("verifyGradDate").value = INVALID_SAMPLE.gradDate;
  $("verifyGpa").value = INVALID_SAMPLE.gpa;
});

// Handle ?qr= deep link on page load (e.g., from a phone camera scan)
window.addEventListener("DOMContentLoaded", () => {
  updateQrModeExplanation();
  $("modeBadge").textContent = CONFIG.USE_MOCK ? "Mock Mode" : "Sepolia Live";

  const params = new URLSearchParams(window.location.search);
  const qrParam = params.get("qr");
  if (qrParam) {
    if ($("qrManualPayloadInput")) $("qrManualPayloadInput").value = qrParam;
    applyDecodedQrText(qrParam, true);
  }
});