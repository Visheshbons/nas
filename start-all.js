/**
 * NAS/start-all.js
 *
 * This script automates starting the main server and the advertiser helper so
 * you can run one command (e.g. `npm start` or `npm run dev`) and both services
 * will be launched and managed automatically.
 *
 * Intended usage:
 *  - Add to your package.json scripts:
 *      "start": "node start-all.js"
 *      "dev": "node start-all.js --dev"
 *
 *  - Or run directly:
 *      node start-all.js            # production-style (uses `node` for server)
 *      node start-all.js --dev      # dev mode (attempts to use `nodemon` for the server)
 *
 * How it works:
 *  - Starts the main server (./server.js) using `node` or `nodemon` (dev).
 *  - Detects/uses a PORT which is chosen in this order:
 *      1. ADVERTISE_PORT env var
 *      2. PORT env var
 *      3. first CLI arg after flags (numeric)
 *      4. default 3000
 *  - Waits until the server emits a log line that looks like it's listening
 *    (tries a few heuristics). If no matching log line appears within a
 *    short timeout, the advertiser will still start using the chosen port.
 *  - Starts the advertiser helper (./advertise/advertise.js) and passes the
 *    port via env `ADVERTISE_PORT` and as a CLI arg for compatibility.
 *  - Forwards stdout/stderr from both processes with prefixes and handles
 *    cleanup on exit/signals.
 *
 * Notes:
 *  - This file is written as an ES module (consistent with package.json "type": "module").
 *  - It assumes you run it from the project root (where `server.js` and `advertise/advertise.js` live).
 *  - If your main server determines its port dynamically in a way that doesn't respect `process.env.PORT`,
 *    consider integrating the advertiser directly into your server process — I can help refactor if needed.
 */

import { spawn } from "child_process";
import { setTimeout as delay } from "timers/promises";
import path from "path";
import process from "process";
import { randomBytes } from "crypto";

const DEFAULT_PORT = 3000;
const SERVER_PATH = "./server.js";
const ADVERTISER_PATH = "./advertise/advertise.cjs";

function parsePortFromArgs() {
  // CLI can pass a numeric first non-flag arg, e.g. `node start-all.js 4000`
  for (const a of process.argv.slice(2)) {
    if (a === "--dev" || a === "-d") continue;
    const n = Number(a);
    if (Number.isInteger(n) && n > 0 && n <= 65535) return n;
  }
  return null;
}

function choosePort() {
  const envAdvertisePort = process.env.ADVERTISE_PORT;
  if (envAdvertisePort && Number.isInteger(Number(envAdvertisePort))) {
    return Number(envAdvertisePort);
  }
  const envPort = process.env.PORT;
  if (envPort && Number.isInteger(Number(envPort))) {
    return Number(envPort);
  }
  const argPort = parsePortFromArgs();
  if (argPort) return argPort;
  return DEFAULT_PORT;
}

function isDevMode() {
  // npm sets npm_lifecycle_event to "dev" when running "npm run dev"
  const lifecycle = process.env.npm_lifecycle_event;
  return (
    lifecycle === "dev" ||
    process.argv.includes("--dev") ||
    process.argv.includes("-d") ||
    process.env.DEV === "true" ||
    process.env.NODE_ENV === "development"
  );
}

function prefixLogger(prefix, chunk) {
  const lines = String(chunk).split(/\r?\n/);
  return lines
    .filter(Boolean)
    .map((l) => `[${prefix}] ${l}`)
    .join("\n");
}

function spawnProcess(name, command, args = [], options = {}) {
  const child = spawn(command, args, options);

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");

  child.stdout.on("data", (chunk) => {
    console.log(prefixLogger(name, chunk));
  });

  child.stderr.on("data", (chunk) => {
    console.error(prefixLogger(name, chunk));
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      console.log(`[${name}] exited with signal ${signal}`);
    } else {
      console.log(`[${name}] exited with code ${code}`);
    }
  });

  return child;
}

async function waitForServerListening(child, timeoutMs = 5000) {
  // Listen for stdout lines that indicate the server is listening.
  // This is heuristic-based; many servers print words like "listening", "started", "port"
  // We'll hook into stdout and resolve when a matching line shows up.
  return new Promise((resolve) => {
    let resolved = false;

    const patterns = [
      /listening/i,
      /listening on/i,
      /server listening/i,
      /server started/i,
      /listening at/i,
      /on port/i,
      /port\s*\d+/i,
    ];

    function handleChunk(chunk) {
      const text = String(chunk);
      for (const p of patterns) {
        if (p.test(text)) {
          cleanup();
          resolved = true;
          resolve(true);
          return;
        }
      }
    }

    function cleanup() {
      if (child.stdout) child.stdout.off("data", handleChunk);
      if (timer) clearTimeout(timer);
    }

    // Some processes may not print anything useful. If child exits early, resolve false.
    child.on("exit", () => {
      if (!resolved) {
        cleanup();
        resolve(false);
      }
    });

    if (child.stdout) child.stdout.on("data", handleChunk);

    // fallback timeout
    const timer = setTimeout(() => {
      if (!resolved) {
        cleanup();
        resolve(false);
      }
    }, timeoutMs);
  });
}

async function main() {
  const port = choosePort();
  const dev = isDevMode();

  console.log(`start-all: chosen port: ${port}`);
  console.log(`start-all: dev mode: ${dev ? "yes" : "no"}`);

  // Prepare environment for server process
  const AUTHTOKEN =
    process.env.ADVERTISE_TOKEN || randomBytes(16).toString("hex");
  const serverEnv = {
    ...process.env,
    PORT: String(port),
    ADVERTISE_TOKEN: AUTHTOKEN,
  };

  // Choose whether to use nodemon for the server in dev mode
  const serverRunner = dev ? "nodemon" : "node";
  const serverArgs = [SERVER_PATH];

  console.log(
    `start-all: spawning server: ${serverRunner} ${serverArgs.join(" ")}`,
  );

  // Spawn server process
  const server = spawnProcess("server", serverRunner, serverArgs, {
    env: serverEnv,
    stdio: ["inherit", "pipe", "pipe"],
  });

  // Wait until server looks like it's listening (or timeouts)
  const serverReady = await waitForServerListening(server, 4000);

  if (serverReady) {
    console.log("start-all: server signaled ready (listening)");
  } else {
    console.log(
      "start-all: server did not signal ready within timeout, starting advertiser anyway",
    );
  }

  // Start advertiser helper
  const advertiserEnv = {
    ...process.env,
    ADVERTISE_PORT: String(port),
    PORT: String(port),
  };
  const advertiserArgs = [ADVERTISER_PATH, String(port)];
  console.log(
    `start-all: spawning advertiser: node ${advertiserArgs.join(" ")}`,
  );

  const advertiser = spawnProcess("advertiser", "node", advertiserArgs, {
    env: advertiserEnv,
    stdio: ["inherit", "pipe", "pipe"],
  });

  // When either exits, shut down the other and exit
  function shutdown(reason) {
    console.log(`start-all: shutting down due to: ${reason}`);
    const toKill = [server, advertiser];
    for (const ch of toKill) {
      if (!ch || ch.killed) continue;
      try {
        ch.kill("SIGTERM");
      } catch (e) {
        try {
          ch.kill("SIGKILL");
        } catch (e2) {}
      }
    }
    // Give processes a moment to exit cleanly, then force exit.
    setTimeout(() => {
      process.exit(0);
    }, 1500);
  }

  server.on("exit", (code, signal) => {
    if (signal || code !== 0) {
      shutdown(`server exited (code=${code}, signal=${signal})`);
    } else {
      // server exited gracefully; still shutdown advertiser
      shutdown("server exited gracefully");
    }
  });

  advertiser.on("exit", (code, signal) => {
    if (signal || code !== 0) {
      shutdown(`advertiser exited (code=${code}, signal=${signal})`);
    } else {
      // advertiser exited gracefully; keep server running? For simplicity, shut everything down.
      shutdown("advertiser exited gracefully");
    }
  });

  // Forward common termination signals
  process.on("SIGINT", () => {
    shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    shutdown("SIGTERM");
  });

  // In dev mode, keep the parent process alive while children run.
  // If not dev, the server is expected to be the main long-running process.
  // This script will exit only when children exit.
}

main().catch((err) => {
  console.error("start-all: fatal error", err);
  process.exit(1);
});
