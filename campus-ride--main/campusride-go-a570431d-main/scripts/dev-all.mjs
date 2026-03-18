import { execSync, spawn } from "node:child_process";
import process from "node:process";

const FRONTEND_PORT = 8080;
const BACKEND_PORT = 4000;

function run(command) {
  return execSync(command, { stdio: ["ignore", "pipe", "ignore"] }).toString();
}

function killPort(port) {
  try {
    if (process.platform === "win32") {
      const output = run(`netstat -ano -p tcp | findstr :${port}`);
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

    const pids = run(`lsof -ti tcp:${port}`)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (const pid of pids) {
      execSync(`kill -9 ${pid}`, { stdio: "ignore" });
    }
  } catch {
    // Port is likely free; nothing to kill.
  }
}

function prefixedSpawn(label, command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[${label}] ${chunk}`);
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[${label}] ${chunk}`);
  });

  return child;
}

const root = process.cwd();
const backendCwd = `${root}/backend`;

console.log("[dev-all] freeing ports 4000 and 8080...");
killPort(BACKEND_PORT);
killPort(FRONTEND_PORT);

console.log("[dev-all] starting backend + frontend...");
const backend = prefixedSpawn("backend", "npm", ["run", "dev"], backendCwd);
const frontend = prefixedSpawn("frontend", "npm", ["run", "dev"], root);

function shutdown(code = 0) {
  backend.kill();
  frontend.kill();
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

backend.on("exit", (code) => {
  if (code && code !== 0) {
    console.error(`[dev-all] backend exited with code ${code}`);
    shutdown(code);
  }
});

frontend.on("exit", (code) => {
  if (code && code !== 0) {
    console.error(`[dev-all] frontend exited with code ${code}`);
    shutdown(code);
  }
});
