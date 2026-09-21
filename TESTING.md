# Testing

## Run everything

```bash
npm install
npm --prefix middleware install
npm --prefix agent install
npm run test:all
```

The root command runs three suites:

- Hardhat contract tests: severity-aware consensus, three distinct reporters, rewards, EIP-712 relay signatures and replay prevention, delayed unstaking, both dispute outcomes, and separation of stake from reward reserves.
- Relay tests: strict envelope, IP/severity, and timestamp validation.
- Detector tests: SSH brute-force and port-scan rules.

Useful narrower commands are `npm test`, `npm run test:middleware`, and `npm run test:agent`. `npm run compile` compiles without running tests.

## Manual smoke test

1. Run `npm run node` and leave it open.
2. Run `npm run deploy:local`; record both addresses.
3. Prepare `middleware/.env` from its example and run `npm run relay`.
4. `GET http://127.0.0.1:3000/health` should return `ok: true` and chain ID `31337`.
5. Prepare `agent/.env`, enroll/fund/stake that device address, then run `npm run agent:ssh`.
6. A single node with 100 ISEC produces a pending observation but no log. Three independently keyed agents observing the same event within the same five-minute bucket create one verified log. A single reporter with 500 ISEC creates an optimistic log instead.
7. `GET http://127.0.0.1:3000/api/v1/logs` shows resulting logs and numeric status: `0` verified, `1` optimistic, `2` challenged, `3` rejected.

Expected error checks:

- Missing/wrong bearer token: HTTP 401.
- Invalid IP, unsupported attack type, severity outside 1–4, malformed signature, or stale timestamp: HTTP 400.
- Reporter nonce differs from chain state: HTTP 409.
- Signature, authorization, stake, or chain failure: HTTP 502 with no internal error details leaked.
