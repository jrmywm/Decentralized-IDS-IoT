import test from "node:test";
import assert from "node:assert/strict";
import { Detector } from "../detector.js";
test("detects repeated SSH failures once per source and window", () => { const detector = new Detector(); let finding; for (let i = 0; i < 5; i++) finding = detector.observe({ timestamp: 100 + i, sourceIP: "203.0.113.8", destinationPort: 22, outcome: "failed" }); assert.equal(finding.attackType, "ssh-bruteforce"); assert.equal(detector.observe({ timestamp: 106, sourceIP: "203.0.113.8", destinationPort: 22, outcome: "failed" }), null); });
test("detects a horizontal port scan", () => { const detector = new Detector(); let finding; for (let port = 1; port <= 8; port++) finding = detector.observe({ timestamp: 100, sourceIP: "198.51.100.3", destinationPort: port, outcome: "failed" }); assert.equal(finding.attackType, "port-scan"); });
