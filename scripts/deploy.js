import hre from "hardhat";

async function main() {
  console.log("Deploying ThreatRegistry...");

  const ThreatRegistry = await hre.ethers.getContractFactory("ThreatRegistry");
  const registry = await ThreatRegistry.deploy();

  await registry.waitForDeployment();

  console.log("ThreatRegistry deployed to:", await registry.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
