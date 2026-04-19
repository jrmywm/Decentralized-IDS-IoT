# Project Demo Guide: Decentralized IoT Honeypot & Threat Registry

This document serves as a step-by-step guide to demonstrating the end-to-end flow of the IoT threat detection and blockchain logging system.

## 1. System Architecture Overview
The system consists of three primary layers:
1. **IoT Trigger (Simulated)**: An ESP32 device detects a threat and sends a base64-encoded payload via a webhook.
2. **Middleware Bridge (Node.js)**: 
   - Authenticates the request using a secret token.
   - Decodes the IoT payload.
   - Interfaces with the Ethereum-compatible blockchain using `ethers.js`.
3. **Threat Registry (Smart Contract)**: An immutable ledger that stores threat details (Device ID, Attacker IP, Attack Type, and Severity).

---

## 2. Demo Guide Objectives
This guide is designed as a workflow to demonstrate the end-to-end system logic to evaluators, covering:
1.  Attack detection.
2.  Data processing by the middleware.
3.  Verification of real-time coin balance mutations on the blockchain.

---

## 3. Technical Guide (Terminal Window Operations)

Please follow these steps in order using 5 separate terminal windows.

### 🪟 Window 1: Blockchain Infrastructure (The Ledger)
**Objective:** Run a local blockchain node as the foundation for all transactions.
**Purpose:** To activate a local RPC server that simulates an Ethereum/Polygon network.

```bash
# Run in directory: \Decentralized-IDS-IoT
npx hardhat node
```
> **Output:** A list of 20 testing accounts (Account #0 - #19) with their Private Keys will appear. These accounts are used to pay gas fees and receive rewards.

---

### 🪟 Window 2: Smart Contract Deployment
**Objective:** Deploy contracts to the blockchain and provide initial coin liquidity.
**Purpose:** To register the `ThreatRegistry` and `IoTToken` logic onto the network so the system has an official identity.

```bash
# Run in directory: \Decentralized-IDS-IoT
npx hardhat run scripts/deploy.js --network localhost
```
> **Output:** New contract addresses and confirmation of sending 500,000 ISEC to the contract as a reward reserve.

---

### 🪟 Window 3: Middleware Threat Bridge (Control Center)
**Objective:** Run the intermediary server connecting IoT devices to the blockchain.
**Purpose:** The server listens for data from webhooks, decodes the report content, and executes transactions to the Smart Contract.

```bash
# Navigate to the innermost middleware folder:
cd \Decentralized-IDS-IoT\middleware\middleware\middleware
node bridge.js
```
> **Output:** Message `🚀 Production-grade Threat Bridge running on port 3000` and confirmation of connection to the Registry.

---

### 🪟 Window 4: IoT Simulator (The Attack Trigger)
**Objective:** Simulate the transmission of an attack report from an IoT device.
**Purpose:** Send a Base64 encoded data packet to the middleware for processing.

**Use PowerShell:**
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/webhook" `
  -Method Post `
  -Headers @{"Content-Type" = "application/json"; "x-helium-token" = "your_secret_token_here"} `
  -Body '{"payload": "eyJhdHRhY2tlcklQIjogIjE5Mi4xNjguMS4xMDciLCAiYXR0YWNrVHlwZSI6ICJTU0ggQnJ1dGUgRm9yY2UiLCAiZGFuZ2VyTGV2ZWwiOiAzLCAiZGV2aWNlSWQiOiAiRVNQMzJfREVWXzAxIn0="}'
```
> **Output:** `success: True`, indicating the report has been received and added to the blockchain queue.

---

### 🪟 Window 5: Verification (Reward Check)
**Objective:** Prove that ISEC coins have been sent automatically.
**Purpose:** Run a script to check the reporter's wallet balance on the blockchain network.

```bash
# Run in directory: \Decentralized-IDS-IoT
npx hardhat run checkBalance.cjs --network localhost
```
> **Output:** `Reporter ISEC Balance: 5000XX.0 ISEC`. 
> 
> *Note: Every time Window 4 is executed, this value will increase by 10 units, proving that the reward system is working perfectly.*