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

  console.log("=== PREPARING RANDOMIZED TRAFFIC DEMO ===\n");

  console.log("0. Setting network consensus threshold to 3 to enable Optimistic Timelocks...");
  await (await registry.updateConsensusThreshold(3)).wait();

  // 1. Ensure node is staked
  const currentStake = await registry.stakedBalances(deployer.address);
  if (currentStake < hre.ethers.parseEther("500")) {
      console.log("1. Upgrading node to 'Trusted' status by staking 500 ISEC...");
      const stakeAmount = hre.ethers.parseEther("500");
      await (await token.approve(registryAddress, stakeAmount)).wait();
      await (await registry.stake(stakeAmount)).wait();
  } else {
      console.log("1. Node is already Trusted. Proceeding...");
  }

  // Helper arrays for randomization
  const attackTypes = ["DDoS-TCP-SYN", "SQL-Injection", "Brute-Force-SSH", "Zero-Day-RCE", "Ransomware-Payload", "Port-Scan-Sweep", "IoT-Mirai-Botnet"];
  const devices = ["HONEYPOT-X1", "EDGE-ROUTER-4", "IOT-CAMERA-9", "SMART-THERMOSTAT", "INDUSTRIAL-PLC"];
  
  const numThreats = Math.floor(Math.random() * 5) + 6; // Generate 6 to 10 threats
  console.log(`\n2. Generating ${numThreats} randomized threat events...`);

  for (let i = 0; i < numThreats; i++) {
      // Randomize data
      const randomIp = `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
      const randomType = attackTypes[Math.floor(Math.random() * attackTypes.length)];
      const randomDevice = devices[Math.floor(Math.random() * devices.length)];
      
      // Determine severity based on attack type roughly
      let severity = Math.floor(Math.random() * 4) + 1; 
      if (randomType === "Zero-Day-RCE" || randomType === "Ransomware-Payload") severity = 4;
      if (randomType === "Port-Scan-Sweep") severity = 1;

      console.log(`   -> Logging ${randomType} (Severity: ${severity}) from ${randomIp}...`);
      const txLog = await registry.logThreat(randomIp, randomType, severity, randomDevice);
      await txLog.wait();

      // Randomly fast-forward blocks between each log so they have different unlock times!
      const blocksToMine = Math.floor(Math.random() * 30) + 5; // 5 to 35 blocks between logs
      for (let b = 0; b < blocksToMine; b++) {
          await hre.network.provider.send("evm_mine");
      }
  }

  console.log("\n3. Fast-forwarding 50 blocks to unlock some older rewards...");
  for (let i = 0; i < 50; i++) {
    await hre.network.provider.send("evm_mine");
  }

  console.log("=================================================");
  console.log("[!] RANDOMIZED TRAFFIC GENERATED!");
  console.log("Go to your web dashboard and click 'Sync with Blockchain'.");
  console.log("You will see a diverse list of attacks, with some rewards locked and some ready to claim!");
  console.log("=================================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
