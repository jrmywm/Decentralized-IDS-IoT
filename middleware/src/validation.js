import net from "node:net";

const allowedTypes = new Set(["port-scan", "ssh-bruteforce", "http-probe", "credential-stuffing"]);
export function validateEnvelope(body) {
  if (!body || typeof body !== "object" || !body.report || typeof body.report !== "object") throw new Error("body.report is required");
  const { reporter, nonce, signature, report } = body;
  if (typeof reporter !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(reporter)) throw new Error("reporter must be an Ethereum address");
  if (!Number.isSafeInteger(nonce) || nonce < 0) throw new Error("nonce must be a non-negative integer");
  if (typeof signature !== "string" || !/^0x[0-9a-fA-F]{130}$/.test(signature)) throw new Error("invalid signature encoding");
  if (net.isIP(report.attackerIP) === 0) throw new Error("attackerIP must be an IPv4 or IPv6 address");
  if (!allowedTypes.has(report.attackType)) throw new Error("unsupported attackType");
  if (!Number.isInteger(report.dangerLevel) || report.dangerLevel < 1 || report.dangerLevel > 4) throw new Error("dangerLevel must be 1..4");
  if (typeof report.deviceId !== "string" || !/^[a-zA-Z0-9_-]{3,64}$/.test(report.deviceId)) throw new Error("invalid deviceId");
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(report.observedAt) || report.observedAt > now + 300 || report.observedAt < now - 3600) throw new Error("observedAt is outside the accepted window");
  return { reporter, nonce, signature, report };
}
