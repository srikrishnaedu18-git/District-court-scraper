const { spawn } = require("child_process");

const backendPort = process.env.INTERNAL_BACKEND_PORT || "3000";
const internalServiceUrl =
  process.env.INTERNAL_SERVICE_URL || `http://127.0.0.1:${backendPort}`;

function startProcess(name, command, args, env) {
  const child = spawn(command, args, {
    env,
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    console.log(`${name} exited with code ${code ?? "null"} signal ${signal ?? "null"}`);
    shutdown(code || 1);
  });

  child.on("error", (error) => {
    console.error(`${name} failed to start:`, error);
    shutdown(1);
  });

  return child;
}

const backend = startProcess("backend", "node", ["server.js"], {
  ...process.env,
  PORT: backendPort,
});

const gateway = startProcess("gateway", "node", ["gateway/server.js"], {
  ...process.env,
  INTERNAL_SERVICE_URL: internalServiceUrl,
});

let shuttingDown = false;

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  if (!backend.killed) backend.kill("SIGTERM");
  if (!gateway.killed) gateway.kill("SIGTERM");

  setTimeout(() => process.exit(exitCode), 500);
}

process.on("SIGTERM", () => shutdown(0));
process.on("SIGINT", () => shutdown(0));
