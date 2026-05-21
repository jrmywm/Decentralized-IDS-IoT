const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  const tokenAddress = process.env.TOKEN_CONTRACT_ADDRESS;
  const registryAddress = process.env.CONTRACT_ADDRESS;

  if (!tokenAddress || !registryAddress) {
      console.error("Error: TOKEN_CONTRACT_ADDRESS or CONTRACT_ADDRESS is not set in .env");
      process.exit(1);
  }

  const token = await hre.ethers.getContractAt("IoTToken", tokenAddress);
  const registry = await hre.ethers.getContractAt("ThreatRegistry", registryAddress);

  console.log("=== DEMO: STAKE-WEIGHTED OPTIMISTIC CONSENSUS ===\n");

  console.log("0. Setting network consensus threshold to 3 (Production Mode)...");
  await (await registry.updateConsensusThreshold(3)).wait();

  // 1. Stake 500 ISEC to become a Trusted Node
  console.log("1. Upgrading node to 'Trusted' status by staking 500 ISEC...");
  const stakeAmount = hre.ethers.parseEther("500");
  await (await token.approve(registryAddress, stakeAmount)).wait();
  await (await registry.stake(stakeAmount)).wait();
  
  const stakedBal = await registry.stakedBalances(deployer.address);
  console.log(`   [Success] Staked Balance: ${hre.ethers.formatEther(stakedBal)} ISEC (Trusted Node)\n`);

  // 2. Log a Targeted Threat
  console.log("2. Detecting and logging a highly targeted Zero-Day Exploit...");
  const randomIp = `192.168.1.${Math.floor(Math.random() * 255)}`;
  const txLog = await registry.logThreat(randomIp, "Zero-Day-RCE", 4, "HONEYPOT-X1");
  await txLog.wait();
  
  const totalLogs = await registry.getTotalLogs();
  console.log(`   [Success] Threat securely logged! Total network logs: ${totalLogs}`);

  // 3. Check Pending Reward
  const logId = totalLogs - 1n;
  const pending = await registry.pendingRewards(logId);
  console.log(`   [Action Required] Reward of ${hre.ethers.formatEther(pending.amount)} ISEC is currently timelocked for dispute window!`);
  console.log(`   Unlock Block: ${pending.unlockBlock}\n`);

  // 4. Fast-forward blocks (Simulating time passing)
  console.log("3. Simulating 100 block confirmations (Dispute Window passing)...");
  for (let i = 0; i < 101; i++) {
    await hre.network.provider.send("evm_mine");
  }
  console.log("   [Success] 100 blocks have passed. Dispute window is closed.\n");

  // 5. Claim Reward
  const balanceBefore = await token.balanceOf(deployer.address);
  console.log("4. Claiming the timelocked reward...");
  const txClaim = await registry.claimReward(logId);
  await txClaim.wait();

  const balanceAfter = await token.balanceOf(deployer.address);
  const earned = balanceAfter - balanceBefore;
  console.log(`   [Success] Reward claimed! Node earned: ${hre.ethers.formatEther(earned)} ISEC`);
  console.log("\n=== DEMO COMPLETE ===");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
