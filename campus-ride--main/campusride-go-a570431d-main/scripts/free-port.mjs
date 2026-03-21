import { execSync } from "node:child_process";
import process from "node:process";

const rawPort = process.argv[2];
const port = Number(rawPort || 8080);

if (!Number.isInteger(port) || port <= 0) {
  console.error("Invalid port provided to free-port script.");
  process.exit(1);
}

function run(command) {
  return execSync(command, { stdio: ["ignore", "pipe", "ignore"] }).toString();
}

function killPort(targetPort) {
  try {
    if (process.platform === "win32") {
      const output = run(`netstat -ano -p tcp | findstr :${targetPort}`);
      const lines = output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => line.includes("LISTENING"));

      const pids = Array.from(new Set(lines.map((line) => line.split(/\s+/).pop()).filter(Boolean)));
      for (const pid of pids) {
        execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
      }
      return;
    }

    const pids = run(`lsof -ti tcp:${targetPort}`)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (const pid of pids) {
      execSync(`kill -9 ${pid}`, { stdio: "ignore" });
    }
  } catch {
    // Port likely free already.
  }
}

killPort(port);
console.log(`[free-port] ensured port ${port} is available.`);
