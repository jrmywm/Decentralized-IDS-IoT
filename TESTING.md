# Manual Testing Guide: Decentralized IoT Honeypot & Threat Registry

This guide describes how to manually replicate and verify the end-to-end flow from IoT threat detection to blockchain logging.

## 🛠 Environment Setup

### Prerequisites
- Node.js installed
- Hardhat installed (`npm install --save-dev hardhat`)
- All dependencies installed in the `middleware` folder

---

## 🚀 Step-by-Step Replication

### Step 1: Launch the Local Blockchain
The system requires a local Ethereum-compatible node to store the threat registry.
1. Open a terminal.
2. Run:
   ```bash
   npx hardhat node
   ```
3. **Keep this terminal open.** Note the accounts and private keys listed; these are used by the middleware to sign transactions.

### Step 2: Start the Middleware Bridge
The bridge acts as the API endpoint for the IoT devices and the client for the smart contract.
1. Open a second terminal.
2. Navigate to the middleware directory:
   ```bash
   cd middleware
   ```
3. Start the bridge:
   ```bash
   node bridge.js
   ```
4. **Keep this terminal open.** You should see a message indicating the server is running (usually on port 3000).

### Step 3: Simulate a LoRaWAN Threat Trigger
Since the ESP32 is the hardware source, we simulate its output using a `curl` request.
1. Open a third terminal.
2. Execute the following command to simulate a high-severity threat:
   ```bash
   curl -X POST http://localhost:3000/threat \
        -H "Content-Type: application/json" \
        -d '{"deviceId": "ESP32-01", "threatType": "SQL_Injection", "severity": 8, "details": "Suspicious payload detected on LoRaWAN gateway"}'
   ```

---

## ✅ Verification (Success Criteria)

### 1. Middleware Logs (Terminal 2)
You should see:
- `[INFO] Received threat from device ESP32-01`
- `[INFO] Sending threat to blockchain...`
- `[SUCCESS] Threat logged! Transaction Hash: 0x...`

### 2. Blockchain Node Logs (Terminal 1)
You should see a transaction event appearing in the logs:
- A `transaction` block showing a call to the `ThreatRegistry` contract.
- The transaction status should be `success`.

### 3. Contract State (Optional)
If you have a Hardhat script for reading the registry, you can verify that the `threats` array now contains the simulated entry.

---

## 🚩 Troubleshooting
- **Bridge Error: "Cannot connect to provider"**: Ensure `npx hardhat node` is running in Terminal 1 before starting the bridge.
- **404 Not Found**: Ensure you are using the correct endpoint (`/threat`) and the bridge is listening on the port specified in `.env`.
- **Unauthorized Error**: Ensure the private key in `middleware/.env` matches one of the accounts provided by the Hardhat node.
