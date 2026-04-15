/**
 * @title ThreatRegistry
 * @dev Immutable storage for IoT Honeypot threat logs on Polygon
 */

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract ThreatRegistry is Ownable, ReentrancyGuard, Pausable {

    struct ThreatLog {
        uint256 id;
        uint256 timestamp;
        string attackerIP;
        string attackType;
        uint8 dangerLevel; // 1: Low, 2: Medium, 3: High, 4: Critical
        string deviceId;
    }

    // Mapping of authorized reporter addresses (the Middleware/Bridge wallets)
    mapping(address => bool) public authorizedReporters;

    // Store all threat logs in an array
    ThreatLog[] public threatLogs;

    // Events for real-time monitoring
    event ThreatLogged(uint256 indexed logId, string indexed attackerIP, string attackType, uint8 dangerLevel);
    event ReporterAdded(address indexed reporter);
    event ReporterRemoved(address indexed reporter);

    constructor() {
        // The deployer is the initial owner and authorized reporter
        authorizedReporters[msg.sender] = true;
    }

    modifier onlyAuthorized() {
        require(authorizedReporters[msg.sender], "ThreatRegistry: Caller is not an authorized reporter");
        _;
    }

    /**
     * @dev Log a new threat. Only authorized reporters can call this.
     * @param _attackerIP The IP address of the attacker
     * @param _attackType The type of attack (e.g., "SSH Brute Force")
     * @param _dangerLevel The severity level (1-4)
     * @param _deviceId The unique ID of the ESP32 device
     */
    function logThreat(
        string calldata _attackerIP,
        string calldata _attackType,
        uint8 _dangerLevel,
        string calldata _deviceId
    ) external onlyAuthorized whenNotPaused nonReentrant returns (uint256) {
        uint256 logId = threatLogs.length;

        threatLogs.push(ThreatLog({
            id: logId,
            timestamp: block.timestamp,
            attackerIP: _attackerIP,
            attackType: _attackType,
            dangerLevel: _dangerLevel,
            deviceId: _deviceId
        }));

        emit ThreatLogged(logId, _attackerIP, _attackType, _dangerLevel);
        return logId;
    }

    /**
     * @dev Retrieve a specific log by ID
     */
    function getLog(uint256 _id) external view returns (ThreatLog memory) {
        require(_id < threatLogs.length, "ThreatRegistry: Log ID does not exist");
        return threatLogs[_id];
    }

    /**
     * @dev Get total number of logs stored
     */
    function getTotalLogs() external view returns (uint256) {
        return threatLogs.length;
    }

    // --- Access Control Functions ---

    function addReporter(address _reporter) external onlyOwner {
        authorizedReporters[_reporter] = true;
        emit ReporterAdded(_reporter);
    }

    function removeReporter(address _reporter) external onlyOwner {
        authorizedReporters[_reporter] = false;
        emit ReporterRemoved(_reporter);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
