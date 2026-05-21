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
    uint256 public consensusThreshold = 1; // Default 1 for demo, 3+ for prod
    uint256 public trustedStakeThreshold = 500 * 10**18;
    uint256 public disputeWindow = 100; // block confirmations

    struct PendingReward {
        address reporter;
        uint256 amount;
        uint256 unlockBlock;
    }
    mapping(uint256 => PendingReward) public pendingRewards;

    mapping(address => uint256) public stakedBalances;
    
    // Consensus tracking
    mapping(bytes32 => address[]) public threatReporters;
    mapping(bytes32 => mapping(address => bool)) public hasReported;
    mapping(bytes32 => bool) public isVerified;

    // DAO Slashing Mechanism
    uint256 public slashVotesRequired = 3;
    
    struct SlashProposal {
        address target;
        uint256 amount;
        uint256 votesFor;
        bool executed;
    }
    
    uint256 public nextSlashProposalId;
    mapping(uint256 => SlashProposal) public slashProposals;
    mapping(uint256 => mapping(address => bool)) public hasVotedOnSlash;

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
    event AdminSlashed(address indexed reporter, uint256 amount);
    
    event SlashProposed(uint256 indexed proposalId, address indexed target, uint256 amount);
    event SlashVoted(uint256 indexed proposalId, address indexed voter);
    event SlashExecuted(uint256 indexed proposalId, address indexed target, uint256 amount);

    event OptimisticLog(uint256 indexed logId, address indexed reporter, uint256 unlockBlock);
    event RewardClaimed(uint256 indexed logId, address indexed reporter, uint256 amount);
    event RewardNullified(uint256 indexed logId, address indexed reporter);

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

        // Generate consensus hash (based on IP, attack type, and current hour)
        uint256 timeWindow = block.timestamp / 1 hours;
        bytes32 threatHash = keccak256(abi.encodePacked(_attackerIP, _attackType, timeWindow));

        require(!hasReported[threatHash][msg.sender], "ThreatRegistry: You already reported this threat");
        hasReported[threatHash][msg.sender] = true;
        threatReporters[threatHash].push(msg.sender);

        // Check if consensus threshold is reached OR optimistic trusted log
        if (!isVerified[threatHash]) {
            bool isConsensus = threatReporters[threatHash].length >= consensusThreshold;
            bool isOptimistic = (stakedBalances[msg.sender] >= trustedStakeThreshold);

            if (isConsensus || isOptimistic) {
                isVerified[threatHash] = true;

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

                if (isConsensus) {
                    if (address(rewardToken) != address(0) && rewardToken.balanceOf(address(this)) >= rewardAmount * consensusThreshold) {
                        // Pay all reporters who contributed to consensus
                        for(uint i = 0; i < consensusThreshold; i++) {
                            address reporter = threatReporters[threatHash][i];
                            rewardToken.transfer(reporter, rewardAmount);
                            emit RewardSent(reporter, rewardAmount);
                        }
                    }
                } else {
                    // Optimistic Logging
                    pendingRewards[logId] = PendingReward({
                        reporter: msg.sender,
                        amount: rewardAmount,
                        unlockBlock: block.number + disputeWindow
                    });
                    emit OptimisticLog(logId, msg.sender, block.number + disputeWindow);
                }

                emit ThreatLogged(logId, _attackerIP, _attackType, _dangerLevel);
                return logId;
            }
        }

        // Return a pending status ID if consensus is not yet reached
        return 999999;
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

    function claimReward(uint256 _logId) external nonReentrant whenNotPaused {
        PendingReward storage pending = pendingRewards[_logId];
        require(pending.amount > 0, "ThreatRegistry: No pending reward or already claimed");
        require(pending.reporter == msg.sender, "ThreatRegistry: Not the reporter");
        require(block.number > pending.unlockBlock, "ThreatRegistry: Dispute window not closed");
        
        // If the reporter's stake fell below the trusted threshold (e.g., they were slashed), they forfeit the reward.
        if (stakedBalances[msg.sender] < trustedStakeThreshold) {
            pending.amount = 0;
            emit RewardNullified(_logId, msg.sender);
            return;
        }

        uint256 amountToPay = pending.amount;
        pending.amount = 0; // Prevent reentrancy / double claiming

        require(rewardToken.transfer(msg.sender, amountToPay), "ThreatRegistry: Transfer failed");
        emit RewardClaimed(_logId, msg.sender, amountToPay);
    }

    // --- Staking & DAO Slashing Functions ---

    function stake(uint256 _amount) external {
        require(_amount > 0, "ThreatRegistry: Cannot stake 0");
        require(rewardToken.transferFrom(msg.sender, address(this), _amount), "ThreatRegistry: Transfer failed");
        stakedBalances[msg.sender] += _amount;
        emit Staked(msg.sender, _amount);
    }

    function proposeSlash(address _target, uint256 _amount) external onlyAuthorized {
        require(stakedBalances[msg.sender] >= minimumStake, "Must be staked to propose");
        require(stakedBalances[_target] >= _amount, "Target lacks stake to slash");

        uint256 proposalId = nextSlashProposalId++;
        slashProposals[proposalId] = SlashProposal({
            target: _target,
            amount: _amount,
            votesFor: 0,
            executed: false
        });

        emit SlashProposed(proposalId, _target, _amount);
        voteOnSlash(proposalId); // Auto-vote for the proposer
    }

    function voteOnSlash(uint256 _proposalId) public onlyAuthorized {
        require(stakedBalances[msg.sender] >= minimumStake, "Must be staked to vote");
        SlashProposal storage proposal = slashProposals[_proposalId];
        
        require(!proposal.executed, "Proposal already executed");
        require(!hasVotedOnSlash[_proposalId][msg.sender], "You already voted");

        hasVotedOnSlash[_proposalId][msg.sender] = true;
        proposal.votesFor++;

        emit SlashVoted(_proposalId, msg.sender);

        if (proposal.votesFor >= slashVotesRequired) {
            proposal.executed = true;
            stakedBalances[proposal.target] -= proposal.amount;
            emit SlashExecuted(_proposalId, proposal.target, proposal.amount);
        }
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

    function adminSlash(address _reporter, uint256 _amount) external onlyOwner {
        require(stakedBalances[_reporter] >= _amount, "ThreatRegistry: Insufficient staked balance to slash");
        stakedBalances[_reporter] -= _amount;
        emit AdminSlashed(_reporter, _amount);
    }

    function updateMinimumStake(uint256 _newAmount) external onlyOwner {
        minimumStake = _newAmount;
    }

    function updateConsensusThreshold(uint256 _newThreshold) external onlyOwner {
        require(_newThreshold > 0, "ThreatRegistry: Threshold must be > 0");
        consensusThreshold = _newThreshold;
    }

    function updateSlashVotesRequired(uint256 _newRequired) external onlyOwner {
        require(_newRequired > 0, "ThreatRegistry: Required votes must be > 0");
        slashVotesRequired = _newRequired;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}