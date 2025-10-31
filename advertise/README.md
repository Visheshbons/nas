NAS/advertise/README.md
# NAS Advertising Helper

This small helper advertises your NAS on the local network so it appears in other systems' "Network" / "Network Storage" discovery UI. It uses mDNS (Bonjour) and SSDP/UPnP to announce an HTTP presentation URL (http://<local-ip>:<port>/). When a client clicks the discovered entry, most file explorers will open the advertised URL in a web browser.

I created this helper to be run alongside (or in front of) your main Node.js server; it does not modify your main server. Instead, it advertises whichever port you point it at.

Contents
- `advertise.js` — the Node.js advertiser script
- this README — usage, integration notes, and troubleshooting

Prerequisites
- Node.js (v12+ recommended)
- Network allows multicast UDP (mDNS) and SSDP (UDP 1900)
- If running on Linux, you may need to allow mDNS/UPnP through firewalls (see Troubleshooting)

Install dependencies
Use npm to install required packages in the `NAS/advertise` directory:

```NAS/advertise/README.md#L1-6
npm install node-ssdp bonjour
```

Usage
You can run the advertiser as a standalone process. The port advertised can be passed as the first CLI argument or configured by environment variable.

Basic run (advertise port 3000 by default):
```NAS/advertise/README.md#L7-12
node advertise.js
```

Specify port via CLI:
```NAS/advertise/README.md#L13-18
node advertise.js 4000
```

Or via environment variables:
```NAS/advertise/README.md#L19-24
ADVERTISE_PORT=4000 ADVERTISE_NAME="My NAS" node advertise.js
```

Environment variables
- `ADVERTISE_PORT` — port number to advertise (overrides CLI arg)
- `ADVERTISE_NAME` — friendly name shown in discovery UI (default: `MyNAS`)
- `ADVERTISE_DESCRIPTION` — optional description published via mDNS
- `PORT` — alternative environment variable used if `ADVERTISE_PORT` not set

How it works (high level)
- Starts a small HTTP helper bound to the local non-internal IPv4 address and the chosen port.
- Serves `/device.xml` with a simple UPnP device description that contains a `presentationURL` pointing at `http://<local-ip>:<port>/`.
- Redirects root (`/`) requests to `presentationURL`.
- Publishes an mDNS (`_http._tcp`) service using Bonjour.
- Broadcasts SSDP NOTIFY messages advertising `upnp:rootdevice` and `urn:schemas-upnp-org:device:MediaServer:1`.

Integrating with your existing Node.js server
You have two options:

1) Run this helper alongside your server and point it at your server's port:
   - Keep your main server running on port 4000.
   - Start the advertiser with `ADVERTISE_PORT=4000 node advertise.js`.
   - The advertiser serves only `/device.xml` and redirects the root to your server; discovery UIs will link to your existing server.

2) Integrate advertiser logic into your server:
   - If you prefer a single process, you can require the advertiser module or copy the relevant advertisement code into your server startup procedure so it advertises dynamically based on the port your server is actually listening on.
   - When integrated, make sure you use the same IP/port pair that the server binds to (especially important with containers / multiple interfaces).

Notes about IP selection
- The helper picks the first non-internal IPv4 address found on the host. If your machine has multiple network interfaces, you may need to modify the script to select the correct interface (or bind explicitly).
- If your server is behind NAT (home router), discovery will work only on the local LAN — remote discovery across the internet is not supported by mDNS/SSDP.

Troubleshooting
- Discovered but click does nothing:
  - Verify the advertised port is accessible from the client machine (try opening `http://<server-ip>:<port>/` in a browser from another device).
  - Check local firewall rules (Linux: `ufw`, `iptables`); allow incoming TCP to the advertised port and allow UDP multicast for mDNS/SSDP.
- Not discovered at all:
  - Confirm multicast and UDP 1900 traffic are not blocked on the local network (some enterprise Wi‑Fi or guest networks block multicast).
  - Ensure both your advertiser and the client are on the same subnet.
  - Some clients cache discovery results — try toggling network discovery in the client or restarting the client machine.
- Multiple IPs or containers:
  - When running inside Docker or other containers, use host networking or publish the correct host interface IP. The helper detects the first non-internal IPv4; update `advertise.js` if you need explicit control.

Security and privacy
- The advertiser announces a presentation URL and basic metadata only. It does not open any extra ports beyond the one you choose.
- Be mindful of exposing the NAS UI to untrusted networks; use authentication on your main server if necessary.

Advanced
- You can modify `advertise.js` to publish additional TXT records or USNs, or to advertise other service types.
- To advertise a different service type (e.g., a custom protocol), change the mDNS `type` and the UPnP `deviceType`/USNs accordingly.

If you want, I can:
- Provide an example of integrating the advertiser into your existing server startup.
- Add options to specify which network interface to use.
- Add systemd unit or cross-platform startup instructions.
