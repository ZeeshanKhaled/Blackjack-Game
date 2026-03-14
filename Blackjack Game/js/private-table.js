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

const state = {
  mode: "idle",
  maxPlayers: 2,
  roomCode: "",
  hostName: "",
  players: []
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

function setLobbyState(text) {
  lobbyStatePill.textContent = text;
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
      seat.statusEl.textContent = player.isHost ? "Host Connected" : "Player Connected";
      seat.wrap.classList.add("is-filled");
    } else {
      seat.nameEl.textContent = "Waiting...";
      seat.statusEl.textContent = "Open Slot";
      seat.wrap.classList.remove("is-filled");
    }
  });

  hostNameDisplay.textContent = state.hostName || "—";
  roomCodeDisplay.textContent = state.roomCode || "— — — — — —";
  startPrivateMatchBtn.disabled = state.players.length < 2;
}

function hostRoom() {
  const hostName = hostNameInput.value.trim() || "Host";
  state.mode = "host";
  state.roomCode = randomCode();
  state.hostName = hostName;
  state.players = [{ name: hostName, isHost: true }];

  setLobbyState("Hosting");
  privateFootnote.textContent = "Lobby created locally. Hook this into real room syncing next.";
  renderLobby();
}

function joinRoom() {
  const joinName = joinNameInput.value.trim() || "Player 2";
  const code = roomCodeInput.value.trim().toUpperCase() || randomCode();

  state.mode = "join";
  state.roomCode = code;
  state.hostName = state.hostName || "Host";
  state.players = [
    { name: state.hostName, isHost: true },
    { name: joinName, isHost: false }
  ];

  setLobbyState("Joined");
  privateFootnote.textContent = "Joined locally for UI preview. Real validation still needs backend wiring.";
  renderLobby();
}

function leaveLobby() {
  state.mode = "idle";
  state.roomCode = "";
  state.hostName = "";
  state.players = [];
  setLobbyState("Idle");
  privateFootnote.textContent = "This page is the front-end lobby screen. Backend room syncing still needs wiring.";
  renderLobby();
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

startPrivateMatchBtn.addEventListener("click", () => {
  privateFootnote.textContent = "Start button is ready for the real room/game handoff once backend syncing is added.";
});

roomCodeInput.addEventListener("input", () => {
  roomCodeInput.value = roomCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
});

applyCountSelection(2);
renderLobby();
