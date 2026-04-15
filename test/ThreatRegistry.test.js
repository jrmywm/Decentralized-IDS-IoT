const { expect } = require("chai");
const hre = require("hardhat");

describe("ThreatRegistry", function () {
  let ThreatRegistry, registry, owner, reporter, stranger;

  beforeEach(async function () {
    const { ethers } = hre;
    [owner, reporter, stranger] = await ethers.getSigners();

    ThreatRegistry = await ethers.getContractFactory("ThreatRegistry");
    registry = await ThreatRegistry.deploy();
    await registry.waitForDeployment(); // Ethers v6 use this instead of .deployed()

    // Add reporter as an authorized reporter
    await registry.addReporter(reporter.address);
  });

  it("Should initialize with the deployer as owner and reporter", async function () {
    expect(await registry.owner()).to.equal(owner.address);
    expect(await registry.authorizedReporters(owner.address)).to.be.true;
  });

  it("Should allow an authorized reporter to log a threat", async function () {
    const tx = await registry.connect(reporter).logThreat(
      "192.168.1.10",
      "SSH Brute Force",
      3,
      "ESP32_001"
    );

    await tx.wait();
    expect(await registry.getTotalLogs()).to.equal(1);

    const log = await registry.getLog(0);
    expect(log.attackerIP).to.equal("192.168.1.10");
    expect(log.attackType).to.equal("SSH Brute Force");
    expect(log.dangerLevel).to.equal(3);
    expect(log.deviceId).to.equal("ESP32_001");
  });

  it("Should reject threats from unauthorized addresses", async function () {
    await expect(
      registry.connect(stranger).logThreat(
        "1.1.1.1",
        "Port Scan",
        1,
        "ESP32_BAD"
      )
    ).to.be.revertedWith("ThreatRegistry: Caller is not an authorized reporter");
  });

  it("Should allow owner to add/remove reporters", async function () {
    await registry.addReporter(stranger.address);
    expect(await registry.authorizedReporters(stranger.address)).to.be.true;

    await registry.removeReporter(stranger.address);
    expect(await registry.authorizedReporters(stranger.address)).to.be.false;
  });

  it("Should fail when contract is paused", async function () {
    await registry.pause();
    await expect(
      registry.connect(reporter).logThreat(
        "2.2.2.2",
        "Test",
        1,
        "DEV"
      )
    ).to.be.revertedWith("Pausable: paused");
    await registry.unpause();
  });
});
