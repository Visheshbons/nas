// ---------- Initialisation ---------- \\
import express from "express";
import chalk from "chalk";
import os from "os";

const app = express();
const port = process.env.PORT || 3000;

const dev = false; // Set to true to block network access

// ---------- Functions ---------- \\
/**
 * Iterates through network interfaces to find the primary non-internal IPv4 address.
 * @returns {string} The detected network IP or 'localhost' as a fallback.
 */
function getNetworkIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // We look for IPv4 and ensure it's not the internal loopback address (127.0.0.1)
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  // Fallback to localhost if no external IP is found
  return "localhost";
}

// ---------- Routes ---------- \\
app.get("/", (req, res) => {
  res.status(200).send("Hello");
});

// ---------- Server Start ---------- \\
// If 'dev' is false, bind to '0.0.0.0' (all network interfaces).
app.listen(port, dev ? "127.0.0.1" : "0.0.0.0", () => {
  const ipAddress = getNetworkIP(); // Get the detected network IP

  console.log(`Server is up and running on port ${chalk.green(port)}!`);

  if (dev) {
    const localUrl = `http://localhost:${port}`;
    console.log(`Development Mode: Network access is ${chalk.red("BLOCKED")}.`);
    console.log(`Access locally at ${chalk.cyan(localUrl)}`);
  } else {
    const accessibleUrl = `http://${ipAddress}:${port}`;
    console.log(`Network Mode: External access is ${chalk.green("ALLOWED")}.`);
    console.log(`Access on your network at ${chalk.cyan(accessibleUrl)}`);
  }
});
