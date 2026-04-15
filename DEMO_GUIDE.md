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

## 2. Demo Setup (Pre-Flight)

### Terminal 1: The Blockchain Node
Start the local Ethereum node to act as the ledger.
```bash
npx hardhat node
```
*Keep this window open to show real-time transaction logs.*

### Terminal 2: The Middleware Bridge
Start the bridge that connects the IoT world to the blockchain.
```bash
# Navigate to the bridge directory
cd middleware/middleware/middleware

# Start the server
node bridge.js
```
*Keep this window open to show the authentication and processing logs.*

### Terminal 3: The IoT Simulator
This terminal will be used to trigger the "attack".

---

## 3. The Live Demonstration Flow

### Step 1: The Threat Trigger
Execute the following command to simulate a high-severity SQL Injection attack detected by an ESP32 device.

```bash
# Generate the base64 payload and send the request
PAYLOAD=$(echo -n '{"deviceId": "ESP32-01", "attackerIP": "192.168.1.100", "attackType": "SQL_Injection", "dangerLevel": 4}' | base64 | tr -d '\n')

curl -X POST http://localhost:3000/webhook \
     -H "Content-Type: application/json" \
     -H "x-helium-token: test_secret_123" \
     -d "{\"payload\": \"$PAYLOAD\"}"
```

WINDOWS:
```bash
$payloadJson = '{"deviceId": "ESP32-01", "attackerIP": "192.168.1.100", "attackType": "SQL_Injection", "dangerLevel": 4}'
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($payloadJson)
  $payloadBase64 = [Convert]::ToBase64String($bytes)

  $headers = @{
      "Content-Type" = "application/json"
      "x-helium-token" = "test_secret_123"
  }

  $body = @{
      payload = $payloadBase64
  } | ConvertTo-Json

  Invoke-RestMethod -Uri "http://localhost:3000/webhook" -Method Post -Headers $headers -Body $body

```

### Step 2: Verifying the Middleware (Terminal 2)
Point to the logs in the Bridge terminal. The professor should see:
- `Incoming webhook request...`
- `Provided Token: test_secret_123`
- `Logging threat from device ESP32-01...`
- `Transaction confirmed on-chain!`

### Step 3: Verifying the Blockchain (Terminal 1)
Point to the Hardhat node terminal. You will see a new transaction block appearing, confirming that the data has been written to the ledger.

### Step 4: Proving the State (Optional)
Run the verification script to show the total number of recorded threats.
```bash
node middleware/middleware/middleware/verify-contract.js
```
*Expected Output: `Contract is reachable. Total logs: 1` (or more if you ran it multiple times).*

---

## 4. Key Talking Points for the Professor

- **Immutability**: "By using a smart contract, we ensure that once a threat is logged, it cannot be deleted or altered by an attacker, creating a reliable forensic audit trail."
- **Security**: "The middleware uses a shared secret token (`x-helium-token`) to prevent unauthorized parties from spamming the registry with fake threats."
- **Scalability**: "While we are using a local Hardhat node for the demo, the system is designed to be deployed to a Layer 2 solution like Polygon to keep transaction costs (gas) low."
- **IoT Integration**: "The use of base64 encoding simulates how low-power IoT devices (like those using LoRaWAN) often transmit compressed binary data to conserve energy."
