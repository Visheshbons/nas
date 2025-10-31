/**
 * NAS/advertise/advertise.js
 *
 * Advertises the local NAS over mDNS (Bonjour) and SSDP/UPnP so it appears
 * in other systems' \"Network\" / \"Network Storage\" UI. When clicked, the
 * discovery entry redirects to the advertised HTTP presentation URL
 * (http://<local-ip>:<port>/).
 *
 * Usage:
 *   - Install dependencies:
 *       npm install node-ssdp bonjour
 *
 *   - Run:
 *       node advertise.js [PORT]
 *     Or set environment variables:
 *       ADVERTISE_PORT=4000 ADVERTISE_NAME=\"My NAS\" node advertise.js
 *
 * Behavior:
 *   - Port is chosen (in order): `ADVERTISE_PORT` env var, `PORT` env var,
 *     first CLI arg, fallback 3000.
 *   - Advertises a simple HTTP helper that serves /device.xml (UPnP device
 *     description) and redirects / to the presentation URL.
 *   - Publishes mDNS service (_http._tcp) with Bonjour.
 *   - Broadcasts SSDP NOTIFY messages for `upnp:rootdevice` and
 *     `urn:schemas-upnp-org:device:MediaServer:1`.
 *
 * Notes:
 *   - This script does not modify your main server; instead it announces
 *     whichever port you configure when launching the advertiser. If you
 *     already run a Node.js server you can pass its port to this script
 *     (via env or arg), or integrate calls to this advertiser from within
 *     that server.
 *
 *   - Some OS-level network/firewall rules or local network switch/route
 *     configurations can block mDNS/SSDP discovery. Make sure UDP multicast
 *     is allowed on the network.
 */

const http = require("http");
const os = require("os");
const path = require("path");
const fs = require("fs");
const { Server: SsdpServer } = require("node-ssdp");
const bonjour = require("bonjour")();

/**
 * Return first non-internal IPv4 address found, or loopback as fallback.
 */
function getLocalIPv4() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
}

/**
 * Determine port and name using env vars, then CLI args, then defaults.
 * If no env/arg provided, attempt to parse the default port from ../server.js
 * so the advertiser automatically uses the same default as the main server.
 */
function detectRequestedPort() {
  // 1) explicit env/arg
  const envAdvertise =
    process.env.ADVERTISE_PORT || process.env.PORT || process.argv[2];
  if (envAdvertise) {
    const n = parseInt(envAdvertise, 10);
    if (!Number.isNaN(n)) return n;
  }

  // 2) attempt to read ../server.js for a default port constant
  try {
    const serverPath = path.join(__dirname, "..", "server.js");
    if (fs.existsSync(serverPath)) {
      const content = fs.readFileSync(serverPath, "utf8");

      // Try common patterns used in server.js to declare the port
      const patterns = [
        /(?:const|let|var)\s+port\s*=\s*process\.env\.PORT\s*\|\|\s*(\d+)/i,
        /(?:const|let|var)\s+port\s*=\s*(\d+)/i,
        /process\.env\.PORT\s*\|\|\s*(\d+)/i,
      ];

      for (const p of patterns) {
        const m = content.match(p);
        if (m && m[1]) {
          const parsed = parseInt(m[1], 10);
          if (!Number.isNaN(parsed)) return parsed;
        }
      }

      // As a last resort, pick a nearby numeric literal that looks like a port
      const anyMatch = content.match(/\b(\d{3,5})\b/);
      if (anyMatch) {
        const parsed = parseInt(anyMatch[1], 10);
        if (parsed >= 1 && parsed <= 65535) return parsed;
      }
    }
  } catch (e) {
    // ignore parse errors and fall back
  }

  // 3) fallback
  return 3000;
}

const PORT = detectRequestedPort();
const NAME = process.env.ADVERTISE_NAME || "MyNAS";
const DESCRIPTION = process.env.ADVERTISE_DESCRIPTION || "Node.js NAS";
const ip = getLocalIPv4();

/**
 * Build a simple UPnP device description XML. The presentationURL points to
 * the advertised HTTP endpoint so many file browsers will open the browser
 * when the discovery entry is clicked.
 */
function buildDeviceXml(name, presentationUrl) {
  const udn = `uuid:node-nas-${Math.random().toString(16).slice(2)}`;
  return (
    `<?xml version="1.0"?>\n` +
    `<root xmlns="urn:schemas-upnp-org:device-1-0">\n` +
    `  <specVersion><major>1</major><minor>0</minor></specVersion>\n` +
    `  <device>\n` +
    `    <deviceType>urn:schemas-upnp-org:device:MediaServer:1</deviceType>\n` +
    `    <friendlyName>${escapeXml(name)}</friendlyName>\n` +
    `    <manufacturer>Custom NAS</manufacturer>\n` +
    `    <modelName>Node NAS</modelName>\n` +
    `    <UDN>${udn}</UDN>\n` +
    `    <presentationURL>${presentationUrl}</presentationURL>\n` +
    `  </device>\n` +
    `</root>`
  );
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Simple HTTP helper server:
 *  - GET /device.xml  -> returns UPnP device description
 *  - GET /           -> 302 redirect to the presentation URL
 *  - other paths     -> 404
 */
const AUTHTOKEN = process.env.ADVERTISE_TOKEN || null;
const basePresentationUrl = `http://${ip}:${PORT}/`;
const presentationUrl = AUTHTOKEN
  ? `${basePresentationUrl}?authtoken=${encodeURIComponent(AUTHTOKEN)}`
  : basePresentationUrl;
const deviceXml = buildDeviceXml(NAME, presentationUrl);

const server = http.createServer((req, res) => {
  if (req.url === "/device.xml") {
    res.writeHead(200, { "Content-Type": "application/xml" });
    res.end(deviceXml);
    return;
  }

  // Redirect root (and any other requests) to the presentation URL.
  if (req.url === "/" || req.url === "") {
    res.writeHead(302, { Location: presentationUrl });
    res.end(`Redirecting to ${presentationUrl}`);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

/**
 * Start the helper server and then advertise via mDNS and SSDP.
 *
 * The helper will attempt to bind to the requested port. If the port is already
 * in use (EADDRINUSE), it will automatically try the next port until it finds a
 * free one (up to `maxTries`), updating the presentation URL and SSDP location
 * to match the actual bound port.
 */
let ssdp = null;

function startAdvertisingOn(port) {
  // The helper may bind to a different (helper) port, but the presentation URL
  // should always point to the requested main server port (REQUESTED_PORT).
  console.log(`Advertiser HTTP helper listening on ${ip}:${port}`);
  console.log(`Presentation URL: ${presentationUrl}`);

  // mDNS (Bonjour) advertisement
  try {
    // Publish the mDNS service so clients will open the main server port when clicked.
    // Include the authtoken in the TXT records when present so discovery clients can
    // know to open the presentation URL with the token (or use it themselves).
    const txtObj = { description: DESCRIPTION, path: "/" };
    if (process.env.ADVERTISE_TOKEN) {
      txtObj.authtoken = process.env.ADVERTISE_TOKEN;
    }
    bonjour.publish({
      name: NAME,
      type: "http",
      port: PORT,
      txt: txtObj,
      // advertise an IP explicitly (bonjour will typically bind to all interfaces)
      host: ip,
    });
    console.log("Published mDNS (_http._tcp) via Bonjour");
  } catch (err) {
    console.warn(
      "Failed to publish mDNS via Bonjour:",
      err && err.message ? err.message : err,
    );
  }

  // SSDP / UPnP advertisement
  try {
    ssdp = new SsdpServer({
      location: `http://${ip}:${port}/device.xml`,
      udn: `uuid:node-nas-${Math.random().toString(16).slice(2)}`,
      // TTL and other options can be passed here if desired
    });

    // Add common USNs so clients looking for root devices / media servers will find us
    ssdp.addUSN("upnp:rootdevice");
    ssdp.addUSN("urn:schemas-upnp-org:device:MediaServer:1");

    ssdp.start(() => {
      console.log("SSDP/UPnP adverts started");
    });

    // Keep a reference so we can stop it on exit
    process.on("exit", () => {
      try {
        if (ssdp) ssdp.stop();
      } catch (e) {
        /* ignore */
      }
    });
    process.on("SIGINT", () => process.exit(0));
    process.on("SIGTERM", () => process.exit(0));
  } catch (err) {
    console.warn(
      "Failed to start SSDP/UPnP:",
      err && err.message ? err.message : err,
    );
  }
}

function tryListen(startPort, maxTries = 10) {
  let attempts = 0;

  function attempt(port) {
    attempts++;
    // Remove any previous listeners to avoid duplicate handlers when retrying
    server.removeAllListeners("listening");
    server.removeAllListeners("error");

    server.once("listening", () => {
      // Successfully bound - start advertising on the actual port
      const address = server.address();
      const boundPort = address && address.port ? address.port : port;
      startAdvertisingOn(boundPort);
    });

    server.once("error", (err) => {
      if (err && err.code === "EADDRINUSE") {
        if (attempts < maxTries) {
          const nextPort = port + 1;
          console.warn(`Port ${port} in use, trying ${nextPort}...`);
          // small delay before retrying to avoid rapid-fire attempts
          setTimeout(() => attempt(nextPort), 200);
        } else {
          console.error(`Failed to bind after ${attempts} attempts:`, err);
          process.exit(1);
        }
      } else {
        console.error("Failed to bind HTTP helper server:", err);
        process.exit(1);
      }
    });

    try {
      server.listen(port, ip);
    } catch (listenErr) {
      // synchronous listen error (rare) - handle similarly
      server.emit("error", listenErr);
    }
  }

  attempt(startPort);
}

// Start attempting to bind (this replaces the single listen() call)
tryListen(PORT, 50);

/**
 * Cleanup bonjour on exit
 */
function cleanupAndExit() {
  try {
    bonjour.unpublishAll(() => {
      try {
        bonjour.destroy();
      } catch (e) {
        /* ignore */
      }
      process.exit(0);
    });
    // If unpublishAll doesn't call back quickly, force exit
    setTimeout(() => process.exit(0), 2000);
  } catch (e) {
    process.exit(0);
  }
}

process.on("SIGINT", cleanupAndExit);
process.on("SIGTERM", cleanupAndExit);
process.on("exit", () => {
  try {
    bonjour.unpublishAll();
    bonjour.destroy();
  } catch (e) {}
});
