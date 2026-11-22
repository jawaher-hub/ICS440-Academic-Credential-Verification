// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AcademicCredential {
    
    address public institution;
    string public institutionName;
    string public constant instCode = "8d192376";

    struct Credential {
        bytes32 credentialHash;
        address holderAddress;
        uint256 issueDate;
        bool revoked;
        bool exists;
    }

    mapping(bytes32 => Credential) private credentials;

    event CredentialIssued(
        bytes32 indexed credentialID,
        bytes32 credentialHash,
        address holderAddress
    );

    event CredentialRevoked(bytes32 indexed credentialID);

    modifier onlyInstitution() {
        require(
            msg.sender == institution,
            "Only the institution can do this action"
        );
        _;
    }

    constructor() {
        institution = msg.sender;
        institutionName = "KFUPM-8d192376";
    }

    function issueCredential(
        bytes32 credentialID,
        bytes32 credentialHash,
        address holderAddress
    ) external onlyInstitution {
        require(
            !credentials[credentialID].exists,
            "Credential already exists"
        );

        credentials[credentialID] = Credential({
            credentialHash: credentialHash,
            holderAddress: holderAddress,
            issueDate: block.timestamp,
            revoked: false,
            exists: true
        });

        emit CredentialIssued(
            credentialID,
            credentialHash,
            holderAddress
        );
    }

    function revokeCredential(bytes32 credentialID)
        external
        onlyInstitution
    {
        require(
            credentials[credentialID].exists,
            "Credential does not exist"
        );

        require(
            !credentials[credentialID].revoked,
            "Credential already revoked"
        );

        credentials[credentialID].revoked = true;

        emit CredentialRevoked(credentialID);
    }

    function verifyCredential(
        bytes32 credentialID,
        bytes32 presentedHash
    )
        external
        view
        returns (
            bool exists,
            bool isValid,
            bool hashMatches
        )
    {
        Credential memory credential = credentials[credentialID];

        exists = credential.exists;
        isValid = credential.exists && !credential.revoked;
        hashMatches = credential.exists && credential.credentialHash == presentedHash;
    }

    function getCredentialDetails(bytes32 credentialID)
        external
        view
        returns (
            bytes32 credentialHash,
            address holderAddress,
            uint256 issueDate,
            bool revoked,
            bool exists
        )
    {
        Credential memory credential = credentials[credentialID];

        return (
            credential.credentialHash,
            credential.holderAddress,
            credential.issueDate,
            credential.revoked,
            credential.exists
        );
    }
}
