import 'dotenv/config';
import express from 'express';
import bodyParser from 'body-parser';
import { ethers } from 'ethers';

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const SECRET_TOKEN = process.env.HEC_SECRET_TOKEN;

// ThreatRegistry ABI (only the functions we need)
const CONTRACT_ABI = [
  "function logThreat(string _attackerIP, string _attackType, uint8 _dangerLevel, string _deviceId) external returns (uint256)",
  "function getTotalLogs() external view returns (uint256)"
];

// Initialize Web3 Provider and Wallet
const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

/**
 * Decodes the binary/base64 payload from Helium
 * For now, we assume the payload is a JSON string wrapped in base64
 * In a real scenario, this would use a binary decoder (e.g., Cayenne LPP)
 */
function decodeHeliumPayload(payload) {
  try {
    const decoded = Buffer.from(payload, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (e) {
    console.error("Payload decoding failed:", e);
    return null;
  }
}

app.post('/webhook', async (req, res) => {
  console.log("Incoming webhook request...");

  // 1. Security Check: Verify Secret Token
  const providedToken = req.headers['x-helium-token'];
  if (!providedToken || providedToken !== SECRET_TOKEN) {
    console.warn("Unauthorized webhook request attempted.");
    return res.status(401).json({ error: "Unauthorized" });
  }

  // 2. Extract Payload
  const { payload } = req.body;
  if (!payload) {
    return res.status(400).json({ error: "Missing payload" });
  }

  const data = decodeHeliumPayload(payload);
  if (!data) {
    return res.status(400).json({ error: "Invalid payload format" });
  }

  try {
    console.log(`Logging threat from device ${data.deviceId}...`);

    // 3. Submit to Blockchain
    const tx = await contract.logThreat(
      data.attackerIP,
      data.attackType,
      data.dangerLevel,
      data.deviceId
    );

    console.log(`Transaction submitted: ${tx.hash}`);
    await tx.wait();
    console.log("Transaction confirmed on-chain!");

    res.status(200).json({
      success: true,
      txHash: tx.hash,
      message: "Threat logged to blockchain"
    });
  } catch (error) {
    console.error("Blockchain submission failed:", error);
    res.status(500).json({ error: "Internal Blockchain Error", details: error.message });
  }
});

app.get('/status', async (req, res) => {
  try {
    const count = await contract.getTotalLogs();
    res.json({ status: "Online", totalLogs: count.toString() });
  } catch (e) {
    res.status(500).json({ status: "Error", message: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Middleware Bridge running on port ${PORT}`);
  console.log(`Listening for Helium webhooks at http://localhost:${PORT}/webhook`);
});
