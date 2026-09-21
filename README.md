# Decentralized IoT Threat Registry

An educational end-to-end prototype showing how independent honeypot reporters can sign observations, relay them to a smart contract, and reach stake-backed consensus. The blockchain is the shared threat registry and incentive layer; detection still happens at the edge.

This is a portfolio/demo system, not production IDS infrastructure. It uses a demo token, owner-managed reporter enrollment, and owner arbitration for challenged evidence.

## What is implemented

```text
JSON honeypot events -> explainable edge detector -> EIP-712 signed report
  -> authenticated HTTP relay (gas payer only) -> ThreatRegistry
  -> 3-reporter consensus OR trusted-stake optimistic report
  -> reward / challenge / delayed withdrawal
```

- Severity is part of the five-minute consensus key, so reporters must agree on IP, attack type, and severity.
- Each reporter has its own Ethereum key and nonce. The relay cannot change a signed report or make several devices look like independent reporters.
- Normal confirmation requires three distinct authorized, staked addresses.
- A reporter with 500 ISEC may submit optimistically; its reward is delayed for 100 blocks.
- Another sufficiently staked reporter can post a 25 ISEC challenge bond and attach an evidence hash. The demo owner resolves the dispute; the losing side is penalized.
- Stake withdrawals use a 100-block cooldown. A reporter cannot submit while a withdrawal is pending.
- Deposited stake is accounted for separately and cannot be spent as rewards.
- The included detector recognizes repeated SSH login failures and multi-port scans from line-delimited JSON events.

## Repository layout

| Path | Purpose |
|---|---|
| `contracts/` | Token and threat registry contracts |
| `test/` | Hardhat protocol/security tests |
| `middleware/src/` | Fail-fast, validated HTTP relay |
| `middleware/test/` | Relay validation tests |
| `agent/` | Detector, signing agent, simulator, and tests |
| `scripts/deploy.js` | Local/testnet deployment |
| `Resources/` | Original project reports |

## Quick start

Requirements: Node.js 20 or newer and npm.

```bash
npm install
npm --prefix middleware install
npm --prefix agent install
npm run test:all
```

For an interactive local demo, use four terminals:

1. Start the chain: `npm run node`
2. Deploy: `npm run deploy:local`
3. Configure and run the relay: copy `middleware/.env.example` to `middleware/.env`, fill in the printed registry address, a Hardhat account private key for `RELAYER_PRIVATE_KEY`, and a random 24+ character API key; then run `npm run relay`.
4. Configure a sensor: copy `agent/.env.example` to `agent/.env`. Use the private key matching one of the three demo reporter addresses printed by the deployment (the local node prints its development keys), the same registry/API settings, and `CHAIN_ID=31337`.

The local deployment automatically authorizes, funds, and stakes its first three reporter accounts. Public-network deployments should perform those actions explicitly. For a three-node consensus demo, configure and run three sensor identities with different keys and device IDs while feeding each the same simulated source:

```bash
npm run agent:ssh
```

The simulator emits five failed SSH connections. The detector creates one signed `ssh-bruteforce` report and sends it to `POST /api/v1/reports`.

## Relay API

- `GET /health` — checks RPC connectivity; no secrets or balances are returned.
- `GET /api/v1/logs` — returns the latest 50 finalized/optimistic registry entries.
- `POST /api/v1/reports` — requires `Authorization: Bearer <INGEST_API_KEY>` and JSON:

```json
{
  "reporter": "0x...",
  "nonce": 0,
  "signature": "0x...",
  "report": {
    "attackerIP": "203.0.113.44",
    "attackType": "ssh-bruteforce",
    "dangerLevel": 3,
    "deviceId": "honeypot-01",
    "observedAt": 1789980000
  }
}
```

Accepted attack types are `port-scan`, `ssh-bruteforce`, `http-probe`, and `credential-stuffing`. Payloads are capped at 16 KiB and timestamps must be within the contract's freshness window.

## Security model and honest limitations

Keys and API secrets have no fallback values; startup fails when configuration is absent. Signatures protect reporter identity and report contents, while the bearer key limits unsolicited relay traffic. TLS and rate limiting belong in a reverse proxy for any networked deployment.

Consensus indicates that distinct enrolled keys agreed, not that an event is objectively true. Owner enrollment can admit Sybil identities. Dispute evidence is stored off-chain and only its hash is committed; owner arbitration is intentionally simple and centralized. IP addresses are public on-chain and should be hashed or otherwise handled under an appropriate privacy policy outside a classroom demo. The contract has tests but no independent audit.

See [TESTING.md](TESTING.md) for the verification matrix and [DEMO_GUIDE.md](DEMO_GUIDE.md) for a short presentation script.
