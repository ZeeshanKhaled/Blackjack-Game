import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

const PORT = process.env.PORT || 3000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";
const ROOM_CODE_LENGTH = 4;
const MAX_ROOM_CODE_ATTEMPTS = 50;

// In-memory room store for starter build.
// Good for local development. Not persistent across server restarts.
const rooms = new Map();
// socketId -> { roomCode, playerId }
const socketIndex = new Map();

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN === "*" ? true : CLIENT_ORIGIN }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    rooms: rooms.size,
    uptimeSeconds: Math.round(process.uptime())
  });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN === "*" ? true : CLIENT_ORIGIN,
    methods: ["GET", "POST"]
  }
});

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function createUniqueRoomCode() {
  for (let i = 0; i < MAX_ROOM_CODE_ATTEMPTS; i += 1) {
    const code = makeCode();
    if (!rooms.has(code)) return code;
  }
  throw new Error("Unable to create a unique room code.");
}

function sanitizePlayerName(name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return "Player";
  return trimmed.slice(0, 20);
}

function buildPublicRoom(room) {
  return {
    code: room.code,
    status: room.status, // lobby | in-game | finished
    maxPlayers: room.maxPlayers,
    hostPlayerId: room.hostPlayerId,
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      ready: player.ready,
      connected: player.connected,
      isHost: player.id === room.hostPlayerId
    })),
    createdAt: room.createdAt
  };
}

function getRoom(roomCode) {
  if (!roomCode) return null;
  return rooms.get(String(roomCode).toUpperCase()) || null;
}

function emitRoomState(roomCode) {
  const room = getRoom(roomCode);
  if (!room) return;
  io.to(roomCode).emit("room:state", buildPublicRoom(room));
}

function removeRoomIfEmpty(roomCode) {
  const room = getRoom(roomCode);
  if (!room) return;

  const hasConnectedPlayers = room.players.some((player) => player.connected);
  if (!hasConnectedPlayers) {
    rooms.delete(roomCode);
  }
}

function findPlayer(room, playerId) {
  return room.players.find((player) => player.id === playerId) || null;
}

function joinSocketToRoom(socket, roomCode, playerId) {
  socket.join(roomCode);
  socketIndex.set(socket.id, { roomCode, playerId });
}

function leaveTrackedRoom(socket) {
  const tracked = socketIndex.get(socket.id);
  if (!tracked) return null;

  const room = getRoom(tracked.roomCode);
  if (room) {
    const player = findPlayer(room, tracked.playerId);
    if (player) {
      player.connected = false;
      player.ready = false;
    }

    if (room.hostPlayerId === tracked.playerId) {
      const nextHost = room.players.find((p) => p.connected);
      room.hostPlayerId = nextHost ? nextHost.id : null;
    }

    emitRoomState(tracked.roomCode);
    removeRoomIfEmpty(tracked.roomCode);
  }

  socket.leave(tracked.roomCode);
  socketIndex.delete(socket.id);
  return tracked;
}

io.on("connection", (socket) => {
  socket.emit("server:hello", {
    message: "Connected to Private Table server."
  });

  socket.on("room:create", (payload = {}, ack) => {
    try {
      leaveTrackedRoom(socket);

      const hostName = sanitizePlayerName(payload.name || "Host");
      const maxPlayersRaw = Number(payload.maxPlayers || 2);
      const maxPlayers = [2, 3, 4].includes(maxPlayersRaw) ? maxPlayersRaw : 2;

      const roomCode = createUniqueRoomCode();
      const hostPlayerId = crypto.randomUUID();

      const room = {
        code: roomCode,
        status: "lobby",
        maxPlayers,
        hostPlayerId,
        createdAt: Date.now(),
        players: [
          {
            id: hostPlayerId,
            socketId: socket.id,
            name: hostName,
            ready: true,
            connected: true
          }
        ]
      };

      rooms.set(roomCode, room);
      joinSocketToRoom(socket, roomCode, hostPlayerId);

      emitRoomState(roomCode);

      ack?.({
        ok: true,
        room: buildPublicRoom(room),
        playerId: hostPlayerId
      });
    } catch (error) {
      ack?.({
        ok: false,
        error: error instanceof Error ? error.message : "Unable to create room."
      });
    }
  });

  socket.on("room:join", (payload = {}, ack) => {
    try {
      leaveTrackedRoom(socket);

      const roomCode = String(payload.code || "").trim().toUpperCase();
      const playerName = sanitizePlayerName(payload.name || "Player");
      const room = getRoom(roomCode);

      if (!room) {
        ack?.({ ok: false, error: "Room not found." });
        return;
      }

      if (room.status !== "lobby") {
        ack?.({ ok: false, error: "Game already started." });
        return;
      }

      if (room.players.length >= room.maxPlayers) {
        ack?.({ ok: false, error: "Room is full." });
        return;
      }

      const playerId = crypto.randomUUID();
      const player = {
        id: playerId,
        socketId: socket.id,
        name: playerName,
        ready: true,
        connected: true
      };

      room.players.push(player);
      joinSocketToRoom(socket, roomCode, playerId);

      emitRoomState(roomCode);

      ack?.({
        ok: true,
        room: buildPublicRoom(room),
        playerId
      });
    } catch (error) {
      ack?.({
        ok: false,
        error: error instanceof Error ? error.message : "Unable to join room."
      });
    }
  });

  socket.on("room:set-ready", (payload = {}, ack) => {
    const tracked = socketIndex.get(socket.id);
    if (!tracked) {
      ack?.({ ok: false, error: "You are not in a room." });
      return;
    }

    const room = getRoom(tracked.roomCode);
    if (!room) {
      ack?.({ ok: false, error: "Room not found." });
      return;
    }

    const player = findPlayer(room, tracked.playerId);
    if (!player) {
      ack?.({ ok: false, error: "Player not found." });
      return;
    }

    player.ready = Boolean(payload.ready);
    emitRoomState(room.code);

    ack?.({ ok: true });
  });

  socket.on("room:start", (_payload = {}, ack) => {
    const tracked = socketIndex.get(socket.id);
    if (!tracked) {
      ack?.({ ok: false, error: "You are not in a room." });
      return;
    }

    const room = getRoom(tracked.roomCode);
    if (!room) {
      ack?.({ ok: false, error: "Room not found." });
      return;
    }

    if (room.hostPlayerId !== tracked.playerId) {
      ack?.({ ok: false, error: "Only the host can start the room." });
      return;
    }

    const allSeatsFilled = room.players.length === room.maxPlayers;
    const everyoneReady = room.players.every((player) => player.connected && player.ready);

    if (!allSeatsFilled) {
      ack?.({ ok: false, error: "Room is not full yet." });
      return;
    }

    if (!everyoneReady) {
      ack?.({ ok: false, error: "Everyone must be ready first." });
      return;
    }

    room.status = "in-game";
    emitRoomState(room.code);

    io.to(room.code).emit("room:started", {
      room: buildPublicRoom(room)
    });

    ack?.({ ok: true });
  });

  socket.on("room:leave", (_payload = {}, ack) => {
    leaveTrackedRoom(socket);
    ack?.({ ok: true });
  });

  socket.on("disconnect", () => {
    leaveTrackedRoom(socket);
  });
});

server.listen(PORT, () => {
  console.log(`Private Table server listening on http://localhost:${PORT}`);
});
