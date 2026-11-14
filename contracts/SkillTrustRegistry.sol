// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title SkillTrust Academy certificate registry
/// @notice Personal names and certificate documents MUST remain off chain.
/// IDs are keccak256 hashes of normalized references; payload/document hashes use SHA-256.
contract SkillTrustRegistry {
    address public immutable owner;
    mapping(address => bool) public admins;
    mapping(address => bool) public issuers;

    struct Course { string code; string title; string description; bool active; bool exists; }
    struct Certificate {
        bytes32 courseId;
        address recipient;
        address issuer;
        bytes32 payloadHash;
        bytes32 documentHash;
        uint64 issuedOn;
        uint64 recordedAt;
        uint64 revokedAt;
        bool exists;
    }
    mapping(bytes32 => Course) private courses;
    mapping(bytes32 => Certificate) private certificates;
    bytes32[] private courseIds;
    bytes32[] private certificateIds;
    mapping(address => bytes32[]) private recipientCertificates;
    uint256 public revokedCount;

    error Unauthorized();
    error InvalidInput();
    error AlreadyExists();
    error NotFound();
    error InactiveCourse();
    error AlreadyRevoked();
    error PageTooLarge();

    event AdminUpdated(address indexed account, bool enabled);
    event IssuerUpdated(address indexed account, bool enabled);
    event CourseCreated(bytes32 indexed courseId, string code, string title);
    event CourseStatusUpdated(bytes32 indexed courseId, bool active);
    event CertificateIssued(bytes32 indexed certificateId, bytes32 indexed courseId, address indexed recipient, bytes32 payloadHash);
    event CertificateRevoked(bytes32 indexed certificateId, address indexed admin, uint64 revokedAt);

    constructor() { owner = msg.sender; admins[msg.sender] = true; }
    modifier onlyOwner() { if (msg.sender != owner) revert Unauthorized(); _; }
    modifier onlyAdmin() { if (!admins[msg.sender]) revert Unauthorized(); _; }
    modifier onlyIssuer() { if (!admins[msg.sender] && !issuers[msg.sender]) revert Unauthorized(); _; }

    function setAdmin(address account, bool enabled) external onlyOwner {
        if (account == address(0) || account == owner) revert InvalidInput();
        admins[account] = enabled;
        emit AdminUpdated(account, enabled);
    }
    function setIssuer(address account, bool enabled) external onlyAdmin {
        if (account == address(0)) revert InvalidInput();
        issuers[account] = enabled;
        emit IssuerUpdated(account, enabled);
    }
    function createCourse(string calldata code, string calldata title, string calldata description) external onlyAdmin returns (bytes32 courseId) {
        if (bytes(code).length == 0 || bytes(code).length > 32 || bytes(title).length == 0 || bytes(title).length > 300 || bytes(description).length > 2000) revert InvalidInput();
        // Accept uppercase ASCII course codes only so the reference cannot have aliases.
        for (uint256 i; i < bytes(code).length; ++i) {
            bytes1 c = bytes(code)[i];
            if (!((c >= 0x41 && c <= 0x5a) || (c >= 0x30 && c <= 0x39) || c == 0x2d)) revert InvalidInput();
        }
        courseId = keccak256(bytes(code));
        if (courses[courseId].exists) revert AlreadyExists();
        courses[courseId] = Course(code, title, description, true, true);
        courseIds.push(courseId);
        emit CourseCreated(courseId, code, title);
    }
    function setCourseActive(bytes32 courseId, bool active) external onlyAdmin {
        if (!courses[courseId].exists) revert NotFound();
        courses[courseId].active = active;
        emit CourseStatusUpdated(courseId, active);
    }
    function issueCertificate(bytes32 certificateId, bytes32 courseId, address recipient, bytes32 payloadHash, bytes32 documentHash, uint64 issuedOn) external onlyIssuer {
        if (certificateId == bytes32(0) || payloadHash == bytes32(0) || recipient == address(0) || issuedOn == 0 || issuedOn > block.timestamp) revert InvalidInput();
        if (certificates[certificateId].exists) revert AlreadyExists();
        if (!courses[courseId].exists) revert NotFound();
        if (!courses[courseId].active) revert InactiveCourse();
        certificates[certificateId] = Certificate(courseId, recipient, msg.sender, payloadHash, documentHash, issuedOn, uint64(block.timestamp), 0, true);
        certificateIds.push(certificateId);
        recipientCertificates[recipient].push(certificateId);
        emit CertificateIssued(certificateId, courseId, recipient, payloadHash);
    }
    function revokeCertificate(bytes32 certificateId) external onlyAdmin {
        Certificate storage cert = certificates[certificateId];
        if (!cert.exists) revert NotFound();
        if (cert.revokedAt != 0) revert AlreadyRevoked();
        cert.revokedAt = uint64(block.timestamp);
        ++revokedCount;
        emit CertificateRevoked(certificateId, msg.sender, cert.revokedAt);
    }
    function getCourse(bytes32 courseId) external view returns (Course memory) { return courses[courseId]; }
    function getCertificate(bytes32 certificateId) external view returns (Certificate memory) { return certificates[certificateId]; }
    function courseCount() external view returns (uint256) { return courseIds.length; }
    function certificateCount() external view returns (uint256) { return certificateIds.length; }
    function recipientCertificateCount(address recipient) external view returns (uint256) { return recipientCertificates[recipient].length; }
    function getCourseIds(uint256 offset, uint256 limit) external view returns (bytes32[] memory) { return page(courseIds, offset, limit); }
    function getCertificateIds(uint256 offset, uint256 limit) external view returns (bytes32[] memory) { return page(certificateIds, offset, limit); }
    function getRecipientCertificateIds(address recipient, uint256 offset, uint256 limit) external view returns (bytes32[] memory) { return page(recipientCertificates[recipient], offset, limit); }
    function page(bytes32[] storage ids, uint256 offset, uint256 limit) private view returns (bytes32[] memory result) {
        if (limit > 100) revert PageTooLarge();
        if (offset >= ids.length) return new bytes32[](0);
        uint256 size = ids.length - offset;
        if (size > limit) size = limit;
        result = new bytes32[](size);
        for (uint256 i; i < size; ++i) result[i] = ids[offset + i];
    }
}
