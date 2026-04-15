import { ethers } from 'ethers';
import 'dotenv/config';
import path from 'path';
import dotenv from 'dotenv';

// Ensure .env is loaded from the correct relative path
dotenv.config({ path: path.resolve('middleware/middleware/middleware/.env') });

async function explore() {
  const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL || 'http://127.0.0.1:8545');

  // Updated ABI to match ThreatRegistry.sol
  const abi = [
    'event ThreatLogged(uint256 indexed logId, string indexed attackerIP, string attackType, uint8 dangerLevel)',
    'function getLog(uint256 _id) external view returns (tuple(uint256 id, uint256 timestamp, string attackerIP, string attackType, uint8 dangerLevel, string deviceId))',
    'function getTotalLogs() external view returns (uint256)'
  ];

  const address = process.env.CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';

  try {
    const contract = new ethers.Contract(address, abi, provider);

    console.log('\n--- 🔍 DETAILED BLOCKCHAIN THREAT LEDGER ---');

    // Fetch all 'ThreatLogged' events from the blockchain
    const filter = contract.filters.ThreatLogged();
    const events = await contract.queryFilter(filter, 0, 'latest');

    if (events.length === 0) {
      console.log('No detailed threat events found in the ledger via events.');
      
      // Fallback: if events are missing but count is > 0, try fetching directly
      const total = await contract.getTotalLogs();
      if (total > 0) {
        console.log(`Found ${total} logs via direct contract call. Fetching details...`);
        for (let i = 0; i < total; i++) {
          const log = await contract.getLog(i);
          displayLog(i + 1, log);
        }
      }
    } else {
      console.log(`Found ${events.length} recorded events:\n`);
      console.log('ID | Device ID | Attack Type | Severity | Attacker IP | Timestamp');
      console.log('--------------------------------------------------------------------------------');

      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const logId = event.args.logId;
        
        // Fetch full details including deviceId which is not in the event
        try {
            const log = await contract.getLog(logId);
            displayLog(i + 1, log);
        } catch (err) {
            console.log(`${i + 1} | Error fetching details for log ${logId}`);
        }
      }
    }
    console.log('\n--------------------------------------------\n');
  } catch (e) {
    console.error('Error reading detailed ledger:', e.message);
  }
}

function displayLog(index, log) {
    const { attackerIP, attackType, dangerLevel, deviceId, timestamp } = log;
    
    // Map dangerLevel to a human-readable severity label
    let severity = dangerLevel.toString();
    if (dangerLevel >= 4) severity = '🚨 CRITICAL';
    else if (dangerLevel >= 3) severity = '🟠 HIGH';
    else if (dangerLevel >= 2) severity = '🟡 MEDIUM';
    else severity = '🔵 LOW';

    const date = new Date(Number(timestamp) * 1000).toLocaleString();

    console.log(`${index.toString().padEnd(2)} | ${deviceId.padEnd(10)} | ${attackType.padEnd(12)} | ${severity.padEnd(10)} | ${attackerIP.padEnd(15)} | ${date}`);
}

explore();