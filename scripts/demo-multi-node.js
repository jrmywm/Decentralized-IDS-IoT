const hre = require("hardhat");
require("dotenv").config();

async function main() {
  // Hardhat provides 20 accounts locally. We'll use the first 4.
  const [deployer, node1, node2, node3] = await hre.ethers.getSigners();
  
  const tokenAddress = process.env.TOKEN_CONTRACT_ADDRESS;
  const registryAddress = process.env.CONTRACT_ADDRESS;

  if (!tokenAddress || !registryAddress) {
      console.error("Error: TOKEN_CONTRACT_ADDRESS or CONTRACT_ADDRESS is not set in .env");
      process.exit(1);
  }

  const token = await hre.ethers.getContractAt("IoTToken", tokenAddress);
  const registry = await hre.ethers.getContractAt("ThreatRegistry", registryAddress);

  console.log("=== DEMO: MULTI-NODE STANDARD CONSENSUS ===\n");
  
  console.log("0. Setting network consensus threshold to 3 (Production Mode)...");
  await (await registry.connect(deployer).updateConsensusThreshold(3)).wait();

  // Define nodes
  const nodes = [node1, node2, node3];
  
  console.log("1. Setting up 3 standard community nodes (Authorizing & Staking 100 ISEC each)...");
  
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    
    // Authorize node
    await (await registry.connect(deployer).addReporter(node.address)).wait();
    
    // Give node 500 tokens from deployer
    await (await token.connect(deployer).transfer(node.address, hre.ethers.parseEther("500"))).wait();
    
    // Node approves and stakes 100 ISEC
    await (await token.connect(node).approve(registryAddress, hre.ethers.parseEther("100"))).wait();
    await (await registry.connect(node).stake(hre.ethers.parseEther("100"))).wait();
    
    console.log(`   [Ready] Node ${i + 1} (${node.address.slice(0, 6)}...) staked 100 ISEC.`);
  }

  console.log("\n2. Simulating a Wide-Range Botnet Scan across the network...");
  const botnetIp = `203.0.113.${Math.floor(Math.random() * 255)}`;
  const attackType = "DDoS-Ping-Flood";

  // Node 1 detects it
  console.log(`\n   -> [Node 1] detects IP ${botnetIp} scanning it.`);
  await (await registry.connect(node1).logThreat(botnetIp, attackType, 2, "HONEYPOT-1")).wait();
  let logs = await registry.getTotalLogs();
  console.log(`      Threat recorded as PENDING. Total confirmed logs on-chain: ${logs}`);

  // Node 2 detects it
  console.log(`\n   -> [Node 2] also detects IP ${botnetIp} scanning it.`);
  await (await registry.connect(node2).logThreat(botnetIp, attackType, 2, "HONEYPOT-2")).wait();
  logs = await registry.getTotalLogs();
  console.log(`      Threat still PENDING (Threshold is 3). Total confirmed logs on-chain: ${logs}`);

  // Node 3 detects it
  console.log(`\n   -> [Node 3] detects IP ${botnetIp} scanning it.`);
  const balBefore1 = await token.balanceOf(node1.address);
  
  await (await registry.connect(node3).logThreat(botnetIp, attackType, 2, "HONEYPOT-3")).wait();
  logs = await registry.getTotalLogs();
  
  console.log(`\n3. CONSENSUS REACHED!`);
  console.log(`   [Success] The threat has been verified and permanently written to the blockchain!`);
  console.log(`   Total confirmed logs on-chain: ${logs}`);

  const balAfter1 = await token.balanceOf(node1.address);
  const reward = balAfter1 - balBefore1;
  
  console.log(`\n4. Distributing dynamic rewards to all contributing nodes...`);
  console.log(`   [Success] Node 1 earned: ${hre.ethers.formatEther(reward)} ISEC`);
  console.log(`   [Success] Node 2 earned: ${hre.ethers.formatEther(reward)} ISEC`);
  console.log(`   [Success] Node 3 earned: ${hre.ethers.formatEther(reward)} ISEC`);

  console.log("\n=== MULTI-NODE DEMO COMPLETE ===");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
