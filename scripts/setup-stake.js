const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  // Read address from environment (Must be run after redeployment)
  const tokenAddress = process.env.TOKEN_CONTRACT_ADDRESS;
  const registryAddress = process.env.CONTRACT_ADDRESS;

  if (!tokenAddress || !registryAddress) {
      console.error("Error: TOKEN_CONTRACT_ADDRESS or CONTRACT_ADDRESS is not set in .env");
      process.exit(1);
  }

  console.log("Using account:", deployer.address);
  
  const token = await hre.ethers.getContractAt("IoTToken", tokenAddress);
  const registry = await hre.ethers.getContractAt("ThreatRegistry", registryAddress);

  const stakeAmount = hre.ethers.parseEther("100");

  console.log("1. Approving 100 ISEC transfer to ThreatRegistry...");
  const tx1 = await token.approve(registryAddress, stakeAmount);
  await tx1.wait();
  console.log("Approve successful: ", tx1.hash);

  console.log("2. Staking 100 ISEC as collateral...");
  const tx2 = await registry.stake(stakeAmount);
  await tx2.wait();
  console.log("Stake successful! Transaction: ", tx2.hash);

  const stakedBalance = await registry.stakedBalances(deployer.address);
  console.log(`Current staked balance: ${hre.ethers.formatEther(stakedBalance)} ISEC`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
