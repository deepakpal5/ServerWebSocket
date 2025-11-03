import express from "express";
import { WebSocketServer } from "ws";
import http from "http";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static("public"));

// ✅ Fixed allowed endpoints
const allowedEndpoints = ["device1", "device2", "SmartMeter", "VFD"];

// ✅ Maps & tracking
const devices = new Map();       // endpoint → ws
const dashboards = new Set();    // dashboard sockets
const deviceLastSeen = new Map(); // endpoint → timestamp (ms)
const DEVICE_TIMEOUT = 10_000;   // ms → mark offline if no message for 10s

// ---- WebSocket Connection ----
wss.on("connection", (ws, req) => {
  ws.isIdentified = false;
  ws.isDevice = false;
  ws.endpoint = null;

  const url = req.url || "/";
  const match = url.match(/^\/data\/(.+)/);

  if (match) {
    // ===== DEVICE CONNECTED =====
    const endpoint = match[1];

    if (!allowedEndpoints.includes(endpoint)) {
      console.log(`🚫 Rejected unauthorized endpoint: ${endpoint}`);
      ws.close(4001, "Unauthorized endpoint");
      return;
    }

    ws.isDevice = true;
    ws.isIdentified = true;
    ws.endpoint = endpoint;
    devices.set(endpoint, ws);
    deviceLastSeen.set(endpoint, Date.now());

    console.log(`✅ Device connected → ${endpoint}`);
    broadcastStatus();

  } else {
    // ===== DASHBOARD CONNECTED =====
    ws.isDevice = false;
    ws.isIdentified = true;
    dashboards.add(ws);

    console.log("🖥️ Dashboard connected");
    sendStatus(ws);
  }

  // ===== MESSAGE HANDLER =====
  ws.on("message", (msg) => {
    if (ws.isDevice) {
      const endpoint = ws.endpoint;
      deviceLastSeen.set(endpoint, Date.now());

      const magDasghboard = JSON.stringify({
              endpoint,
              body: msg.toString(),
              ts: new Date().toISOString(),
            });
      // console.log(`📥 Received from ${endpoint}: ${magDasghboard.toString()}`);
      dashboards.forEach((dash) => {
        if (dash.readyState === 1) {
          dash.send(magDasghboard);
        }
      });
    } else {
      // Dashboard → Device
      try {
        const obj = JSON.parse(msg);
        const target = devices.get(obj.endpoint);
        if (target && target.readyState === 1) {
          target.send(obj.command || msg.toString());
          console.log(`📤 Sent to ${obj.endpoint}: ${obj.command}`);
        } else {
          console.log(`⚠️ No active device found for ${obj.endpoint}`);
        }
      } catch (e) {
        console.log("Invalid dashboard message:", msg.toString());
      }
    }
  });

  // ===== CLOSE HANDLER =====
  ws.on("close", () => {
    if (ws.isDevice) {
      devices.delete(ws.endpoint);
      deviceLastSeen.delete(ws.endpoint);
      console.log(`❌ Device disconnected: ${ws.endpoint}`);
    } else {
      dashboards.delete(ws);
      console.log("🖥️ Dashboard disconnected");
    }
    broadcastStatus();
  });
});

// ---- Periodic check for timeout ----
setInterval(() => {
  const now = Date.now();
  let statusChanged = false;

  for (const [endpoint, last] of deviceLastSeen.entries()) {
    if (now - last > DEVICE_TIMEOUT) {
      console.log(`⚠️ Device timeout: ${endpoint}`);
      deviceLastSeen.delete(endpoint);
      devices.delete(endpoint);
      statusChanged = true;
    }
  }

  if (statusChanged) broadcastStatus();
}, 3000);

// ---- Send status to one dashboard ----
function sendStatus(ws) {
  const statusList = allowedEndpoints.map((ep) => ({
    endpoint: ep,
    online: devices.has(ep),
  }));
  ws.send(JSON.stringify({ type: "status", data: statusList }));
}

// ---- Broadcast status to all dashboards ----
function broadcastStatus() {
  const statusList = allowedEndpoints.map((ep) => ({
    endpoint: ep,
    online: devices.has(ep),
  }));
  const msg = JSON.stringify({ type: "status", data: statusList });
  dashboards.forEach((d) => {
    if (d.readyState === 1) d.send(msg);
  });
}

// ---- REST API for allowed endpoints ----
app.get("/endpoints", (req, res) => {
  res.json(allowedEndpoints);
});

// ---- Start server ----
server.listen(5632, () => {
  console.log("✅ Server running on port 5632");
});
