# Decentralized IoT Honeypot & Threat Registry

A secure, immutable system for detecting and recording IoT-based cyber threats using a distributed ledger with an automated **ISEC Token** reward mechanism.

## Project Overview
This project implements a **Decentralized Intrusion Detection System (IDS)** designed for IoT environments. By combining a honeypot (simulated vulnerable IoT devices) with a blockchain ledger, it ensures that threat logs are transparent, verifiable, and resistant to tampering.

### The Problem
Traditional centralized logging systems are vulnerable: if an attacker compromises the logging server, they can delete or modify evidence of their intrusion to hide their tracks.

### The Solution
By piping threat data through a secure middleware into a **Smart Contract**, every detected attack is permanently etched into the blockchain. Even if the honeypot or middleware is compromised, the historical record of attacks remains immutable and serves as valid digital evidence.

### Key Feature: Crypto-Economic Security (ISEC Token)
We have introduced the **ISEC (ERC-20)** token to create a robust crypto-economic security model:
* **Anti-Poisoning Staking:** Nodes must lock a collateral stake of **100 ISEC** to be authorized to report. Malicious nodes can be slashed by admins.
* **Dynamic Rewards:** To incentivize accurate reporting, the Smart Contract automatically scales rewards based on threat severity (e.g., Level 1 = 5 ISEC, Level 4 Critical = 50 ISEC).

### How the Blockchain Data Storage Works
Unlike traditional centralized databases (like MySQL or MongoDB), our system stores threat data permanently on the **Ethereum Sepolia** public blockchain (or Polygon).

*   **Smart Contract Storage:** The actual data (Threat logs, Staked Balances, Token Ledgers) is physically stored within the *state variables* of the `ThreatRegistry.sol` and `IoTToken.sol` smart contracts.
*   **The Network (Polygon/Sepolia):** These smart contracts are deployed to a distributed network of thousands of nodes globally. This means there is no single server to hack. If one node goes down, the data remains perfectly intact across the network.
*   **The Middleware Connection:** Our Node.js middleware (`bridge.js`) acts as the bridge. It uses the `POLYGON_RPC_URL` (or Sepolia RPC) defined in your `.env` file to securely connect to a public node (like `publicnode.com`). When a threat is detected, the middleware packages the data and sends a cryptographic transaction to the network, permanently etching the data into the public ledger.

---

## Architecture

The system consists of three primary layers:

### 1. IoT Layer (The Trigger)
- **Function**: Simulates a vulnerable device (e.g., ESP32 or Raspberry Pi) that attracts attackers by exposing fake services.
- **Threat Detection Methods**:
  - **Port Listening**: Opens common ports (e.g., 22 for SSH, 23 for Telnet). Logs any unauthorized IP attempting to connect as a Port Scanner or Brute-force attack.
  - **Fake Services**: Runs simulated services (like a fake web login). If an attacker inputs malicious payloads (e.g., `OR 1=1`), the device categorizes it as SQL Injection.
  - **Automated Trigger**: Once a rule is matched, the device's script instantly constructs the threat data (Attacker IP, Attack Type, Danger Level) into a JSON payload.
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

## Getting Started (Demo Guide)

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

To demonstrate the end-to-end flow, please follow these steps.

### Terminal 1: Smart Contract Deployment
Deploy the contracts to the Sepolia public testnet and fund the reward reserve.
```bash
# Navigate to: \Decentralized-IDS-IoT
npx hardhat run scripts/deploy.js --network sepolia
```
> **Note:** Update your `.env` files with the newly generated contract addresses.

### Terminal 2: Middleware Threat Bridge
Start the intermediary server that bridges the IoT devices and the Blockchain, and serves the Web3 Dashboard.
```bash
# Navigate to: \Decentralized-IDS-IoT\middleware\middleware\middleware
node bridge.js
```

### Terminal 3: Setup Node Staking
Before logging threats, lock 100 ISEC as collateral.
```bash
# Navigate to: \Decentralized-IDS-IoT
npx hardhat run scripts/setup-stake.js --network sepolia
```

### Terminal 4: IoT Simulator
Simulate a threat detection from an ESP32 device to trigger the dynamic reward logic.
```bash
# Navigate to: \Decentralized-IDS-IoT\middleware\middleware\middleware
node test-webhook.js
```

### Terminal 5: Verification (Dashboard)
Verify the dynamic rewards and your staked status visually.
Open your browser and navigate to `http://localhost:3000`. You will see your node in the **Active Staked Nodes** table and the reward transferred in the **IoTToken Latest Ledger**.

---

## Key Components

| Component | File Path | Description |
| :--- | :--- | :--- |
| Token Contract | contracts/IoTToken.sol | ERC-20 Smart Contract for ISEC tokens (Reward System). |
| Registry Contract | contracts/ThreatRegistry.sol | Main immutable ledger for logging IoT threats and rewards. |
| Blockchain Bridge | middleware/middleware/middleware/bridge.js | Secure gateway connecting IoT devices to the Blockchain. |
| Dashboard | middleware/middleware/middleware/public/ | Frontend Web UI for real-time threat visualization. |
| Balance Checker | ./checkBalance.cjs | CLI tool to verify on-chain ISEC token balance mutations. |
| Ledger Explorer | .../explore-ledger.js | Legacy CLI tool to verify on-chain logs via terminal. |

---


## Dashboard Access

Once the bridge is running, you can monitor the system via the following endpoints:

*   **Real-time Logs API:** `http://localhost:3000/api/logs`
*   **System Status:** `http://localhost:3000/status`
*   **Web Dashboard:** `http://localhost:3000/`
    
---

## Additional Documentation
- For a step-by-step walkthrough, see [DEMO_GUIDE.md](DEMO_GUIDE.md).
- For verification steps, see [TESTING.md](TESTING.md).