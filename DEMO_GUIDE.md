# Project Demo Guide: Decentralized IoT Honeypot & Threat Registry

This document serves as a step-by-step guide to demonstrating the end-to-end flow of the IoT threat detection and blockchain logging system with Crypto-Economic Security features.

## 1. System Architecture Overview
The system consists of three primary layers:
1. **IoT Trigger (Simulated)**: An ESP32 device detects a threat and sends a base64-encoded payload via a webhook.
2. **Middleware Bridge (Node.js)**: 
   - Authenticates the request using a secret token.
   - Decodes the IoT payload.
   - Interfaces with the Ethereum Sepolia Testnet using `ethers.js`.
3. **Threat Registry (Smart Contract)**: An immutable ledger that requires a 100 ISEC collateral stake to report, stores threat details, and distributes dynamic rewards based on severity.

---

## 2. Demo Guide Objectives
This guide is designed as a workflow to demonstrate the end-to-end system logic to evaluators, covering:
1. Smart Contract Deployment to a Public Testnet.
2. Crypto-Economic Staking (Collateral locking).
3. Attack detection and processing by the middleware.
4. Verification of real-time dynamic reward distributions on the dashboard.

---

## 3. Technical Guide (Terminal Window Operations)

You have two options for demonstrating this system. Choose the one that best fits your presentation needs:

### Option A: Localhost Simulation (Recommended for multi-node testing)
This runs an ultra-fast simulated blockchain on your own computer. It is best if you want to quickly demonstrate multiple nodes without waiting for real network block times or needing real Sepolia ETH.

**Terminal 1: Start Local Blockchain**
```bash
npx hardhat node
```
*(Leave this running. It provides 20 fake accounts with 10,000 ETH each).*

**Terminal 2: Deploy & Setup**
Wait for Terminal 1 to start, then deploy the contracts locally:
```bash
npx hardhat run scripts/deploy.js --network localhost
```
*Note: Ensure your `.env` files use `http://127.0.0.1:8545` as the RPC URL and contain the new localhost contract addresses.*

Stake collateral for your node:
```bash
npx hardhat run scripts/setup-stake.js --network localhost
```

**Terminal 3: Run Middleware**
```bash
cd middleware/middleware/middleware
node bridge.js
```

**Terminal 4: Simulate Attack**
```bash
cd middleware/middleware/middleware
node test-webhook.js
```
*Open `http://localhost:3000` to verify the dashboard!*

---

### Option B: Sepolia Testnet (Recommended for realism)
This deploys the system to the live Ethereum test network. It proves the system works in the real world across distributed global nodes.

**Terminal 1: Deploy Contracts**
```bash
npx hardhat run scripts/deploy.js --network sepolia
```
*Note: Update your `.env` files with the newly generated contract addresses and ensure the RPC URL is pointing to Sepolia (e.g., `https://ethereum-sepolia-rpc.publicnode.com`).*

**Terminal 2: Run Middleware**
```bash
cd middleware/middleware/middleware
node bridge.js
```

**Terminal 3: Crypto-Economic Staking**
Before reporting threats, you must lock 100 ISEC collateral.
```bash
npx hardhat run scripts/setup-stake.js --network sepolia
```

**Terminal 4: IoT Simulator**
Trigger an attack report.
```bash
cd middleware/middleware/middleware
node test-webhook.js
```

**Verification**
Open your web browser and navigate to `http://localhost:3000` to see your live Sepolia transactions rendered in the Web3 Dashboard!