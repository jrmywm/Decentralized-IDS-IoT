const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // 1. Deploy IoTToken first
  const IoTToken = await hre.ethers.getContractFactory("IoTToken");
  const token = await IoTToken.deploy();
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("IoTToken deployed to:", tokenAddress);

  // 2. Deploy ThreatRegistry with IoTToken address
  const ThreatRegistry = await hre.ethers.getContractFactory("ThreatRegistry");
  const registry = await ThreatRegistry.deploy(tokenAddress);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("ThreatRegistry deployed to:", registryAddress);

  // 3. Transfer token balance to ThreatRegistry for reward distribution
  const amountToTransfer = hre.ethers.parseEther("500000");
  await token.transfer(registryAddress, amountToTransfer);
  console.log("Successfully sent 500,000 ISEC to ThreatRegistry as reward reserve");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});