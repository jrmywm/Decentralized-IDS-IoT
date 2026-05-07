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

  it("Should allow owner to slash a malicious reporter", async function () {
    await registry.connect(reporter).stake(ethers.parseEther("100"));
    
    await registry.slash(reporter.address, ethers.parseEther("50"));
    expect(await registry.stakedBalances(reporter.address)).to.equal(ethers.parseEther("50"));

    // Reporter now has < 100 staked, should not be able to log
    await expect(
      registry.connect(reporter).logThreat("IP", "Fake", 4, "DEV")
    ).to.be.revertedWith("ThreatRegistry: Insufficient stake to report");
  });
});
