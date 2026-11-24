// Converts a plain ID like "CRED-2026-001" to bytes32, or passes through an existing 66-char 0x... bytes32
function toCredentialIdBytes32(rawId) {
  const trimmed = rawId.trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return ethers.id(trimmed);
}

// Prepends instCode as a salt before hashing credential payload into bytes32
function computeSaltedCredentialHash({ studentName, program, gradDate, gpa }, instCode = CONFIG.INST_CODE) {
  const payload = [
    instCode.trim(),
    studentName.trim(),
    program.trim(),
    gradDate.trim(),
    String(gpa).trim()
  ].join("|");

  return ethers.keccak256(ethers.toUtf8Bytes(payload));
}