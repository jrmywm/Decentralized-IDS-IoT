import test from "node:test";
import assert from "node:assert/strict";
import { validateEnvelope } from "../src/validation.js";

const valid = { reporter: `0x${"1".repeat(40)}`, nonce: 0, signature: `0x${"a".repeat(130)}`, report: { attackerIP: "203.0.113.4", attackType: "ssh-bruteforce", dangerLevel: 3, deviceId: "honeypot-01", observedAt: Math.floor(Date.now() / 1000) } };
test("accepts a strict report envelope", () => assert.equal(validateEnvelope(valid).report.deviceId, "honeypot-01"));
test("rejects invalid IP and severity", () => {
  assert.throws(() => validateEnvelope({ ...valid, report: { ...valid.report, attackerIP: "not-an-ip" } }), /attackerIP/);
  assert.throws(() => validateEnvelope({ ...valid, report: { ...valid.report, dangerLevel: 5 } }), /dangerLevel/);
});
test("rejects stale observations", () => assert.throws(() => validateEnvelope({ ...valid, report: { ...valid.report, observedAt: 1 } }), /observedAt/));
