import 'dotenv/config';
import axios from 'axios';
import { ethers } from 'ethers';
import hre from 'hardhat';

async function simulateAttack() {
  console.log("--- Starting IoT Honeypot Simulation ---");

  // 1. Setup Mock Data
  const mockAttack = {
    attackerIP: "192.168.1.50",
    attackType: "MQTT Injection",
    dangerLevel: 4, // Critical
    deviceId: "ESP32_SENS_01"
  };

  const payloadBase64 = Buffer.from(JSON.stringify(mockAttack)).toString('base64');
  const secretToken = process.env.HEC_SECRET_TOKEN || "your_secret_token_here";

  console.log(`Simulating attack from ${mockAttack.attackerIP}...`);

  try {
    // 2. Trigger the Webhook (Mimicking Helium Console)
    console.log("Sending payload to Middleware bridge...");
    const response = await axios.post('http://localhost:3000/webhook',
      { payload: payloadBase64 },
      { headers: { 'x-helium-token': secretToken } }
    );

    console.log("✅ Middleware Response:", response.data);

    // 3. Verify on the Blockchain
    console.log("Verifying on-chain record...");
    const ThreatRegistry = await hre.ethers.getContractFactory("ThreatRegistry");
    const registry = await ThreatRegistry.attach(process.env.CONTRACT_ADDRESS);

    const totalLogs = await registry.getTotalLogs();
    console.log(`Total logs on-chain: ${totalLogs}`);

    const lastLog = await registry.getLog(totalLogs - 1);
    console.log("--- Last Recorded Threat ---");
    console.log(`IP: ${lastLog.attackerIP}`);
    console.log(`Type: ${lastLog.attackType}`);
    console.log(`Danger: ${lastLog.dangerLevel}`);
    console.log(`Device: ${lastLog.deviceId}`);
    console.log("----------------------------");

    console.log("\n🚀 SIMULATION SUCCESSFUL: Attack detected -> Logged via Bridge -> Stored on Blockchain.");
  } catch (error) {
    console.error("❌ Simulation Failed:", error.response?.data || error.message);
  }
}

simulateAttack();
