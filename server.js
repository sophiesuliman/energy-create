import express from "express";
import { WebSocketServer } from "ws";
import http from "http";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// serve static files
app.use(express.static("public"));

const STATE = {
  phones: new Set(),
  screens: new Set(),
};

wss.on("connection", (ws, req) => {
  ws.isAlive = true;
  ws.on("pong", () => (ws.isAlive = true));

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === "hello" && msg.role === "screen") {
        STATE.screens.add(ws);
        ws.send(JSON.stringify({ type: "ack", role: "screen" }));
      } else if (msg.type === "hello" && msg.role === "phone") {
        STATE.phones.add(ws);
        ws.send(JSON.stringify({ type: "ack", role: "phone" }));
      } else if (msg.type === "energy" && STATE.phones.has(ws)) {
        // relay to screens immediately
        const payload = JSON.stringify({ type: "energy", value: Number(msg.value)||0 });
        for (const s of STATE.screens) try { s.send(payload); } catch {}
      }
    } catch {}
  });

  ws.on("close", () => {
    STATE.phones.delete(ws);
    STATE.screens.delete(ws);
  });
});

// heartbeat to clean dead sockets
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    try { ws.ping(); } catch {}
  });
}, 15000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`➡ open main screen:   http://localhost:${PORT}/screen.html`);
  console.log(`➡ open phone join:    http://localhost:${PORT}/phone.html`);
  console.log(`(for friends: replace localhost with your laptop’s local IP on same Wi-Fi)`);
});
