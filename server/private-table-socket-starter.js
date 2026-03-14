// Starter Socket.IO bridge for your Private Table page.
// This assumes your HTML already has buttons / inputs for host, join and start.
// Tweak the selectors at the top to match your actual page.

import { io } from "https://cdn.socket.io/4.8.1/socket.io.esm.min.js";

const SERVER_URL = "http://localhost:3000";

const els = {
  hostName: document.querySelector("#hostName"),
  hostPlayerCount: document.querySelector("#hostPlayerCount"),
  hostButton: document.querySelector("#hostRoomBtn"),

  joinName: document.querySelector("#joinName"),
  joinCode: document.querySelector("#joinCode"),
  joinButton: document.querySelector("#joinRoomBtn"),

  roomCode: document.querySelector("#roomCodeValue"),
  playerList: document.querySelector("#lobbyPlayers"),
  startButton: document.querySelector("#startRoomBtn"),
  lobbyStatus: document.querySelector("#lobbyStatus")
};

let socket = null;
let currentPlayerId = null;
let currentRoom = null;

function setStatus(text) {
  if (els.lobbyStatus) els.lobbyStatus.textContent = text;
}

function renderRoom(room) {
  currentRoom = room;

  if (els.roomCode) {
    els.roomCode.textContent = room?.code || "----";
  }

  if (els.playerList) {
    els.playerList.innerHTML = "";

    for (const player of room.players) {
      const li = document.createElement("li");
      li.textContent = `${player.name}${player.isHost ? " (Host)" : ""}${player.connected ? "" : " (Disconnected)"}`;
      els.playerList.appendChild(li);
    }
  }

  const amHost = room.hostPlayerId === currentPlayerId;
  const roomIsFull = room.players.length === room.maxPlayers;
  const everyoneReady = room.players.every((player) => player.connected && player.ready);

  if (els.startButton) {
    els.startButton.disabled = !(amHost && roomIsFull && everyoneReady && room.status === "lobby");
  }

  setStatus(`Room ${room.code} • ${room.players.length}/${room.maxPlayers} players`);
}

function connectSocket() {
  if (socket) return socket;

  socket = io(SERVER_URL);

  socket.on("connect", () => {
    setStatus("Connected to server.");
  });

  socket.on("room:state", (room) => {
    renderRoom(room);
  });

  socket.on("room:started", ({ room }) => {
    renderRoom(room);
    setStatus("Game starting...");
    // Later: redirect into the real table / synced match state.
  });

  socket.on("disconnect", () => {
    setStatus("Disconnected from server.");
  });

  return socket;
}

function hostRoom() {
  const s = connectSocket();

  s.emit(
    "room:create",
    {
      name: els.hostName?.value || "Host",
      maxPlayers: Number(els.hostPlayerCount?.value || 2)
    },
    (response) => {
      if (!response?.ok) {
        setStatus(response?.error || "Could not create room.");
        return;
      }

      currentPlayerId = response.playerId;
      renderRoom(response.room);
      setStatus("Room created.");
    }
  );
}

function joinRoom() {
  const s = connectSocket();

  s.emit(
    "room:join",
    {
      name: els.joinName?.value || "Player",
      code: els.joinCode?.value || ""
    },
    (response) => {
      if (!response?.ok) {
        setStatus(response?.error || "Could not join room.");
        return;
      }

      currentPlayerId = response.playerId;
      renderRoom(response.room);
      setStatus("Joined room.");
    }
  );
}

function startRoom() {
  if (!socket) return;

  socket.emit("room:start", {}, (response) => {
    if (!response?.ok) {
      setStatus(response?.error || "Could not start room.");
      return;
    }

    setStatus("Room started.");
  });
}

els.hostButton?.addEventListener("click", hostRoom);
els.joinButton?.addEventListener("click", joinRoom);
els.startButton?.addEventListener("click", startRoom);
