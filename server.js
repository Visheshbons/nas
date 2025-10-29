import express from "express";
import chalk from "chalk";
import os from "os";

const app = express();
const port = process.env.PORT || 3000;

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

// Tell Express to listen on all network interfaces (0.0.0.0), not just localhost.
app.listen(port, "0.0.0.0", () => {
  const ipAddress = getNetworkIP(); // Get the detected IP
  const accessibleUrl = `http://${ipAddress}:${port}`; // Construct the full URL

  console.log(`Server is up and running on port ${chalk.green(port)}!`);
  // Use chalk.cyan for a nice color to highlight the URL!
  console.log(`Accessible on your network at ${chalk.cyan(accessibleUrl)}`);
});
