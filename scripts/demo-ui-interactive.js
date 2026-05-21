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

  console.log("=== PREPARING INTERACTIVE UI DEMO ===\n");

  console.log("0. Setting network consensus threshold to 3...");
  await (await registry.updateConsensusThreshold(3)).wait();

  // 1. Stake 500 ISEC
  console.log("1. Upgrading node to 'Trusted' status by staking 500 ISEC...");
  const stakeAmount = hre.ethers.parseEther("500");
  await (await token.approve(registryAddress, stakeAmount)).wait();
  await (await registry.stake(stakeAmount)).wait();
  
  // 2. Log a Targeted Threat
  console.log("2. Detecting and logging a highly targeted Zero-Day Exploit...");
  const randomIp = `192.168.1.${Math.floor(Math.random() * 255)}`;
  const txLog = await registry.logThreat(randomIp, "Zero-Day-RCE", 4, "HONEYPOT-X1");
  await txLog.wait();
  
  const totalLogs = await registry.getTotalLogs();
  const logId = totalLogs - 1n;
  const pending = await registry.pendingRewards(logId);
  console.log(`   [Success] Threat securely logged!`);
  console.log(`   [Action Required] Reward of ${hre.ethers.formatEther(pending.amount)} ISEC is currently timelocked!\n`);

  // 3. Fast-forward blocks
  console.log("3. Simulating 100 block confirmations (Dispute Window passing)...");
  for (let i = 0; i < 101; i++) {
    await hre.network.provider.send("evm_mine");
  }
  console.log("   [Success] 100 blocks have passed. Dispute window is closed.\n");

  console.log("=================================================");
  console.log("[!] UI IS READY!");
  console.log("Go to http://localhost:3000 in your browser.");
  console.log("Click 'Sync with Blockchain', and you will see the CLAIM button!");
  console.log("=================================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
