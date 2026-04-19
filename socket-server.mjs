import { createServer } from "node:http";
import { Server } from "socket.io";
import { createClient } from "redis";

const SOCKET_PORT = Number(process.env.SOCKET_PORT || 4001);
const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const REDIS_URL = process.env.REDIS_URL;
const CHANNEL = "notifications:events";

const httpServer = createServer((_, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true, service: "notification-socket" }));
});

const io = new Server(httpServer, {
  cors: {
    origin: [APP_ORIGIN],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  socket.on("join", ({ userId }) => {
    if (!userId) return;
    socket.join(`user:${String(userId)}`);
  });
});

async function startRedisSubscriber() {
  if (!REDIS_URL) {
    console.warn("Socket server started without REDIS_URL; realtime events will be disabled.");
    return;
  }

  const subscriber = createClient({ url: REDIS_URL });
  subscriber.on("error", (error) => {
    console.error("Socket Redis subscriber error:", error?.message || error);
  });

  await subscriber.connect();
  await subscriber.subscribe(CHANNEL, (payload) => {
    try {
      const parsed = JSON.parse(payload || "{}");
      const userId = parsed?.userId;
      if (!userId) return;

      io.to(`user:${String(userId)}`).emit("notification:update", {
        type: parsed?.type || "changed",
        at: parsed?.at || new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to parse notification event payload:", error?.message || error);
    }
  });

  console.log(`Socket Redis subscriber listening on ${CHANNEL}`);
}

httpServer.listen(SOCKET_PORT, async () => {
  console.log(`Socket.IO notification server listening on :${SOCKET_PORT}`);
  await startRedisSubscriber();
});
