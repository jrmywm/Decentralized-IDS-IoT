// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ThreatRegistry is Ownable, ReentrancyGuard, Pausable {

    // Token & Staking Configuration
    IERC20 public rewardToken;
    uint256 public minimumStake = 100 * 10**18; // Default 100 ISEC

    mapping(address => uint256) public stakedBalances;

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
    event Staked(address indexed reporter, uint256 amount);
    event Slashed(address indexed reporter, uint256 amount);

    constructor(address _tokenAddress) {
        authorizedReporters[msg.sender] = true;
        rewardToken = IERC20(_tokenAddress);
    }

    modifier onlyAuthorized() {
        require(authorizedReporters[msg.sender], "ThreatRegistry: Caller is not an authorized reporter");
        _;
    }

    /**
     * @dev Logs a threat and distributes dynamic rewards
     */
    function logThreat(
        string calldata _attackerIP,
        string calldata _attackType,
        uint8 _dangerLevel,
        string calldata _deviceId
    ) external onlyAuthorized whenNotPaused nonReentrant returns (uint256) {
        require(stakedBalances[msg.sender] >= minimumStake, "ThreatRegistry: Insufficient stake to report");

        uint256 logId = threatLogs.length;

        threatLogs.push(ThreatLog({
            id: logId,
            timestamp: block.timestamp,
            attackerIP: _attackerIP,
            attackType: _attackType,
            dangerLevel: _dangerLevel,
            deviceId: _deviceId
        }));

        // Dynamic Reward Logic
        uint256 rewardAmount = _calculateReward(_dangerLevel);

        if (address(rewardToken) != address(0) && rewardToken.balanceOf(address(this)) >= rewardAmount) {
            rewardToken.transfer(msg.sender, rewardAmount);
            emit RewardSent(msg.sender, rewardAmount);
        }

        emit ThreatLogged(logId, _attackerIP, _attackType, _dangerLevel);
        return logId;
    }

    // --- View Functions ---

    function getLog(uint256 _id) external view returns (ThreatLog memory) {
        require(_id < threatLogs.length, "ThreatRegistry: Log ID does not exist");
        return threatLogs[_id];
    }

    function getTotalLogs() external view returns (uint256) {
        return threatLogs.length;
    }

    function _calculateReward(uint8 _dangerLevel) internal pure returns (uint256) {
        if (_dangerLevel == 1) return 5 * 10**18;       // Low: 5 ISEC
        if (_dangerLevel == 2) return 10 * 10**18;      // Medium: 10 ISEC
        if (_dangerLevel == 3) return 25 * 10**18;      // High: 25 ISEC
        if (_dangerLevel >= 4) return 50 * 10**18;      // Critical: 50 ISEC
        return 0;
    }

    // --- Staking Functions ---

    function stake(uint256 _amount) external {
        require(_amount > 0, "ThreatRegistry: Cannot stake 0");
        require(rewardToken.transferFrom(msg.sender, address(this), _amount), "ThreatRegistry: Transfer failed");
        stakedBalances[msg.sender] += _amount;
        emit Staked(msg.sender, _amount);
    }

    // --- Administration Functions (Owner Only) ---

    function addReporter(address _reporter) external onlyOwner {
        authorizedReporters[_reporter] = true;
        emit ReporterAdded(_reporter);
    }

    function removeReporter(address _reporter) external onlyOwner {
        authorizedReporters[_reporter] = false;
        emit ReporterRemoved(_reporter);
    }

    function slash(address _reporter, uint256 _amount) external onlyOwner {
        require(stakedBalances[_reporter] >= _amount, "ThreatRegistry: Insufficient staked balance to slash");
        stakedBalances[_reporter] -= _amount;
        // Tokens remain in the contract effectively acting as a burn/penalty
        emit Slashed(_reporter, _amount);
    }

    function updateMinimumStake(uint256 _newAmount) external onlyOwner {
        minimumStake = _newAmount;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}