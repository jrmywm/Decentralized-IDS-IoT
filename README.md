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

### 1. IoT Layer (The Trigger)
- **Function**: Simulates a vulnerable device (e.g., ESP32) that attracts attackers.
- **Workflow**: Detects a threat $\rightarrow$ Base64 encodes the payload $\rightarrow$ Sends a signed POST request to the Middleware.
- **Security**: Uses a shared secret token (`x-helium-token`) for authentication.

### 2. Middleware Layer (The Bridge)
- **Technology**: Node.js, Express, ethers.js.
- **Role**: Acts as the secure gateway.
- **Key Features**:
    - **Auth**: Verifies IoT device tokens.
    - **Decoding**: Processes Base64 threat payloads.
    - **Tx Queue**: Implements a transaction queue to prevent nonce collisions on the blockchain.
    - **API**: Serves threat data to a frontend dashboard.

### 3. Blockchain Layer (The Ledger)
- **Technology**: Solidity, Hardhat, Polygon/Ethereum.
- **Contract**: `ThreatRegistry.sol`
- **Function**: Stores `ThreatLog` structs (Device ID, IP, Attack Type, Severity) permanently.
- **Access Control**: Only authorized middleware wallets can write to the registry.

---

## 🚀 Getting Started (Demo Guide)

### Prerequisites
- [Node.js](https://nodejs.org/) (v16+)
- [Hardhat](https://hardhat.org/)
- A compatible Ethereum wallet private key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/jrmywm/Decentralized-IDS-IoT.git
   cd Decentralized-IDS-IoT
   ```

2. **Install Root Dependencies**
   ```bash
   npm install
   ```

3. **Install Middleware Dependencies**
   ```bash
   cd middleware/middleware/middleware
   npm install
   ```

### Configuration
Create a `.env` file in `middleware/middleware/middleware/` with the following:
```env
PORT=3000
HEC_SECRET_TOKEN=your_secret_token_here
POLYGON_RPC_URL=http://127.0.0.1:8545
PRIVATE_KEY=your_wallet_private_key
CONTRACT_ADDRESS=deployed_registry_address
TOKEN_CONTRACT_ADDRESS=deployed_token_address
```

### Running the System

To demonstrate the end-to-end flow, please follow these steps in order using **5 separate terminal windows**.

### Window 1: Blockchain Infrastructure
Start the local Ethereum-compatible node to act as the network foundation.
```bash
# Navigate to: \Decentralized-IDS-IoT
npx hardhat node
```

### Window 2: Smart Contract Deployment
Deploy the contracts to the local network and fund the reward reserve.
```bash
# Navigate to: \Decentralized-IDS-IoT
npx hardhat run scripts/deploy.js --network localhost
```
> **Note:** This funds the Registry with 500,000 ISEC to be used for rewards.

### Window 3: Middleware Threat Bridge
Start the intermediary server that bridges the IoT devices and the Blockchain.
```bash
# Navigate to: \Decentralized-IDS-IoT\middleware\middleware\middleware
node bridge.js
```

### Window 4: IoT Simulator (PowerShell)
Simulate a threat detection from an ESP32 device by sending an encrypted payload.
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/webhook" `
  -Method Post `
  -Headers @{"Content-Type" = "application/json"; "x-helium-token" = "your_secret_token_here"} `
  -Body '{"payload": "eyJhdHRhY2tlcklQIjogIjE5Mi4xNjguMS4xMDciLCAiYXR0YWNrVHlwZSI6ICJTU0ggQnJ1dGUgRm9yY2UiLCAiZGFuZ2VyTGV2ZWwiOiAzLCAiZGV2aWNlSWQiOiAiRVNQMzJfREVWXzAxIn0="}'
```

### Window 5: Verification (Reward Check)
Verify that the 10 ISEC reward has been successfully transferred to the reporter.
```bash
# Navigate to: \Decentralized-IDS-IoT
npx hardhat run checkBalance.cjs --network localhost
```
> **Observation:** The balance will increase by **10 ISEC** every time the simulator (Window 4) is triggered.

---

## 🛠️ Key Components

| Component | File Path | Description |
| :--- | :--- | :--- |
| Token Contract | contracts/IoTToken.sol | ERC-20 Smart Contract for ISEC tokens (Reward System). |
| Registry Contract | contracts/ThreatRegistry.sol | Main immutable ledger for logging IoT threats and rewards. |
| Blockchain Bridge | middleware/middleware/middleware/bridge.js | Secure gateway connecting IoT devices to the Blockchain. |
| Dashboard | middleware/middleware/middleware/public/ | Frontend Web UI for real-time threat visualization. |
| Balance Checker | ./checkBalance.cjs | CLI tool to verify on-chain ISEC token balance mutations. |
| Ledger Explorer | .../explore-ledger.js | Legacy CLI tool to verify on-chain logs via terminal. |

---


## 📊 Dashboard Access

Once the bridge is running, you can monitor the system via the following endpoints:

*   **Real-time Logs API:** `http://localhost:3000/api/logs`
*   **System Status:** `http://localhost:3000/status`
*   **Web Dashboard:** `http://localhost:3000/`
    
---

## 📖 Additional Documentation
- For a step-by-step walkthrough, see [DEMO_GUIDE.md](DEMO_GUIDE.md).
- For verification steps, see [TESTING.md](TESTING.md).