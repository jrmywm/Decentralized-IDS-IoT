import net from "node:net";

/** Small, explainable detector for JSON events from a honeypot or the included simulator. */
export class Detector {
  constructor({ windowSeconds = 60, sshThreshold = 5, scanThreshold = 8 } = {}) {
    this.windowSeconds = windowSeconds; this.sshThreshold = sshThreshold; this.scanThreshold = scanThreshold;
    this.events = new Map(); this.emitted = new Set();
  }
  observe(event) {
    if (!event || net.isIP(event.sourceIP) === 0 || !Number.isInteger(event.destinationPort)) throw new Error("invalid network event");
    const timestamp = event.timestamp ?? Math.floor(Date.now() / 1000);
    const bucket = Math.floor(timestamp / this.windowSeconds);
    const key = `${event.sourceIP}:${bucket}`;
    const history = this.events.get(key) || [];
    history.push({ ...event, timestamp }); this.events.set(key, history);
    if (this.emitted.has(key)) return null;
    const ports = new Set(history.map((item) => item.destinationPort));
    const sshFailures = history.filter((item) => item.destinationPort === 22 && item.outcome === "failed").length;
    let finding = null;
    if (ports.size >= this.scanThreshold) finding = { attackType: "port-scan", dangerLevel: 2 };
    else if (sshFailures >= this.sshThreshold) finding = { attackType: "ssh-bruteforce", dangerLevel: 3 };
    if (!finding) return null;
    this.emitted.add(key);
    return { attackerIP: event.sourceIP, observedAt: timestamp, ...finding };
  }
}
