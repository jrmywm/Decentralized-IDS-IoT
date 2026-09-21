const sourceIP = process.argv[2] || "203.0.113.44";
const mode = process.argv[3] || "ssh";
const now = Math.floor(Date.now() / 1000);
const ports = mode === "scan" ? [21, 22, 23, 25, 53, 80, 443, 8080] : [22, 22, 22, 22, 22];
for (const [index, destinationPort] of ports.entries()) console.log(JSON.stringify({ timestamp: now + index, sourceIP, destinationPort, outcome: "failed" }));
