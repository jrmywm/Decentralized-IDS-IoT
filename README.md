# Decentralized IoT Honeypot & Threat Registry

A secure, immutable system for detecting and recording IoT-based cyber threats using a distributed ledger.

## 📌 Project Overview
This project implements a **Decentralized Intrusion Detection System (IDS)** designed for IoT environments. By combining a honeypot (simulated vulnerable IoT devices) with a blockchain ledger, it ensures that threat logs are transparent, verifiable, and resistant to tampering.

### The Problem
Traditional centralized logging systems are vulnerable: if an attacker compromises the logging server, they can delete evidence of their intrusion.

### The Solution
By piping threat data through a secure middleware into a **Smart Contract**, every detected attack is permanently etched into the blockchain. Even if the honeypot or middleware is compromised, the historical record of attacks remains immutable.

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

## 🚀 Getting Started

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
HEC_SECRET_TOKEN=your_secret_token
POLYGON_RPC_URL=http://127.0.0.1:8545
PRIVATE_KEY=your_wallet_private_key
CONTRACT_ADDRESS=deployed_contract_address
```

### Running the System

1. **Start Local Blockchain**
   ```bash
   npx hardhat node
   ```

2. **Deploy Smart Contract**
   Deploy `ThreatRegistry.sol` and update your `CONTRACT_ADDRESS` in the `.env` file.

3. **Start the Bridge**
   ```bash
   cd middleware/middleware/middleware
   node bridge.js
   ```

---

## 🛠️ Key Components

| Component | File | Description |
| :--- | :--- | :--- |
| **Smart Contract** | `contracts/ThreatRegistry.sol` | Immutable registry for threat logs. |
| **Blockchain Bridge** | `middleware/middleware/middleware/bridge.js` | Handles IoT $\rightarrow$ Blockchain communication. |
| **Ledger Explorer** | `middleware/middleware/middleware/explore-ledger.js` | CLI tool to verify on-chain logs. |
| **Dashboard** | `middleware/middleware/middleware/public/` | Frontend visualization of detected threats. |

## 📖 Additional Documentation
- For a step-by-step walkthrough, see [DEMO_GUIDE.md](DEMO_GUIDE.md).
- For verification steps, see [TESTING.md](TESTING.md).
