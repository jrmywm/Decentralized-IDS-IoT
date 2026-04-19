masukanpanduan tiap window kedalam demo_guide saya jangan potong perintah tiap windownya

# Project Documentation & Demonstration Guide
## **Decentralized IoT Honeypot & Threat Registry**

---

## 1. Introduction
This project is an innovative integration of **Internet of Things (IoT)** and **Blockchain** technology designed to create a transparent, decentralized, and tamper-resistant security system.

In traditional security ecosystems, attack logs are often vulnerable to deletion or modification by attackers who successfully breach the system. By utilizing **Smart Contracts**, every attack trace is permanently locked within the blockchain ledger, rendering it a valid and immutable piece of digital evidence.

---

## 2. Project Overview
The system implements a **Honeypot-based Intrusion Detection System (IDS)**.

*   **Working Mechanism:** IoT devices (such as the ESP32) act as decoys to lure attackers.
*   **Data Flow:** Once an attack is detected, the data is sent to the Middleware, which automatically processes and records it onto the blockchain.

### 🛡️ Key Feature: ISEC Coin (IoT Security Token)
We have introduced the **ISEC (ERC-20)** coin standard as an economic incentive:
*   **Token Reward:** Every device that successfully detects and reports a valid threat receives **10 ISEC**.
*   **Automation:** Rewards are sent directly by the Smart Contract to the reporter's wallet as appreciation for their contribution to network security.

---

## 3. Demo Guide Objectives
This guide is designed as a workflow to demonstrate the end-to-end system logic to evaluators, covering:
1.  Attack detection.
2.  Data processing by the middleware.
3.  Verification of real-time coin balance mutations on the blockchain.

---

## 4. Technical Guide (Terminal Window Operations)

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