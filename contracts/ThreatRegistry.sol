// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/** Educational registry demonstrating staked consensus and disputes; not production IDS infrastructure. */
contract ThreatRegistry is Ownable, Pausable, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;

    enum LogStatus { Verified, Optimistic, Challenged, Rejected }
    struct ThreatLog {
        uint256 id; uint256 timestamp; string attackerIP; string attackType;
        uint8 dangerLevel; string deviceId; address reporter; LogStatus status;
    }
    struct PendingReward {
        address reporter; uint256 amount; uint256 unlockBlock; address challenger;
        uint256 challengeBond; bytes32 challengeEvidence;
    }
    struct WithdrawalRequest { uint256 amount; uint256 availableBlock; }

    bytes32 public constant REPORT_TYPEHASH = keccak256(
        "ThreatReport(bytes32 attackerIPHash,bytes32 attackTypeHash,uint8 dangerLevel,bytes32 deviceIdHash,uint256 observedAt,uint256 nonce)"
    );
    IERC20 public immutable rewardToken;
    uint256 public minimumStake = 100 ether;
    uint256 public trustedStakeThreshold = 500 ether;
    uint256 public consensusThreshold = 3;
    uint256 public disputeWindow = 100;
    uint256 public withdrawalDelay = 100;
    uint256 public challengeBond = 25 ether;
    uint256 public totalStaked;

    mapping(address => bool) public authorizedReporters;
    mapping(address => uint256) public stakedBalances;
    mapping(address => uint256) public reportNonces;
    mapping(address => uint256) public activeOptimisticReports;
    mapping(address => WithdrawalRequest) public withdrawalRequests;
    mapping(bytes32 => address[]) private threatReporters;
    mapping(bytes32 => mapping(address => bool)) public hasReported;
    mapping(bytes32 => bool) public isVerified;
    mapping(uint256 => PendingReward) public pendingRewards;
    ThreatLog[] private threatLogs;

    event ReporterAdded(address indexed reporter);
    event ReporterRemoved(address indexed reporter);
    event Staked(address indexed reporter, uint256 amount);
    event WithdrawalRequested(address indexed reporter, uint256 amount, uint256 availableBlock);
    event Unstaked(address indexed reporter, uint256 amount);
    event ObservationSubmitted(bytes32 indexed observationId, address indexed reporter, uint256 count);
    event ThreatLogged(uint256 indexed logId, bytes32 indexed observationId, address indexed reporter, uint8 dangerLevel, LogStatus status);
    event RewardSent(address indexed reporter, uint256 amount);
    event RewardClaimed(uint256 indexed logId, address indexed reporter, uint256 amount);
    event ChallengeOpened(uint256 indexed logId, address indexed challenger, bytes32 evidenceHash);
    event ChallengeResolved(uint256 indexed logId, bool reportRejected, uint256 slashedAmount);

    constructor(address tokenAddress) EIP712("ThreatRegistry", "1") {
        require(tokenAddress != address(0), "token is zero address");
        rewardToken = IERC20(tokenAddress);
        authorizedReporters[msg.sender] = true;
    }
    modifier onlyReporter() { require(authorizedReporters[msg.sender], "not an authorized reporter"); _; }

    function logThreat(string calldata attackerIP, string calldata attackType, uint8 dangerLevel,
        string calldata deviceId, uint256 observedAt) external onlyReporter whenNotPaused nonReentrant returns (uint256) {
        return _record(msg.sender, attackerIP, attackType, dangerLevel, deviceId, observedAt);
    }

    /** Any account may relay a report, but the staked reporter must sign its exact contents. */
    function submitSignedThreat(address reporter, string calldata attackerIP, string calldata attackType,
        uint8 dangerLevel, string calldata deviceId, uint256 observedAt, uint256 nonce,
        bytes calldata signature) external whenNotPaused nonReentrant returns (uint256) {
        require(authorizedReporters[reporter], "not an authorized reporter");
        require(nonce == reportNonces[reporter], "invalid nonce");
        bytes32 structHash = keccak256(abi.encode(REPORT_TYPEHASH, keccak256(bytes(attackerIP)),
            keccak256(bytes(attackType)), dangerLevel, keccak256(bytes(deviceId)), observedAt, nonce));
        require(ECDSA.recover(_hashTypedDataV4(structHash), signature) == reporter, "invalid reporter signature");
        reportNonces[reporter] = nonce + 1;
        return _record(reporter, attackerIP, attackType, dangerLevel, deviceId, observedAt);
    }

    function _record(address reporter, string calldata attackerIP, string calldata attackType,
        uint8 dangerLevel, string calldata deviceId, uint256 observedAt) internal returns (uint256) {
        require(stakedBalances[reporter] >= minimumStake, "insufficient stake");
        require(withdrawalRequests[reporter].amount == 0, "withdrawal pending");
        require(dangerLevel >= 1 && dangerLevel <= 4, "severity must be 1..4");
        require(bytes(attackerIP).length > 0 && bytes(attackerIP).length <= 64, "invalid attacker IP length");
        require(bytes(attackType).length > 0 && bytes(attackType).length <= 64, "invalid attack type length");
        require(bytes(deviceId).length > 0 && bytes(deviceId).length <= 64, "invalid device ID length");
        require(observedAt <= block.timestamp + 5 minutes && observedAt + 1 hours >= block.timestamp, "observation timestamp out of range");
        bytes32 observationId = keccak256(abi.encode(keccak256(bytes(attackerIP)),
            keccak256(bytes(attackType)), dangerLevel, observedAt / 5 minutes));
        require(!hasReported[observationId][reporter], "duplicate observation");
        hasReported[observationId][reporter] = true;
        threatReporters[observationId].push(reporter);
        emit ObservationSubmitted(observationId, reporter, threatReporters[observationId].length);
        if (isVerified[observationId]) return type(uint256).max;
        bool reachedConsensus = threatReporters[observationId].length >= consensusThreshold;
        bool optimistic = stakedBalances[reporter] >= trustedStakeThreshold;
        if (!reachedConsensus && !optimistic) return type(uint256).max;
        isVerified[observationId] = true;
        uint256 logId = threatLogs.length;
        LogStatus status = reachedConsensus ? LogStatus.Verified : LogStatus.Optimistic;
        threatLogs.push(ThreatLog(logId, block.timestamp, attackerIP, attackType, dangerLevel, deviceId, reporter, status));
        uint256 reward = _rewardFor(dangerLevel);
        if (reachedConsensus) {
            require(_availableRewards() >= reward * consensusThreshold, "insufficient reward reserve");
            for (uint256 i; i < consensusThreshold; ++i) {
                rewardToken.safeTransfer(threatReporters[observationId][i], reward);
                emit RewardSent(threatReporters[observationId][i], reward);
            }
        } else {
            pendingRewards[logId] = PendingReward(reporter, reward, block.number + disputeWindow, address(0), 0, bytes32(0));
            activeOptimisticReports[reporter] += 1;
        }
        emit ThreatLogged(logId, observationId, reporter, dangerLevel, status);
        return logId;
    }

    function challengeReport(uint256 logId, bytes32 evidenceHash) external onlyReporter whenNotPaused nonReentrant {
        require(logId < threatLogs.length, "log does not exist");
        ThreatLog storage item = threatLogs[logId];
        PendingReward storage pending = pendingRewards[logId];
        require(item.status == LogStatus.Optimistic, "report is not challengeable");
        require(block.number <= pending.unlockBlock, "dispute window closed");
        require(msg.sender != pending.reporter, "reporter cannot challenge self");
        require(stakedBalances[msg.sender] >= minimumStake + challengeBond, "insufficient challenge stake");
        require(evidenceHash != bytes32(0), "evidence hash required");
        stakedBalances[msg.sender] -= challengeBond;
        pending.challenger = msg.sender; pending.challengeBond = challengeBond; pending.challengeEvidence = evidenceHash;
        item.status = LogStatus.Challenged;
        emit ChallengeOpened(logId, msg.sender, evidenceHash);
    }

    /** Demo governance: the owner arbitrates using evidence referenced by its hash. */
    function resolveChallenge(uint256 logId, bool rejectReport) external onlyOwner nonReentrant {
        require(logId < threatLogs.length, "log does not exist");
        ThreatLog storage item = threatLogs[logId]; PendingReward storage pending = pendingRewards[logId];
        require(item.status == LogStatus.Challenged, "report is not challenged");
        uint256 slashed;
        if (rejectReport) {
            item.status = LogStatus.Rejected;
            slashed = stakedBalances[pending.reporter] < challengeBond ? stakedBalances[pending.reporter] : challengeBond;
            stakedBalances[pending.reporter] -= slashed;
            stakedBalances[pending.challenger] += pending.challengeBond + slashed;
            pending.amount = 0;
            activeOptimisticReports[pending.reporter] -= 1;
            pending.challengeBond = 0;
        } else {
            item.status = LogStatus.Optimistic;
            stakedBalances[pending.reporter] += pending.challengeBond;
            pending.challengeBond = 0; pending.challenger = address(0); pending.challengeEvidence = bytes32(0);
        }
        emit ChallengeResolved(logId, rejectReport, slashed);
    }

    function claimReward(uint256 logId) external whenNotPaused nonReentrant {
        require(logId < threatLogs.length, "log does not exist");
        PendingReward storage pending = pendingRewards[logId];
        require(threatLogs[logId].status == LogStatus.Optimistic, "reward unavailable");
        require(pending.reporter == msg.sender && pending.amount > 0, "no reward for caller");
        require(block.number > pending.unlockBlock, "dispute window open");
        require(_availableRewards() >= pending.amount, "insufficient reward reserve");
        uint256 amount = pending.amount; pending.amount = 0;
        activeOptimisticReports[msg.sender] -= 1;
        rewardToken.safeTransfer(msg.sender, amount);
        emit RewardClaimed(logId, msg.sender, amount);
    }

    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "amount is zero");
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
        stakedBalances[msg.sender] += amount; totalStaked += amount;
        emit Staked(msg.sender, amount);
    }
    function requestUnstake(uint256 amount) external {
        require(amount > 0 && amount <= stakedBalances[msg.sender], "invalid unstake amount");
        require(activeOptimisticReports[msg.sender] == 0, "optimistic report unresolved");
        require(withdrawalRequests[msg.sender].amount == 0, "withdrawal already pending");
        withdrawalRequests[msg.sender] = WithdrawalRequest(amount, block.number + withdrawalDelay);
        emit WithdrawalRequested(msg.sender, amount, block.number + withdrawalDelay);
    }
    function executeUnstake() external nonReentrant {
        WithdrawalRequest memory request = withdrawalRequests[msg.sender];
        require(request.amount > 0 && block.number > request.availableBlock, "withdrawal not ready");
        delete withdrawalRequests[msg.sender];
        stakedBalances[msg.sender] -= request.amount; totalStaked -= request.amount;
        rewardToken.safeTransfer(msg.sender, request.amount);
        emit Unstaked(msg.sender, request.amount);
    }

    function getLog(uint256 id) external view returns (ThreatLog memory) { require(id < threatLogs.length, "log does not exist"); return threatLogs[id]; }
    function getTotalLogs() external view returns (uint256) { return threatLogs.length; }
    function getObservationReporterCount(bytes32 id) external view returns (uint256) { return threatReporters[id].length; }
    function availableRewardReserve() external view returns (uint256) { return _availableRewards(); }
    function _availableRewards() internal view returns (uint256) { uint256 b = rewardToken.balanceOf(address(this)); return b > totalStaked ? b - totalStaked : 0; }
    function _rewardFor(uint8 severity) internal pure returns (uint256) { if (severity == 1) return 5 ether; if (severity == 2) return 10 ether; if (severity == 3) return 25 ether; return 50 ether; }

    function addReporter(address reporter) external onlyOwner { require(reporter != address(0), "reporter is zero"); authorizedReporters[reporter] = true; emit ReporterAdded(reporter); }
    function removeReporter(address reporter) external onlyOwner { authorizedReporters[reporter] = false; emit ReporterRemoved(reporter); }
    function updateConsensusThreshold(uint256 value) external onlyOwner { require(value >= 2 && value <= 20, "threshold must be 2..20"); consensusThreshold = value; }
    function updateMinimumStake(uint256 value) external onlyOwner { require(value > 0, "stake is zero"); minimumStake = value; }
    function updateTrustedStakeThreshold(uint256 value) external onlyOwner { require(value >= minimumStake, "trusted stake too low"); trustedStakeThreshold = value; }
    function updateChallengeBond(uint256 value) external onlyOwner { require(value > 0, "bond is zero"); challengeBond = value; }
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
