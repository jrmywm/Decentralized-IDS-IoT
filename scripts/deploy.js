const hre = require("hardhat");

async function main() {
  const [deployer, ...availableReporters] = await hre.ethers.getSigners();
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

  // Make a local deployment immediately demoable with three independent identities.
  // On public networks, enroll and fund reporters through a deliberate governance process instead.
  const reporters = availableReporters.slice(0, 3);
  for (const reporter of reporters) {
    await registry.addReporter(reporter.address);
    await token.transfer(reporter.address, hre.ethers.parseEther("200"));
    await token.connect(reporter).approve(registryAddress, hre.ethers.parseEther("100"));
    await registry.connect(reporter).stake(hre.ethers.parseEther("100"));
    console.log("Demo reporter enrolled and staked:", reporter.address);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
