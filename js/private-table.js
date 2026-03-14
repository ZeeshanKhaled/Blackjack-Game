const hostNameInput = document.getElementById("hostName");
const joinNameInput = document.getElementById("joinName");
const roomCodeInput = document.getElementById("roomCodeInput");
const hostRoomBtn = document.getElementById("hostRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const leaveLobbyBtn = document.getElementById("leaveLobbyBtn");
const startPrivateMatchBtn = document.getElementById("startPrivateMatchBtn");
const copyCodeBtn = document.getElementById("copyCodeBtn");
const playerCountOptions = document.getElementById("playerCountOptions");

const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const roomPlayerCount = document.getElementById("roomPlayerCount");
const hostNameDisplay = document.getElementById("hostNameDisplay");
const playerCountPill = document.getElementById("playerCountPill");
const lobbyStatePill = document.getElementById("lobbyStatePill");
const layoutPreviewTitle = document.getElementById("layoutPreviewTitle");
const layoutPreviewText = document.getElementById("layoutPreviewText");
const privateFootnote = document.getElementById("privateFootnote");

const seat1Name = document.getElementById("seat1Name");
const seat1Status = document.getElementById("seat1Status");
const seat2Name = document.getElementById("seat2Name");
const seat2Status = document.getElementById("seat2Status");
const seat3Wrap = document.getElementById("seat3Wrap");
const seat3Name = document.getElementById("seat3Name");
const seat3Status = document.getElementById("seat3Status");
const seat4Wrap = document.getElementById("seat4Wrap");
const seat4Name = document.getElementById("seat4Name");
const seat4Status = document.getElementById("seat4Status");

const SOCKET_SERVER_URL = "http://localhost:3000";
const SOCKET_CDN_URL = "https://cdn.socket.io/4.8.1/socket.io.min.js";

const state = {
  mode: "idle",
  maxPlayers: 2,
  roomCode: "",
  hostName: "",
  players: [],
  socket: null,
  playerId: null,
  roomStatus: "idle",
  connected: false,
  loading: false
};

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function getLayoutCopy(count) {
  if (count === 2) {
    return {
      title: "Heads Up Layout",
      text: "Two-seat layout ready for a private match. Best for the first online version."
    };
  }

  if (count === 3) {
    return {
      title: "Three Player Layout",
      text: "Three-seat table preview. Good for later once room syncing and turn flow are locked in."
    };
  }

  return {
    title: "Four Player Layout",
    text: "Four-seat table preview. More pressure, more state to sync, and more room logic to wire later."
  };
}

function setFootnote(text) {
  privateFootnote.textContent = text;
}

function setLobbyState(text) {
  state.roomStatus = text;
  lobbyStatePill.textContent = text;
}

function applyCountSelection(count) {
  state.maxPlayers = count;
  playerCountPill.textContent = `${count} Player${count === 1 ? "" : "s"}`;

  [...playerCountOptions.querySelectorAll(".count-option")].forEach((button) => {
    button.classList.toggle("is-selected", Number(button.dataset.count) === count);
  });

  const layout = getLayoutCopy(count);
  layoutPreviewTitle.textContent = layout.title;
  layoutPreviewText.textContent = layout.text;
  roomPlayerCount.textContent = `${count} Player${count === 1 ? "" : "s"}`;

  seat3Wrap.classList.toggle("is-hidden", count < 3);
  seat4Wrap.classList.toggle("is-hidden", count < 4);
  renderLobby();
}

function normalizeRoomState(room) {
  if (!room) return;

  state.roomCode = room.code || "";
  state.maxPlayers = room.maxPlayers || 2;
  state.mode = room.hostPlayerId === state.playerId ? "host" : "join";
  state.hostName = room.players.find((player) => player.isHost)?.name || "";
  state.players = room.players.map((player) => ({
    id: player.id,
    name: player.name,
    isHost: Boolean(player.isHost),
    connected: Boolean(player.connected),
    ready: Boolean(player.ready)
  }));

  applyCountSelection(state.maxPlayers);

  if (room.status === "lobby") {
    setLobbyState(state.mode === "host" ? "Hosting" : "Joined");
  } else if (room.status === "in-game") {
    setLobbyState("In Game");
  } else if (room.status === "finished") {
    setLobbyState("Finished");
  } else {
    setLobbyState("Idle");
  }

  renderLobby();
}

function renderLobby() {
  const seats = [
    { nameEl: seat1Name, statusEl: seat1Status, wrap: seat1Name.closest(".lobby-slot") },
    { nameEl: seat2Name, statusEl: seat2Status, wrap: seat2Name.closest(".lobby-slot") },
    { nameEl: seat3Name, statusEl: seat3Status, wrap: seat3Wrap },
    { nameEl: seat4Name, statusEl: seat4Status, wrap: seat4Wrap }
  ];

  seats.forEach((seat, index) => {
    const isVisible = index < state.maxPlayers;
    if (!isVisible) return;

    const player = state.players[index];
    if (player) {
      seat.nameEl.textContent = player.name;

      if (!player.connected) {
        seat.statusEl.textContent = player.isHost ? "Host Disconnected" : "Player Disconnected";
      } else if (player.isHost) {
        seat.statusEl.textContent = "Host Connected";
      } else {
        seat.statusEl.textContent = "Player Connected";
      }

      seat.wrap.classList.add("is-filled");
    } else {
      seat.nameEl.textContent = "Waiting...";
      seat.statusEl.textContent = "Open Slot";
      seat.wrap.classList.remove("is-filled");
    }
  });

  hostNameDisplay.textContent = state.hostName || "—";
  roomCodeDisplay.textContent = state.roomCode || "— — — — — —";
  roomPlayerCount.textContent = `${state.maxPlayers} Player${state.maxPlayers === 1 ? "" : "s"}`;

  const canStart =
    state.mode === "host" &&
    state.players.length === state.maxPlayers &&
    state.players.every((player) => player.connected);

  startPrivateMatchBtn.disabled = !canStart;
}

function setLoading(isLoading) {
  state.loading = isLoading;
  hostRoomBtn.disabled = isLoading;
  joinRoomBtn.disabled = isLoading;
}

function resetLocalState() {
  state.mode = "idle";
  state.roomCode = "";
  state.hostName = "";
  state.players = [];
  state.playerId = null;
  applyCountSelection(2);
  setLobbyState("Idle");
  setFootnote("Private Table is ready. Create or join a room once your local server is running.");
  renderLobby();
}

function loadSocketLibrary() {
  if (window.io) {
    return Promise.resolve(window.io);
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-socket-io-loader="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.io));
      existing.addEventListener("error", () => reject(new Error("Could not load Socket.IO client.")));
      return;
    }

    const script = document.createElement("script");
    script.src = SOCKET_CDN_URL;
    script.async = true;
    script.dataset.socketIoLoader = "true";
    script.addEventListener("load", () => {
      if (window.io) resolve(window.io);
      else reject(new Error("Socket.IO client loaded but io was not found."));
    });
    script.addEventListener("error", () => reject(new Error("Could not load Socket.IO client.")));
    document.head.appendChild(script);
  });
}

async function ensureSocket() {
  if (state.socket && state.connected) {
    return state.socket;
  }

  const ioFactory = await loadSocketLibrary();

  if (state.socket) {
    return state.socket;
  }

  const socket = ioFactory(SOCKET_SERVER_URL, {
    transports: ["websocket", "polling"]
  });

  socket.on("connect", () => {
    state.connected = true;
    setFootnote("Connected to Private Table server.");
  });

  socket.on("disconnect", () => {
    state.connected = false;
    setFootnote("Disconnected from Private Table server.");
  });

  socket.on("server:hello", (payload) => {
    if (payload?.message) {
      setFootnote(payload.message);
    }
  });

  socket.on("room:state", (room) => {
    normalizeRoomState(room);
  });

  socket.on("room:started", ({ room }) => {
    normalizeRoomState(room);
    setFootnote("Room started. Next step is routing both players into the real match.");
  });

  state.socket = socket;
  return socket;
}

async function hostRoom() {
  const hostName = hostNameInput.value.trim() || "Host";
  setLoading(true);

  try {
    const socket = await ensureSocket();

    socket.emit(
      "room:create",
      {
        name: hostName,
        maxPlayers: state.maxPlayers
      },
      (response) => {
        setLoading(false);

        if (!response?.ok) {
          setFootnote(response?.error || "Could not create room.");
          return;
        }

        state.playerId = response.playerId;
        normalizeRoomState(response.room);
        setFootnote("Private Table room created.");
      }
    );
  } catch (error) {
    setLoading(false);
    setFootnote(error?.message || "Could not reach the Private Table server.");
  }
}

async function joinRoom() {
  const joinName = joinNameInput.value.trim() || "Player";
  const code = roomCodeInput.value.trim().toUpperCase();

  if (!code) {
    setFootnote("Enter a room code before joining.");
    return;
  }

  setLoading(true);

  try {
    const socket = await ensureSocket();

    socket.emit(
      "room:join",
      {
        name: joinName,
        code
      },
      (response) => {
        setLoading(false);

        if (!response?.ok) {
          setFootnote(response?.error || "Could not join room.");
          return;
        }

        state.playerId = response.playerId;
        normalizeRoomState(response.room);
        setFootnote("Joined Private Table room.");
      }
    );
  } catch (error) {
    setLoading(false);
    setFootnote(error?.message || "Could not reach the Private Table server.");
  }
}

function leaveLobby() {
  if (state.socket) {
    state.socket.emit("room:leave", {}, () => {
      resetLocalState();
    });
    return;
  }

  resetLocalState();
}

function startRoom() {
  if (!state.socket) {
    setFootnote("Start needs a live room connection first.");
    return;
  }

  state.socket.emit("room:start", {}, (response) => {
    if (!response?.ok) {
      setFootnote(response?.error || "Could not start room.");
      return;
    }

    setFootnote("Room started.");
  });
}

playerCountOptions.addEventListener("click", (event) => {
  const button = event.target.closest(".count-option");
  if (!button) return;
  applyCountSelection(Number(button.dataset.count));
});

hostRoomBtn.addEventListener("click", hostRoom);
joinRoomBtn.addEventListener("click", joinRoom);
leaveLobbyBtn.addEventListener("click", leaveLobby);

copyCodeBtn.addEventListener("click", async () => {
  if (!state.roomCode) return;

  try {
    await navigator.clipboard.writeText(state.roomCode);
    copyCodeBtn.textContent = "Copied";
    setTimeout(() => {
      copyCodeBtn.textContent = "Copy";
    }, 1200);
  } catch {
    copyCodeBtn.textContent = "Failed";
    setTimeout(() => {
      copyCodeBtn.textContent = "Copy";
    }, 1200);
  }
});

startPrivateMatchBtn.addEventListener("click", startRoom);

roomCodeInput.addEventListener("input", () => {
  roomCodeInput.value = roomCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
});

applyCountSelection(2);
resetLocalState();
