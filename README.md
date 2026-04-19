# Decentralized IoT Honeypot & Threat Registry

A secure, immutable system for detecting and recording IoT-based cyber threats using a distributed ledger with an automated **ISEC Token** reward mechanism.

## 📌 Project Overview
This project implements a **Decentralized Intrusion Detection System (IDS)** designed for IoT environments. By combining a honeypot (simulated vulnerable IoT devices) with a blockchain ledger, it ensures that threat logs are transparent, verifiable, and resistant to tampering.

### The Problem
Traditional centralized logging systems are vulnerable: if an attacker compromises the logging server, they can delete or modify evidence of their intrusion to hide their tracks.

### The Solution
By piping threat data through a secure middleware into a **Smart Contract**, every detected attack is permanently etched into the blockchain. Even if the honeypot or middleware is compromised, the historical record of attacks remains immutable and serves as valid digital evidence.

### 🛡️ Key Feature: ISEC Coin (IoT Security Token)
We have introduced the **ISEC (ERC-20)** token as an economic incentive:
* **Token Reward:** Every device/reporter that successfully logs a valid threat receives **10 ISEC**.
* **Automated Incentive:** Rewards are sent directly by the Smart Contract to the reporter's wallet, encouraging node operators to maintain active security monitoring.

---

## 🏗️ Architecture

The system consists of three primary layers:

1.  **IoT Layer (The Trigger)**: Simulates vulnerable devices (e.g., ESP32) that detect attacks and send Base64-encoded payloads via signed POST requests.
2.  **Middleware Layer (The Bridge)**: A Node.js server that authenticates IoT devices, decodes payloads, and manages a transaction queue to prevent blockchain nonce collisions.
3.  **Blockchain Layer (The Ledger)**: Smart Contracts (`ThreatRegistry.sol` & `IoTToken.sol`) that handle immutable data storage and automated reward distribution.

---

## 🚀 Getting Started (Demo Guide)

To demonstrate the end-to-end flow, please follow these steps in order using **5 separate terminal windows**.

### 🪟 Window 1: Blockchain Infrastructure
Start the local Ethereum-compatible node to act as the network foundation.
```bash
# Navigate to: \Decentralized-IDS-IoT
npx hardhat node
```

### 🪟 Window 2: Smart Contract Deployment
Deploy the contracts to the local network and fund the reward reserve.
```bash
# Navigate to: \Decentralized-IDS-IoT
npx hardhat run scripts/deploy.js --network localhost
```
> **Note:** This funds the Registry with 500,000 ISEC to be used for rewards.

### 🪟 Window 3: Middleware Threat Bridge
Start the intermediary server that bridges the IoT devices and the Blockchain.
```bash
# Navigate to: \Decentralized-IDS-IoT\middleware\middleware\middleware
node bridge.js
```

### 🪟 Window 4: IoT Simulator (PowerShell)
Simulate a threat detection from an ESP32 device by sending an encrypted payload.
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/webhook" `
  -Method Post `
  -Headers @{"Content-Type" = "application/json"; "x-helium-token" = "your_secret_token_here"} `
  -Body '{"payload": "eyJhdHRhY2tlcklQIjogIjE5Mi4xNjguMS4xMDciLCAiYXR0YWNrVHlwZSI6ICJTU0ggQnJ1dGUgRm9yY2UiLCAiZGFuZ2VyTGV2ZWwiOiAzLCAiZGV2aWNlSWQiOiAiRVNQMzJfREVWXzAxIn0="}'
```

### 🪟 Window 5: Verification (Reward Check)
Verify that the 10 ISEC reward has been successfully transferred to the reporter.
```bash
# Navigate to: \Decentralized-IDS-IoT
npx hardhat run checkBalance.cjs --network localhost
```
> **Observation:** The balance will increase by **10 ISEC** every time the simulator (Window 4) is triggered.

---

## 🛠️ Key Components

| Component | File | Description |
| :--- | :--- | :--- |
| **Token Contract** | `contracts/IoTToken.sol` | ERC-20 contract for ISEC tokens. |
| **Registry Contract** | `contracts/ThreatRegistry.sol` | Main logic for logging and rewards. |
| **Blockchain Bridge** | `bridge.js` | Secure gateway between IoT and Ledger. |
| **Balance Checker** | `checkBalance.cjs` | CLI tool to verify on-chain token mutations. |

---

## 📊 Dashboard Access

Once the bridge is running, you can monitor the system via the following endpoints:

*   **Real-time Logs API:** `http://localhost:3000/api/logs`
*   **System Status:** `http://localhost:3000/status`
*   **Web Dashboard:** `http://localhost:3000/`
