const { expect } = require("chai");
const hre = require("hardhat");

describe("Sistem Reward IoT", function () {
  let token;
  let registry;
  let owner;
  let reporter;

  beforeEach(async function () {
    // Ambil akun tester
    [owner, reporter] = await hre.ethers.getSigners();

    // 1. Deploy IoTToken
    const IoTToken = await hre.ethers.getContractFactory("IoTToken");
    token = await IoTToken.deploy();
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();

    // 2. Deploy ThreatRegistry
    const ThreatRegistry = await hre.ethers.getContractFactory("ThreatRegistry");
    registry = await ThreatRegistry.deploy(tokenAddress);
    await registry.waitForDeployment();
    const registryAddress = await registry.getAddress();

    // 3. Persiapan: Kirim saldo ke Registry agar bisa beri reward
    const amountToTransfer = hre.ethers.parseEther("1000");
    await token.transfer(registryAddress, amountToTransfer);

    // 4. Daftarkan reporter
    await registry.addReporter(reporter.address);
  });

  it("Harus mengirim 10 ISEC saat ancaman dilaporkan", async function () {
    const rewardAmount = hre.ethers.parseEther("10");

    // Cek saldo awal reporter
    const saldoAwal = await token.balanceOf(reporter.address);

    // Reporter melaporkan ancaman
    await registry.connect(reporter).logThreat(
      "192.168.1.1",
      "Brute Force",
      3,
      "ESP32_DEV_01"
    );

    // Cek saldo akhir
    const saldoAkhir = await token.balanceOf(reporter.address);
    
    expect(saldoAkhir).to.equal(saldoAwal + rewardAmount);
    console.log(`Berhasil! Reporter menerima: ${hre.ethers.formatEther(rewardAmount)} ISEC`);
  });
});