const { expect } = require("chai");
const hre = require("hardhat");

describe("ThreatRegistry Crypto-Economic Security", function () {
  let ThreatRegistry, registry, IoTToken, token, owner, reporter, stranger;

  beforeEach(async function () {
    const { ethers } = hre;
    [owner, reporter, stranger] = await ethers.getSigners();

    IoTToken = await ethers.getContractFactory("IoTToken");
    token = await IoTToken.deploy();
    await token.waitForDeployment();

    ThreatRegistry = await ethers.getContractFactory("ThreatRegistry");
    registry = await ThreatRegistry.deploy(await token.getAddress());
    await registry.waitForDeployment();

    // Setup Token Distribution & Approvals
    await token.transfer(reporter.address, ethers.parseEther("500"));
    await token.transfer(await registry.getAddress(), ethers.parseEther("500000")); // Reserve
    await token.connect(reporter).approve(await registry.getAddress(), ethers.parseEther("500"));

    // Add reporter
    await registry.addReporter(reporter.address);
  });

  it("Should require staking before logging a threat", async function () {
    await expect(
      registry.connect(reporter).logThreat("1.1.1.1", "Scan", 1, "DEV1")
    ).to.be.revertedWith("ThreatRegistry: Insufficient stake to report");

    // Stake 100 tokens
    await registry.connect(reporter).stake(ethers.parseEther("100"));
    expect(await registry.stakedBalances(reporter.address)).to.equal(ethers.parseEther("100"));

    // Now it should work
    await registry.connect(reporter).logThreat("1.1.1.1", "Scan", 1, "DEV1");
    expect(await registry.getTotalLogs()).to.equal(1);
  });

  it("Should dynamically reward based on danger level", async function () {
    await registry.connect(reporter).stake(ethers.parseEther("100"));
    
    const balanceBefore = await token.balanceOf(reporter.address);
    // Level 1: 5 ISEC
    await registry.connect(reporter).logThreat("IP", "Scan", 1, "DEV");
    const balanceAfter1 = await token.balanceOf(reporter.address);
    expect(balanceAfter1 - balanceBefore).to.equal(ethers.parseEther("5"));

    // Level 4: 50 ISEC
    await registry.connect(reporter).logThreat("IP", "RCE", 4, "DEV");
    const balanceAfter4 = await token.balanceOf(reporter.address);
    expect(balanceAfter4 - balanceAfter1).to.equal(ethers.parseEther("50"));
  });

  it("Should allow owner to slash a malicious reporter using adminSlash", async function () {
    await registry.connect(reporter).stake(ethers.parseEther("100"));
    
    await registry.adminSlash(reporter.address, ethers.parseEther("50"));
    expect(await registry.stakedBalances(reporter.address)).to.equal(ethers.parseEther("50"));

    // Reporter now has < 100 staked, should not be able to log
    await expect(
      registry.connect(reporter).logThreat("IP", "Fake", 4, "DEV")
    ).to.be.revertedWith("ThreatRegistry: Insufficient stake to report");
  });

  it("Should require multiple nodes to reach consensus when threshold > 1", async function () {
    const { ethers } = hre;
    const [, , , reporter2, reporter3] = await ethers.getSigners();
    
    // Setup additional reporters
    await registry.addReporter(reporter2.address);
    await registry.addReporter(reporter3.address);
    
    await token.transfer(reporter2.address, ethers.parseEther("500"));
    await token.transfer(reporter3.address, ethers.parseEther("500"));
    
    await token.connect(reporter2).approve(await registry.getAddress(), ethers.parseEther("500"));
    await token.connect(reporter3).approve(await registry.getAddress(), ethers.parseEther("500"));
    
    await registry.connect(reporter).stake(ethers.parseEther("100"));
    await registry.connect(reporter2).stake(ethers.parseEther("100"));
    await registry.connect(reporter3).stake(ethers.parseEther("100"));
    
    // Update threshold to 3
    await registry.updateConsensusThreshold(3);
    
    // Reporter 1 reports -> No log yet
    await registry.connect(reporter).logThreat("2.2.2.2", "DDoS", 4, "DEV1");
    expect(await registry.getTotalLogs()).to.equal(0);
    
    // Reporter 2 reports -> No log yet
    await registry.connect(reporter2).logThreat("2.2.2.2", "DDoS", 4, "DEV2");
    expect(await registry.getTotalLogs()).to.equal(0);
    
    // Reporter 3 reports -> Consensus Reached!
    await registry.connect(reporter3).logThreat("2.2.2.2", "DDoS", 4, "DEV3");
    expect(await registry.getTotalLogs()).to.equal(1);
    
    // Check if rewards were paid (Level 4 = 50 ISEC)
    // Reporter started with 500, staked 100 (bal=400), earned 50 (bal=450)
    expect(await token.balanceOf(reporter.address)).to.equal(ethers.parseEther("450"));
    expect(await token.balanceOf(reporter2.address)).to.equal(ethers.parseEther("450"));
    expect(await token.balanceOf(reporter3.address)).to.equal(ethers.parseEther("450"));
  });

  it("Should allow DAO to propose and vote to slash a malicious node", async function () {
    const { ethers } = hre;
    const [, , , reporter2, reporter3, maliciousNode] = await ethers.getSigners();
    
    // Setup maliciousNode
    await registry.addReporter(maliciousNode.address);
    await token.transfer(maliciousNode.address, ethers.parseEther("500"));
    await token.connect(maliciousNode).approve(await registry.getAddress(), ethers.parseEther("500"));
    await registry.connect(maliciousNode).stake(ethers.parseEther("100"));
    
    // Ensure reporter, reporter2, reporter3 are staked (from previous tests setup or do it here)
    // Actually, in beforeEach only reporter is added.
    // Let's add them all to be safe.
    await registry.addReporter(reporter2.address);
    await registry.addReporter(reporter3.address);
    
    await token.transfer(reporter2.address, ethers.parseEther("500"));
    await token.transfer(reporter3.address, ethers.parseEther("500"));
    
    await token.connect(reporter2).approve(await registry.getAddress(), ethers.parseEther("500"));
    await token.connect(reporter3).approve(await registry.getAddress(), ethers.parseEther("500"));
    
    await registry.connect(reporter).stake(ethers.parseEther("100"));
    await registry.connect(reporter2).stake(ethers.parseEther("100"));
    await registry.connect(reporter3).stake(ethers.parseEther("100"));

    // Reporter 1 proposes slash against maliciousNode
    await registry.connect(reporter).proposeSlash(maliciousNode.address, ethers.parseEther("100"));
    
    // Currently 1 vote (from proposer). Balance should still be 100.
    expect(await registry.stakedBalances(maliciousNode.address)).to.equal(ethers.parseEther("100"));
    
    // Reporter 2 votes
    await registry.connect(reporter2).voteOnSlash(0);
    expect(await registry.stakedBalances(maliciousNode.address)).to.equal(ethers.parseEther("100"));
    
    // Reporter 3 votes -> Threshold (3) reached! Slash is automatically executed.
    await registry.connect(reporter3).voteOnSlash(0);
    expect(await registry.stakedBalances(maliciousNode.address)).to.equal(0); // 100 ISEC slashed!
  });

  describe("Optimistic Logging (Stake-Weighted Consensus)", function () {
    it("Should not allow standard stake (100 ISEC) to independently log a targeted attack when threshold > 1", async function () {
      await registry.updateConsensusThreshold(3);
      await registry.connect(reporter).stake(ethers.parseEther("100"));
      
      const tx = await registry.connect(reporter).logThreat("3.3.3.3", "Targeted", 4, "DEV_T1");
      await tx.wait();
      
      expect(await registry.getTotalLogs()).to.equal(0);
    });

    it("Should allow trusted stake (500 ISEC) to optimistically log a targeted attack and pend reward", async function () {
      await registry.updateConsensusThreshold(3);
      await registry.connect(reporter).stake(ethers.parseEther("500"));
      
      const tx = await registry.connect(reporter).logThreat("4.4.4.4", "Targeted", 4, "DEV_T2");
      await tx.wait();
      
      expect(await registry.getTotalLogs()).to.equal(1);
      
      const pending = await registry.pendingRewards(0);
      expect(pending.reporter).to.equal(reporter.address);
      expect(pending.amount).to.equal(ethers.parseEther("50")); // Level 4
    });

    it("Should allow claiming the timelocked reward after dispute window", async function () {
      await registry.updateConsensusThreshold(3);
      await registry.connect(reporter).stake(ethers.parseEther("500"));
      
      await registry.connect(reporter).logThreat("5.5.5.5", "Targeted", 4, "DEV_T3");
      const logId = (await registry.getTotalLogs()) - 1n;
      
      // Advance blocks by disputeWindow (100) + 1
      for (let i = 0; i < 101; i++) {
        await hre.network.provider.send("evm_mine");
      }
      
      const balanceBefore = await token.balanceOf(reporter.address);
      await registry.connect(reporter).claimReward(logId);
      const balanceAfter = await token.balanceOf(reporter.address);
      
      expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("50"));
    });

    it("Should forfeit the reward if trusted node is slashed during dispute window", async function () {
      await registry.updateConsensusThreshold(3);
      await registry.connect(reporter).stake(ethers.parseEther("500"));
      
      await registry.connect(reporter).logThreat("6.6.6.6", "Targeted", 4, "DEV_T4");
      const logId = (await registry.getTotalLogs()) - 1n;
      
      // Slash the reporter by 100 ISEC so they fall to 400 (below 500 threshold)
      await registry.adminSlash(reporter.address, ethers.parseEther("100"));
      
      // Advance blocks
      for (let i = 0; i < 101; i++) {
        await hre.network.provider.send("evm_mine");
      }
      
      // Try to claim
      const tx = await registry.connect(reporter).claimReward(logId);
      await tx.wait();
      
      const pending = await registry.pendingRewards(logId);
      expect(pending.amount).to.equal(0n); // Forfeited
    });
  });
});

