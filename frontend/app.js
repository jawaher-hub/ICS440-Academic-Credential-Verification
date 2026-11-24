let provider = null;
let signer = null;
let contract = null;
let currentAccount = null;

// In-memory store for Mock Mode testing before Sepolia deployment
const mockStore = new Map();

const $ = (id) => document.getElementById(id);

function showAlert(msg) {
  const box = $("alertBox");
  box.textContent = msg;
  box.classList.remove("hidden");
}

function hideAlert() {
  $("alertBox").classList.add("hidden");
}

// Tab switching
document.querySelectorAll(".nav-btn").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.tab).classList.add("active");
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
  $("connectBtn").textContent = "Connect MetaMask";
  $("networkStatus").textContent = CONFIG.USE_MOCK ? "Network: Mock" : "Network: --";
}

async function toggleWalletConnection() {
  // If already connected (in Mock Mode or real MetaMask), disconnect app session
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
    $("connectBtn").textContent = currentAccount ? "Disconnect" : "Connect MetaMask";
    await refreshNetworkAndContract();
  });

  window.ethereum.on("chainChanged", async () => {
    if (!CONFIG.USE_MOCK) {
      await refreshNetworkAndContract();
    }
  });
}

// Issue Credential
$("issueForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const out = $("issueResult");
  out.classList.remove("hidden");

  try {
    const credIdBytes32 = toCredentialIdBytes32($("issueCredId").value);
    const holder = $("issueHolder").value.trim();
    if (!ethers.isAddress(holder)) throw new Error("Invalid holder wallet address.");

    const credHash = computeSaltedCredentialHash({
      studentName: $("issueStudentName").value,
      program: $("issueProgram").value,
      gradDate: $("issueGradDate").value,
      gpa: $("issueGpa").value
    });

    if (CONFIG.USE_MOCK) {
      if (mockStore.has(credIdBytes32)) throw new Error("Credential already exists (mock).");
      mockStore.set(credIdBytes32, {
        credentialHash: credHash,
        holderAddress: holder,
        issueDate: BigInt(Math.floor(Date.now() / 1000)),
        revoked: false,
        exists: true
      });
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
      const readProvider = provider || new ethers.BrowserProvider(window.ethereum);
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
  studentName: "Jawaher Khalid",
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

// Verify: invalid / unissued Jawaher Khalid credential
$("fillSampleInvalidBtn").addEventListener("click", () => {
  $("verifyCredId").value = INVALID_SAMPLE.credId;
  $("verifyStudentName").value = INVALID_SAMPLE.studentName;
  $("verifyProgram").value = INVALID_SAMPLE.program;
  $("verifyGradDate").value = INVALID_SAMPLE.gradDate;
  $("verifyGpa").value = INVALID_SAMPLE.gpa;
});

$("modeBadge").textContent = CONFIG.USE_MOCK ? "Mock Mode" : "Sepolia Live";