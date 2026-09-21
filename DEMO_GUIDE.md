# Five-minute demo

1. Explain the boundary: the edge agent detects; the contract coordinates trust and incentives. Do not call the detector itself decentralized.
2. Run `npm run test:all` to show protocol, relay, and detector checks.
3. Pipe simulated SSH failures into one agent. Show the readable JSON events, the resulting signed finding, and its transaction hash.
4. Explain that the relay is merely a gas sponsor: changing IP, severity, device ID, time, or nonce invalidates the sensor's EIP-712 signature.
5. Show three different reporter addresses reaching consensus. Then contrast a 500-ISEC optimistic report and its challenge window.
6. Walk through a challenge: evidence is hashed, a challenger locks a bond, and the demo owner resolves it. State plainly that owner arbitration is a deliberate educational simplification.
7. Close with limitations: enrolled identities are not Sybil-proof, evidence is off-chain, public IP data has privacy implications, and the contracts are unaudited.
