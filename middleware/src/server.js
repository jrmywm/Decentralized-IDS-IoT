import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import { ethers } from "ethers";
import { validateEnvelope } from "./validation.js";

const required = ["RPC_URL", "RELAYER_PRIVATE_KEY", "REGISTRY_ADDRESS", "INGEST_API_KEY"];
for (const name of required) if (!process.env[name]) throw new Error(`Missing required environment variable: ${name}`);
if (process.env.INGEST_API_KEY.length < 24) throw new Error("INGEST_API_KEY must contain at least 24 characters");

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const relayer = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, provider);
const abi = [
  "function submitSignedThreat(address,string,string,uint8,string,uint256,uint256,bytes) returns (uint256)",
  "function reportNonces(address) view returns (uint256)", "function getTotalLogs() view returns (uint256)",
  "function getLog(uint256) view returns (tuple(uint256 id,uint256 timestamp,string attackerIP,string attackType,uint8 dangerLevel,string deviceId,address reporter,uint8 status))"
];
const registry = new ethers.Contract(process.env.REGISTRY_ADDRESS, abi, relayer);
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "16kb", strict: true }));

function authorized(req) {
  const supplied = Buffer.from(req.get("authorization")?.replace(/^Bearer /, "") || "");
  const expected = Buffer.from(process.env.INGEST_API_KEY);
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

app.get("/health", async (_req, res) => {
  try { res.json({ ok: true, chainId: (await provider.getNetwork()).chainId.toString(), relayer: relayer.address }); }
  catch { res.status(503).json({ ok: false }); }
});

app.post("/api/v1/reports", async (req, res) => {
  if (!authorized(req)) return res.status(401).json({ error: "unauthorized" });
  let envelope;
  try { envelope = validateEnvelope(req.body); } catch (error) { return res.status(400).json({ error: error.message }); }
  const { reporter, nonce, signature, report } = envelope;
  try {
    const chainNonce = await registry.reportNonces(reporter);
    if (chainNonce !== BigInt(nonce)) return res.status(409).json({ error: "nonce mismatch", expectedNonce: chainNonce.toString() });
    const tx = await registry.submitSignedThreat(reporter, report.attackerIP, report.attackType,
      report.dangerLevel, report.deviceId, report.observedAt, nonce, signature);
    const receipt = await tx.wait();
    res.status(202).json({ accepted: true, transactionHash: receipt.hash });
  } catch (error) {
    console.error("report submission failed", error.shortMessage || error.message);
    res.status(502).json({ error: "chain submission failed" });
  }
});

app.get("/api/v1/logs", async (_req, res) => {
  try {
    const total = await registry.getTotalLogs(); const start = total > 50n ? total - 50n : 0n; const logs = [];
    for (let id = total; id > start; id--) { const item = await registry.getLog(id - 1n); logs.push({ id: item.id.toString(), timestamp: item.timestamp.toString(), attackerIP: item.attackerIP, attackType: item.attackType, dangerLevel: Number(item.dangerLevel), deviceId: item.deviceId, reporter: item.reporter, status: Number(item.status) }); }
    res.json(logs);
  } catch { res.status(503).json({ error: "registry unavailable" }); }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, "127.0.0.1", () => console.log(`Threat relay listening on http://127.0.0.1:${port}`));
