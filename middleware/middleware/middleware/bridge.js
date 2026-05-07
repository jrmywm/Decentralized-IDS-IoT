import express from 'express';
import bodyParser from 'body-parser';
import { ethers } from 'ethers';
import path from 'path';
import dotenv from 'dotenv';
import cors from 'cors'; // Add cors for dashboard API access
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Improve .env loading flexibility
dotenv.config(); 

const app = express();
app.use(cors()); // Allow dashboard to access API
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
  // Use unnamed tuple fields in returns for stable Ethers v6 Array response
  "function getLog(uint256 _id) external view returns (tuple(uint256, uint256, string, string, uint8, string))",
  "function getTotalLogs() external view returns (uint256)",
  "function stakedBalances(address) external view returns (uint256)",
  "event ThreatLogged(uint256 indexed logId, string indexed attackerIP, string attackType, uint8 dangerLevel)",
  "event RewardSent(address indexed reporter, uint256 amount)",
  "event Staked(address indexed reporter, uint256 amount)",
  "event Slashed(address indexed reporter, uint256 amount)"
];

const IOT_TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL || "http://127.0.0.1:8545");

// Clean Private Key from spaces/weird characters
const privateKey = (process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80").trim();
const wallet = new ethers.Wallet(privateKey, provider);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS || "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", CONTRACT_ABI, wallet);
const tokenContract = new ethers.Contract(
  process.env.TOKEN_CONTRACT_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  IOT_TOKEN_ABI,
  wallet
);

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

// API Endpoint: CORE FIX HERE
app.get('/api/logs', async (req, res) => {
  try {
    const total = await contract.getTotalLogs();
    const logs = [];
    const limit = total > 50n ? 50n : total;
    
    for (let i = total - 1n; i >= total - limit; i--) {
      try {
        const logData = await contract.getLog(i);
        // Using index access [0], [1], etc. because ethers v6 returns a Result Array
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

app.get('/api/token-ledger', async (req, res) => {
  try {
    const latestBlock = await provider.getBlockNumber();
    const fromBlock = latestBlock > 10000 ? latestBlock - 10000 : 0;
    const tokenMeta = await Promise.all([
      tokenContract.name(),
      tokenContract.symbol(),
      tokenContract.decimals()
    ]);

    const transferEvents = await tokenContract.queryFilter(
      tokenContract.filters.Transfer(),
      fromBlock,
      latestBlock
    );

    const recentEvents = transferEvents.slice(-50).reverse();
    const blockCache = new Map();
    const ledger = [];

    for (const evt of recentEvents) {
      const blockNumber = evt.blockNumber;
      let block = blockCache.get(blockNumber);
      if (!block) {
        block = await provider.getBlock(blockNumber);
        blockCache.set(blockNumber, block);
      }

      ledger.push({
        blockNumber,
        txHash: evt.transactionHash,
        from: evt.args?.from || null,
        to: evt.args?.to || null,
        value: ethers.formatUnits(evt.args?.value || 0n, tokenMeta[2]),
        timestamp: block?.timestamp || null
      });
    }

    res.json({
      token: {
        address: tokenContract.target,
        name: tokenMeta[0],
        symbol: tokenMeta[1],
        decimals: Number(tokenMeta[2])
      },
      ledger
    });
  } catch (error) {
    console.error('Error fetching token ledger:', error);
    res.status(500).json({ error: 'Failed to fetch token ledger' });
  }
});

app.get('/api/staked-nodes', async (req, res) => {
  try {
    const latestBlock = await provider.getBlockNumber();
    const fromBlock = latestBlock > 10000 ? latestBlock - 10000 : 0;
    
    // Find all unique reporters from Staked events
    const stakedEvents = await contract.queryFilter(
      contract.filters.Staked(),
      fromBlock,
      latestBlock
    );
    
    const uniqueReporters = new Set();
    stakedEvents.forEach(evt => {
      if (evt.args && evt.args.reporter) {
        uniqueReporters.add(evt.args.reporter);
      }
    });

    // Also include the last honeypot reporter just in case
    const lastReporterDetails = await getLastReporterDetails();
    if (lastReporterDetails && lastReporterDetails.address) {
        uniqueReporters.add(lastReporterDetails.address);
    }

    const nodes = [];
    for (const address of uniqueReporters) {
      const balance = await contract.stakedBalances(address);
      nodes.push({
        address,
        stakedBalance: ethers.formatEther(balance)
      });
    }

    res.json(nodes);
  } catch (error) {
    console.error('Error fetching staked nodes:', error);
    res.status(500).json({ error: 'Failed to fetch staked nodes' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Threat Bridge running on port ${PORT}`);
  console.log(`Connected to Registry: ${contract.target}`);
});
