import express from 'express';
import bodyParser from 'body-parser';
import { ethers } from 'ethers';
import path from 'path';
import dotenv from 'dotenv';
import crypto from 'crypto';

import { fileURLToPath } from 'url';

// Ensure .env is explicitly loaded from the correct relative path
dotenv.config({ path: path.resolve('middleware/middleware/middleware/.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, 'public')));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

const PORT = process.env.PORT || 3000;
const SECRET_TOKEN = process.env.HEC_SECRET_TOKEN;

const CONTRACT_ABI = [
  "function logThreat(string _attackerIP, string _attackType, uint8 _dangerLevel, string _deviceId) external returns (uint256)",
  "function getLog(uint256 _id) external view returns (tuple(uint256 id, uint256 timestamp, string attackerIP, string attackType, uint8 dangerLevel, string deviceId))",
  "function getTotalLogs() external view returns (uint256)",
  "event ThreatLogged(uint256 indexed logId, string indexed attackerIP, string attackType, uint8 dangerLevel)"
];

const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL || "http://127.0.0.1:8545");
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3", CONTRACT_ABI, wallet);

// --- TRANSACTION QUEUE SYSTEM ---
// Prevents nonce collisions during high-frequency webhook spam (Denial of Wallet mitigation)
const txQueue = [];
let isProcessingQueue = false;

async function processQueue() {
  if (isProcessingQueue || txQueue.length === 0) return;
  isProcessingQueue = true;

  while (txQueue.length > 0) {
    const data = txQueue.shift();
    try {
      console.log(`[Queue] Processing threat from device ${data.deviceId}...`);
      const tx = await contract.logThreat(data.attackerIP, data.attackType, data.dangerLevel, data.deviceId);
      console.log(`[Queue] Transaction submitted: ${tx.hash}`);
      await tx.wait(); 
      console.log(`[Queue] Confirmed on-chain: ${tx.hash}\n`);
    } catch (error) {
      console.error(`[Queue] Blockchain submission failed for ${data.deviceId}:`, error.message);
    }
  }

  isProcessingQueue = false;
}

function decodeHeliumPayload(payload) {
  try {
    const decoded = Buffer.from(payload, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (e) {
    console.error("Payload decoding failed:", e);
    return null;
  }
}

// API Endpoint: Get all logs for frontend dashboard
app.get('/api/logs', async (req, res) => {
  try {
    const total = await contract.getTotalLogs();
    const logs = [];
    // We fetch backwards to get newest first, limit to last 50 for performance
    const limit = total > 50n ? 50n : total;
    for (let i = total - 1n; i >= total - limit; i--) {
      const log = await contract.getLog(i);
      logs.push({
        id: log.id.toString(),
        timestamp: log.timestamp.toString(),
        attackerIP: log.attackerIP,
        attackType: log.attackType,
        dangerLevel: log.dangerLevel.toString(),
        deviceId: log.deviceId
      });
    }
    res.json(logs);
  } catch (error) {
    console.error("Error fetching logs:", error);
    res.status(500).json({ error: "Failed to fetch logs from blockchain" });
  }
});

app.post('/webhook', async (req, res) => {
  // 1. Authenticate Request
  const providedToken = req.headers['x-helium-token'];
  
  if (!providedToken || providedToken !== SECRET_TOKEN) {
    console.warn(`Unauthorized Webhook attempted. Invalid token.`);
    return res.status(401).json({ error: "Unauthorized" });
  }

  // 2. Extract and Validate Payload
  const { payload } = req.body;
  if (!payload) return res.status(400).json({ error: "Missing payload" });
  
  const data = decodeHeliumPayload(payload);
  if (!data) return res.status(400).json({ error: "Invalid payload format" });

  // 3. Acknowledge Receipt Immediately & Queue the Work
  // We return HTTP 202 (Accepted) immediately so the IoT device/Network doesn't timeout
  // while we wait for Polygon block confirmations.
  txQueue.push(data);
  processQueue(); // Kick off processing loop asynchronously

  res.status(202).json({ 
    success: true, 
    message: "Threat received and queued for blockchain submission",
    queuePosition: txQueue.length
  });
});

app.get('/status', async (req, res) => {
  try {
    const count = await contract.getTotalLogs();
    res.json({ 
        status: "Online", 
        totalLogs: count.toString(),
        queuedTransactions: txQueue.length 
    });
  } catch (e) {
    res.status(500).json({ status: "Error", message: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Production-grade Threat Bridge running on port ${PORT}`);
  console.log(`Connected to Registry: ${process.env.CONTRACT_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3"}`);
});
