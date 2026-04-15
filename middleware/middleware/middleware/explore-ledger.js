import { ethers } from 'ethers';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve('middleware/middleware/middleware/.env') });

async function explore() {
    const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL || 'http://127.0.0.1:8545');
    const abi = [
        'function logThreat(string _attackerIP, string _attackType, uint8 _dangerLevel, string _deviceId) external returns (uint256)',
        'function getTotalLogs() external view returns (uint256)'
    ];
    const address = process.env.CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';

    try {
        const contract = new ethers.Contract(address, abi, provider);
        const total = await contract.getTotalLogs();
        console.log('\n--- BLOCKCHAIN THREAT LEDGER ---');
        console.log('Total Threats Recorded: ' + total.toString());
        console.log('-------------------------------\n');

        if (total == 0) {
            console.log('The ledger is currently empty.');
        } else {
            console.log('Threats are securely stored on-chain.');
        }
    } catch (e) {
        console.error('Error reading ledger:', e.message);
    }
}

explore();