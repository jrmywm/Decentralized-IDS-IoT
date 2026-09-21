import "dotenv/config";
import readline from "node:readline";
import { ethers } from "ethers";
import { Detector } from "./detector.js";

const required = ["DEVICE_PRIVATE_KEY", "REGISTRY_ADDRESS", "RELAY_URL", "INGEST_API_KEY", "CHAIN_ID", "DEVICE_ID"];
for (const name of required) if (!process.env[name]) throw new Error(`Missing required environment variable: ${name}`);
const wallet = new ethers.Wallet(process.env.DEVICE_PRIVATE_KEY);
const detector = new Detector();
let nonce = Number(process.env.START_NONCE || 0);
const domain = { name: "ThreatRegistry", version: "1", chainId: Number(process.env.CHAIN_ID), verifyingContract: process.env.REGISTRY_ADDRESS };
const types = { ThreatReport: [
  { name: "attackerIPHash", type: "bytes32" }, { name: "attackTypeHash", type: "bytes32" },
  { name: "dangerLevel", type: "uint8" }, { name: "deviceIdHash", type: "bytes32" },
  { name: "observedAt", type: "uint256" }, { name: "nonce", type: "uint256" }
]};

async function submit(finding) {
  const report = { ...finding, deviceId: process.env.DEVICE_ID };
  const value = { attackerIPHash: ethers.id(report.attackerIP), attackTypeHash: ethers.id(report.attackType), dangerLevel: report.dangerLevel, deviceIdHash: ethers.id(report.deviceId), observedAt: report.observedAt, nonce };
  const signature = await wallet.signTypedData(domain, types, value);
  const response = await fetch(`${process.env.RELAY_URL}/api/v1/reports`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${process.env.INGEST_API_KEY}` }, body: JSON.stringify({ reporter: wallet.address, nonce, signature, report }) });
  const body = await response.json();
  if (!response.ok) throw new Error(`relay rejected report (${response.status}): ${JSON.stringify(body)}`);
  console.log(JSON.stringify({ finding: report, transactionHash: body.transactionHash })); nonce += 1;
}

const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of input) {
  if (!line.trim()) continue;
  try { const finding = detector.observe(JSON.parse(line)); if (finding) await submit(finding); }
  catch (error) { console.error(`event rejected: ${error.message}`); }
}
