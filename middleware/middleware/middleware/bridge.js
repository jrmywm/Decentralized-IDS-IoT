import express from 'express';
import bodyParser from 'body-parser';
import { ethers } from 'ethers';
import path from 'path';
import dotenv from 'dotenv';
import cors from 'cors'; // Tambahkan cors agar dashboard lancar
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Perbaiki pemuatan .env agar lebih fleksibel
dotenv.config(); 

const app = express();
app.use(cors()); // Mengizinkan dashboard mengakses API
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

const PORT = process.env.PORT || 3000;
const SECRET_TOKEN = process.env.HEC_SECRET_TOKEN || "your_secret_token_here";

const CONTRACT_ABI = [
  "function logThreat(string _attackerIP, string _attackType, uint8 _dangerLevel, string _deviceId) external returns (uint256)",
  // Gunakan tuple tanpa nama field di dalam returns agar ethers v6 mengembalikan Array yang stabil
  "function getLog(uint256 _id) external view returns (tuple(uint256, uint256, string, string, uint8, string))",
  "function getTotalLogs() external view returns (uint256)",
  "event ThreatLogged(uint256 indexed logId, string indexed attackerIP, string attackType, uint8 dangerLevel)",
  "event RewardSent(address indexed reporter, uint256 amount)"
];

const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL || "http://127.0.0.1:8545");

// Bersihkan Private Key dari spasi/karakter aneh
const privateKey = (process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80").trim();
const wallet = new ethers.Wallet(privateKey, provider);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS || "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", CONTRACT_ABI, wallet);

// --- TRANSACTION QUEUE SYSTEM ---
const txQueue = [];
let isProcessingQueue = false;

async function getLastReporterDetails() {
  const latestBlockNumber = await provider.getBlockNumber();
  const fromBlock = latestBlockNumber > 5000 ? latestBlockNumber - 5000 : 0;
  const latestThreatEvents = await contract.queryFilter(
    contract.filters.ThreatLogged(),
    fromBlock,
    latestBlockNumber
  );
  const latestEvent = latestThreatEvents[latestThreatEvents.length - 1];

  if (!latestEvent) {
    return null;
  }

  const tx = await provider.getTransaction(latestEvent.transactionHash);
  if (!tx || !tx.from) {
    return null;
  }

  const [balance, txCount] = await Promise.all([
    provider.getBalance(tx.from),
    provider.getTransactionCount(tx.from)
  ]);

  return {
    address: tx.from,
    balanceEth: ethers.formatEther(balance),
    transactionCount: txCount,
    lastSubmissionTxHash: latestEvent.transactionHash
  };
}

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
      console.error(`[Queue] Blockchain submission failed:`, error.message);
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

// API Endpoint: PERBAIKAN UTAMA DISINI
app.get('/api/logs', async (req, res) => {
  try {
    const total = await contract.getTotalLogs();
    const logs = [];
    const limit = total > 50n ? 50n : total;
    
    for (let i = total - 1n; i >= total - limit; i--) {
      try {
        const logData = await contract.getLog(i);
        // Menggunakan akses index [0], [1], dst. karena ethers v6 mengembalikan Result Array
        if (logData) {
          logs.push({
            id: logData[0].toString(),
            timestamp: logData[1].toString(),
            attackerIP: logData[2],
            attackType: logData[3],
            dangerLevel: logData[4].toString(),
            deviceId: logData[5]
          });
        }
      } catch (err) {
        console.warn(`Skipping log at index ${i}:`, err.message);
      }
    }
    res.json(logs);
  } catch (error) {
    console.error("Error fetching logs:", error);
    res.status(500).json({ error: "Failed to fetch logs from blockchain" });
  }
});

app.post('/webhook', async (req, res) => {
  const providedToken = req.headers['x-helium-token'];
  if (!providedToken || providedToken !== SECRET_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { payload } = req.body;
  if (!payload) return res.status(400).json({ error: "Missing payload" });
  
  const data = decodeHeliumPayload(payload);
  if (!data) return res.status(400).json({ error: "Invalid payload format" });

  txQueue.push(data);
  processQueue();

  res.status(202).json({ 
    success: true, 
    message: "Threat received and queued",
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

app.get('/api/dashboard-summary', async (req, res) => {
  try {
    const [network, blockNumber, latestBlock, chainId, totalLogs, contractCode, lastReporter] = await Promise.all([
      provider.getNetwork(),
      provider.getBlockNumber(),
      provider.getBlock('latest'),
      provider.getNetwork().then((n) => n.chainId.toString()),
      contract.getTotalLogs(),
      provider.getCode(contract.target),
      getLastReporterDetails()
    ]);

    res.json({
      currentBlock: {
        number: blockNumber,
        hash: latestBlock?.hash || null,
        timestamp: latestBlock?.timestamp || null,
        txCount: latestBlock?.transactions?.length || 0,
        parentHash: latestBlock?.parentHash || null
      },
      smartContract: {
        address: contract.target,
        network: network.name,
        chainId,
        totalThreatLogs: totalLogs.toString(),
        abiFunctionCount: CONTRACT_ABI.length,
        deployedBytecodeSize: contractCode ? Math.max((contractCode.length - 2) / 2, 0) : 0
      },
      lastHoneypotReporter: lastReporter
    });
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Threat Bridge running on port ${PORT}`);
  console.log(`Connected to Registry: ${contract.target}`);
});
