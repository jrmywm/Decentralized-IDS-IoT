// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ThreatRegistry is Ownable, ReentrancyGuard, Pausable {

    // Konfigurasi Reward
    IERC20 public rewardToken;
    uint256 public rewardAmount = 10 * 10**18; // Default 10 koin

    struct ThreatLog {
        uint256 id;
        uint256 timestamp;
        string attackerIP;
        string attackType;
        uint8 dangerLevel; // 1: Low, 2: Medium, 3: High, 4: Critical
        string deviceId;
    }

    mapping(address => bool) public authorizedReporters;
    ThreatLog[] public threatLogs;

    event ThreatLogged(uint256 indexed logId, string indexed attackerIP, string attackType, uint8 dangerLevel);
    event ReporterAdded(address indexed reporter);
    event ReporterRemoved(address indexed reporter);
    event RewardSent(address indexed reporter, uint256 amount);

    constructor(address _tokenAddress) {
        authorizedReporters[msg.sender] = true;
        rewardToken = IERC20(_tokenAddress);
    }

    modifier onlyAuthorized() {
        require(authorizedReporters[msg.sender], "ThreatRegistry: Caller is not an authorized reporter");
        _;
    }

    /**
     * @dev Mencatat ancaman dan memberikan reward koin
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

        // Logika Pengiriman Reward
        if (address(rewardToken) != address(0) && rewardToken.balanceOf(address(this)) >= rewardAmount) {
            rewardToken.transfer(msg.sender, rewardAmount);
            emit RewardSent(msg.sender, rewardAmount);
        }

        emit ThreatLogged(logId, _attackerIP, _attackType, _dangerLevel);
        return logId;
    }

    // --- Fungsi View ---

    function getLog(uint256 _id) external view returns (ThreatLog memory) {
        require(_id < threatLogs.length, "ThreatRegistry: Log ID does not exist");
        return threatLogs[_id];
    }

    function getTotalLogs() external view returns (uint256) {
        return threatLogs.length;
    }

    // --- Fungsi Administrasi (Owner Only) ---

    function addReporter(address _reporter) external onlyOwner {
        authorizedReporters[_reporter] = true;
        emit ReporterAdded(_reporter);
    }

    function removeReporter(address _reporter) external onlyOwner {
        authorizedReporters[_reporter] = false;
        emit ReporterRemoved(_reporter);
    }

    function updateRewardAmount(uint256 _newAmount) external onlyOwner {
        rewardAmount = _newAmount;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}