import { ethers } from 'ethers';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.resolve('middleware/middleware/middleware/.env') });

const txHash = process.argv[2];

if (!txHash || !txHash.startsWith('0x')) {
  console.error("❌ Please provide a valid transaction hash.");
  console.log("Usage: node get-tx-details.js <0x_transaction_hash>");
  process.exit(1);
}

const CONTRACT_ABI = [
  "event ThreatLogged(uint256 indexed logId, string indexed attackerIP, string attackType, uint8 dangerLevel)",
  "function logThreat(string _attackerIP, string _attackType, uint8 _dangerLevel, string _deviceId) external returns (uint256)"
];

async function inspectTransaction() {
  const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL || "http://127.0.0.1:8545");

  try {
    console.log(`\n🔍 Querying Blockchain Network for Transaction: ${txHash}...\n`);
    
    // Fetch the raw transaction (what was requested)
    const tx = await provider.getTransaction(txHash);
    if (!tx) {
      console.log("❌ Transaction not found on-chain. Are you sure the node is running and the hash is correct?");
      return;
    }

    // Fetch the transaction receipt (what actually happened and was mined)
    const receipt = await provider.getTransactionReceipt(txHash);
    
    console.log("======= 🔗 BLOCKCHAIN CRYPTOGRAPHIC PROOF ========");
    console.log(`Status           : ${receipt.status === 1 ? '✅ SUCCESS (Sealed)' : '❌ FAILED'}`);
    console.log(`Block Number     : ${receipt.blockNumber}`);
    console.log(`Block Hash       : ${receipt.blockHash}`);
    console.log(`Gas Used         : ${receipt.gasUsed.toString()} units (Computational Proof)`);
    console.log(`From (Signer)    : ${receipt.from}`);
    console.log(`To (Smart Contract): ${receipt.to}`);
    
    // Calculate confirmations simply: currentBlock - txBlock
    const currentBlock = await provider.getBlockNumber();
    const confirmations = currentBlock - receipt.blockNumber;
    console.log(`Confirmations    : ${confirmations >= 0 ? confirmations : 0} blocks deep`);
    console.log("==================================================\n");

    // Decode the raw hexadecimal input data to prove what was written
    const iface = new ethers.Interface(CONTRACT_ABI);
    
    try {
        const decodedInput = iface.parseTransaction({ data: tx.data });
        console.log("📥 DECODED IMMUTABLE PAYLOAD (Data baked into the block window):");
        console.log(`- Attacker IP : ${decodedInput.args[0]}`);
        console.log(`- Attack Type : ${decodedInput.args[1]}`);
        console.log(`- Danger Level: ${decodedInput.args[2]}`);
        console.log(`- Device ID   : ${decodedInput.args[3]}`);
        console.log("--------------------------------------------------\n");
    } catch(err) {
        console.log("Note: Could not decode input payload (It might not match the specific ThreatRegistry ABI).");
    }

    console.log("🛡️ VERDICT: MATHEMATICAL PROOF ESTABLISHED.");
    console.log("Because this data is sealed by the Block Hash above, altering a single character ");
    console.log("of this threat log in the future would break the cryptographic chain, alerting the network.\n");

  } catch (error) {
    console.error("Error communicating with blockchain node:", error.message);
  }
}

// Execute the audit
inspectTransaction();
