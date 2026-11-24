const CONFIG = {
  USE_MOCK: false,

  // Sepolia Testnet
  SEPOLIA_CHAIN_ID_HEX: "0xaa36a7", // 11155111
  SEPOLIA_CHAIN_ID_DEC: 11155111n,

  // Group 7 constants from AcademicCredential.sol
  INST_CODE: "8d192376",
  INSTITUTION_NAME: "KFUPM-8d192376",

  // Deployed Sepolia contract address
  CONTRACT_ADDRESS: "0xcB869B7C5cAfB4cc77d78CE338FA77acba42e117",

  // Contract ABI
  ABI: [
    {
      "inputs": [],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "bytes32",
          "name": "credentialID",
          "type": "bytes32"
        },
        {
          "indexed": false,
          "internalType": "bytes32",
          "name": "credentialHash",
          "type": "bytes32"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "holderAddress",
          "type": "address"
        }
      ],
      "name": "CredentialIssued",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "bytes32",
          "name": "credentialID",
          "type": "bytes32"
        }
      ],
      "name": "CredentialRevoked",
      "type": "event"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "credentialID",
          "type": "bytes32"
        },
        {
          "internalType": "bytes32",
          "name": "credentialHash",
          "type": "bytes32"
        },
        {
          "internalType": "address",
          "name": "holderAddress",
          "type": "address"
        }
      ],
      "name": "issueCredential",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "credentialID",
          "type": "bytes32"
        }
      ],
      "name": "revokeCredential",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "credentialID",
          "type": "bytes32"
        }
      ],
      "name": "getCredentialDetails",
      "outputs": [
        {
          "internalType": "bytes32",
          "name": "credentialHash",
          "type": "bytes32"
        },
        {
          "internalType": "address",
          "name": "holderAddress",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "issueDate",
          "type": "uint256"
        },
        {
          "internalType": "bool",
          "name": "revoked",
          "type": "bool"
        },
        {
          "internalType": "bool",
          "name": "exists",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "instCode",
      "outputs": [
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "institution",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "institutionName",
      "outputs": [
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "credentialID",
          "type": "bytes32"
        },
        {
          "internalType": "bytes32",
          "name": "presentedHash",
          "type": "bytes32"
        }
      ],
      "name": "verifyCredential",
      "outputs": [
        {
          "internalType": "bool",
          "name": "exists",
          "type": "bool"
        },
        {
          "internalType": "bool",
          "name": "isValid",
          "type": "bool"
        },
        {
          "internalType": "bool",
          "name": "hashMatches",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ]
};