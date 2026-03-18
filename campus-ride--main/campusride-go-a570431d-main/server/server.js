import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";

// Realtime Campus Ride tracking server (Express + Socket.IO).

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const publicDir = path.join(projectRoot, "public");

const PORT = Number(process.env.PORT || 4000);
const MIN_LOCATION_INTERVAL_MS = 1500;

const TMU_CENTER = { lat: 28.8244, lng: 78.6579 };

const app = express();
app.use(express.static(publicDir));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "realtime-campus-ride-tracker" });
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

const rideStateById = new Map();
const latestEmitAtByKey = new Map();

function getDefaultRideState(rideId) {
  return {
    rideId,
    status: "requested",
    driverName: "Campus Driver",
    passengerName: "Campus Passenger",
    driverLocation: null,
    passengerLocation: null,
    updatedAt: Date.now(),
  };
}

function getRideState(rideId) {
  const safeRideId = String(rideId || "demo-ride-1");
  if (!rideStateById.has(safeRideId)) {
    rideStateById.set(safeRideId, getDefaultRideState(safeRideId));
  }
  return rideStateById.get(safeRideId);
}

function toLocation(payload) {
  const lat = Number(payload?.lat);
  const lng = Number(payload?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng, updatedAt: Date.now() };
}

function canEmitLocation(rideId, role) {
  // Lightweight server-side anti-spam guard for location events.
  const key = `${rideId}:${role}`;
  const now = Date.now();
  const last = latestEmitAtByKey.get(key) || 0;
  if (now - last < MIN_LOCATION_INTERVAL_MS) {
    return false;
  }
  latestEmitAtByKey.set(key, now);
  return true;
}

io.on("connection", (socket) => {
  const query = socket.handshake.query || {};
  const rideId = String(query.rideId || "demo-ride-1");
  const role = query.role === "driver" ? "driver" : "passenger";
  const name = String(query.name || (role === "driver" ? "Campus Driver" : "Campus Passenger"));

  socket.join(rideId);

  const rideState = getRideState(rideId);
  if (role === "driver") {
    rideState.driverName = name;
  } else {
    rideState.passengerName = name;
  }

  socket.emit("rideState", {
    ...rideState,
    campusCenter: TMU_CENTER,
  });

  socket.to(rideId).emit("participantJoined", {
    role,
    name,
    rideId,
    joinedAt: Date.now(),
  });

  socket.on("driverLocationUpdate", (payload) => {
    if (role !== "driver") return;
    if (!canEmitLocation(rideId, "driver")) return;

    const location = toLocation(payload);
    if (!location) return;

    const state = getRideState(rideId);
    state.driverLocation = location;
    state.updatedAt = Date.now();

    io.to(rideId).emit("driverLocationUpdate", {
      rideId,
      driverName: state.driverName,
      location,
    });
  });

  socket.on("passengerLocationUpdate", (payload) => {
    if (role !== "passenger") return;
    if (!canEmitLocation(rideId, "passenger")) return;

    const location = toLocation(payload);
    if (!location) return;

    const state = getRideState(rideId);
    state.passengerLocation = location;
    state.updatedAt = Date.now();

    io.to(rideId).emit("passengerLocationUpdate", {
      rideId,
      passengerName: state.passengerName,
      location,
    });
  });

  socket.on("rideAccepted", () => {
    const state = getRideState(rideId);
    state.status = "accepted";
    state.updatedAt = Date.now();

    io.to(rideId).emit("rideAccepted", {
      rideId,
      status: state.status,
      at: state.updatedAt,
    });
  });

  socket.on("rideCompleted", () => {
    const state = getRideState(rideId);
    state.status = "completed";
    state.updatedAt = Date.now();

    io.to(rideId).emit("rideCompleted", {
      rideId,
      status: state.status,
      at: state.updatedAt,
    });
  });
});

server.listen(PORT, () => {
  console.log(`Realtime tracker running: http://localhost:${PORT}`);
});
