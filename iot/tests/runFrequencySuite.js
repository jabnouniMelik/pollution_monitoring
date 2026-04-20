const { spawn } = require("child_process");
const path = require("path");

function killProcessTree(pid) {
  return new Promise((resolve) => {
    if (!pid) return resolve();

    if (process.platform === "win32") {
      const killer = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
        stdio: "ignore",
      });
      killer.on("close", () => resolve());
      killer.on("error", () => resolve());
      return;
    }

    try {
      process.kill(-pid, "SIGTERM");
    } catch (_) {
      try {
        process.kill(pid, "SIGTERM");
      } catch (_) {}
    }
    resolve();
  });
}

async function runSuite() {
  const iotRoot = path.resolve(__dirname, "..");

  console.log("[suite] Starting simulator in warning mode...");
  const simulator = spawn("node", ["simulator.js", "warning"], {
    cwd: iotRoot,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });

  simulator.stdout.on("data", (chunk) => {
    process.stdout.write(`[simulator] ${chunk}`);
  });

  simulator.stderr.on("data", (chunk) => {
    process.stderr.write(`[simulator:err] ${chunk}`);
  });

  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log("[suite] Running frequency test...");
  const frequencyTest = spawn("node", ["tests/frequencyTest.js"], {
    cwd: iotRoot,
    stdio: "inherit",
  });

  frequencyTest.on("close", async (code) => {
    console.log("[suite] Frequency test finished, stopping simulator...");
    await killProcessTree(simulator.pid);
    process.exit(code || 0);
  });

  frequencyTest.on("error", async (err) => {
    console.error("[suite] Failed to run frequency test:", err.message);
    await killProcessTree(simulator.pid);
    process.exit(1);
  });

  process.on("SIGINT", async () => {
    await killProcessTree(simulator.pid);
    process.exit(130);
  });

  process.on("SIGTERM", async () => {
    await killProcessTree(simulator.pid);
    process.exit(143);
  });
}

runSuite().catch((err) => {
  console.error("[suite] Unexpected error:", err.message);
  process.exit(1);
});
