const CONFIG = {
  // Flip to false once your teammate sends the final Sepolia address and ABI
  USE_MOCK: true,

  // Sepolia Testnet
  SEPOLIA_CHAIN_ID_HEX: "0xaa36a7", // 11155111
  SEPOLIA_CHAIN_ID_DEC: 11155111n,

  // Group-specific constants from AcademicCredential.sol
  INST_CODE: "8d192376",
  INSTITUTION_NAME: "KFUPM-8d192376",

  // Replace with deployed Sepolia contract address
  CONTRACT_ADDRESS: "0x0000000000000000000000000000000000000000",

  // Replace or sync with exact ABI from Remix/Hardhat after final compile
  ABI: [
    "function institution() view returns (address)",
    "function institutionName() view returns (string)",
    "function instCode() view returns (string)",
    "function issueCredential(bytes32 credentialID, bytes32 credentialHash, address holderAddress)",
    "function revokeCredential(bytes32 credentialID)",
    "function verifyCredential(bytes32 credentialID, bytes32 presentedHash) view returns (bool exists, bool isValid, bool hashMatches)",
    "function getCredentialDetails(bytes32 credentialID) view returns (bytes32 credentialHash, address holderAddress, uint256 issueDate, bool revoked, bool exists)",
    "event CredentialIssued(bytes32 indexed credentialID, bytes32 credentialHash, address holderAddress)",
    "event CredentialRevoked(bytes32 indexed credentialID)"
  ]
};