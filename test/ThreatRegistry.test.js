const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("ThreatRegistry", function () {
  let token, registry, relay, r1, r2, r3, challenger;
  beforeEach(async () => {
    [, relay, r1, r2, r3, challenger] = await ethers.getSigners();
    token = await (await ethers.getContractFactory("IoTToken")).deploy();
    registry = await (await ethers.getContractFactory("ThreatRegistry")).deploy(await token.getAddress());
    await token.transfer(await registry.getAddress(), ethers.parseEther("10000"));
    for (const reporter of [r1, r2, r3, challenger]) {
      await registry.addReporter(reporter.address);
      await token.transfer(reporter.address, ethers.parseEther("600"));
      await token.connect(reporter).approve(await registry.getAddress(), ethers.parseEther("600"));
      await registry.connect(reporter).stake(ethers.parseEther(reporter === challenger ? "150" : "100"));
    }
  });
  async function now() { return (await ethers.provider.getBlock("latest")).timestamp; }
  async function report(signer, severity = 3, ip = "203.0.113.7", type = "ssh-bruteforce", at) {
    return registry.connect(signer).logThreat(ip, type, severity, `sensor-${signer.address.slice(-4)}`, at ?? await now());
  }

  it("validates severity and does not merge severity disagreements", async () => {
    const at = await now();
    await report(r1, 2, undefined, undefined, at);
    await report(r2, 3, undefined, undefined, at);
    await report(r3, 3, undefined, undefined, at);
    expect(await registry.getTotalLogs()).to.equal(0);
    await expect(report(r1, 0, "x", "y", at)).to.be.revertedWith("severity must be 1..4");
  });

  it("reaches three-reporter consensus and rewards every contributor", async () => {
    const at = await now(); const before = await token.balanceOf(r1.address);
    await report(r1, 3, undefined, undefined, at);
    await report(r2, 3, undefined, undefined, at);
    await report(r3, 3, undefined, undefined, at);
    expect(await registry.getTotalLogs()).to.equal(1);
    expect((await registry.getLog(0)).status).to.equal(0);
    expect(await token.balanceOf(r1.address)).to.equal(before + ethers.parseEther("25"));
  });

  it("accepts EIP-712 device identities through an untrusted relay and prevents replay", async () => {
    const observedAt = await now();
    const domain = { name: "ThreatRegistry", version: "1", chainId: (await ethers.provider.getNetwork()).chainId, verifyingContract: await registry.getAddress() };
    const types = { ThreatReport: [
      { name: "attackerIPHash", type: "bytes32" }, { name: "attackTypeHash", type: "bytes32" },
      { name: "dangerLevel", type: "uint8" }, { name: "deviceIdHash", type: "bytes32" },
      { name: "observedAt", type: "uint256" }, { name: "nonce", type: "uint256" }
    ]};
    const data = ["198.51.100.9", "port-scan", "sensor-alpha"];
    const value = { attackerIPHash: ethers.id(data[0]), attackTypeHash: ethers.id(data[1]), dangerLevel: 2, deviceIdHash: ethers.id(data[2]), observedAt, nonce: 0 };
    const signature = await r1.signTypedData(domain, types, value);
    await registry.connect(relay).submitSignedThreat(r1.address, data[0], data[1], 2, data[2], observedAt, 0, signature);
    expect(await registry.reportNonces(r1.address)).to.equal(1);
    await expect(registry.connect(relay).submitSignedThreat(r1.address, data[0], data[1], 2, data[2], observedAt, 0, signature)).to.be.revertedWith("invalid nonce");
  });

  it("enforces delayed unstaking and blocks reports during the delay", async () => {
    await registry.connect(r1).requestUnstake(ethers.parseEther("100"));
    await expect(report(r1)).to.be.revertedWith("withdrawal pending");
    await expect(registry.connect(r1).executeUnstake()).to.be.revertedWith("withdrawal not ready");
    await network.provider.send("hardhat_mine", ["0x66"]);
    await registry.connect(r1).executeUnstake();
    expect(await registry.stakedBalances(r1.address)).to.equal(0);
  });

  it("handles a bonded challenge that rejects a false optimistic report", async () => {
    await registry.connect(r1).stake(ethers.parseEther("400"));
    await report(r1, 4);
    await expect(registry.connect(r1).requestUnstake(1)).to.be.revertedWith("optimistic report unresolved");
    const before = await registry.stakedBalances(challenger.address);
    await registry.connect(challenger).challengeReport(0, ethers.id("pcap evidence"));
    expect((await registry.getLog(0)).status).to.equal(2);
    await registry.resolveChallenge(0, true);
    expect((await registry.getLog(0)).status).to.equal(3);
    expect(await registry.stakedBalances(challenger.address)).to.equal(before + ethers.parseEther("25"));
    await expect(registry.connect(r1).claimReward(0)).to.be.revertedWith("reward unavailable");
  });

  it("penalizes a failed challenge and releases the optimistic reward after the window", async () => {
    await registry.connect(r1).stake(ethers.parseEther("400"));
    await report(r1, 4); const staked = await registry.stakedBalances(r1.address);
    await registry.connect(challenger).challengeReport(0, ethers.id("weak evidence"));
    await registry.resolveChallenge(0, false);
    expect(await registry.stakedBalances(r1.address)).to.equal(staked + ethers.parseEther("25"));
    await network.provider.send("hardhat_mine", ["0x66"]);
    const before = await token.balanceOf(r1.address);
    await registry.connect(r1).claimReward(0);
    expect(await token.balanceOf(r1.address)).to.equal(before + ethers.parseEther("50"));
  });

  it("accounts for deposits separately from the reward reserve", async () => {
    const reserve = await registry.availableRewardReserve();
    expect(reserve).to.equal(ethers.parseEther("10000"));
    expect(await token.balanceOf(await registry.getAddress())).to.equal(reserve + await registry.totalStaked());
  });
});
