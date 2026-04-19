const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts dengan akun:", deployer.address);

  // 1. Deploy IoTToken terlebih dahulu
  const IoTToken = await hre.ethers.getContractFactory("IoTToken");
  const token = await IoTToken.deploy();
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("IoTToken deployed ke:", tokenAddress);

  // 2. Deploy ThreatRegistry dengan alamat IoTToken
  const ThreatRegistry = await hre.ethers.getContractFactory("ThreatRegistry");
  const registry = await ThreatRegistry.deploy(tokenAddress);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("ThreatRegistry deployed ke:", registryAddress);

  // 3. Transfer saldo token ke ThreatRegistry agar bisa memberi reward
  const amountToTransfer = hre.ethers.parseEther("500000");
  await token.transfer(registryAddress, amountToTransfer);
  console.log("Berhasil mengirim 500.000 ISEC ke ThreatRegistry sebagai cadangan reward");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});