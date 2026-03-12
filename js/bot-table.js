const playerHand = document.getElementById("playerHand");
const readyHand = document.getElementById("readyHand");
const botHand = document.getElementById("botHand");
const discardPile = document.getElementById("discardPile");

const messageText = document.getElementById("messageText");
const turnText = document.getElementById("turnText");
const timerText = document.getElementById("timerText");
const readyCount = document.getElementById("readyCount");
const knockStatus = document.getElementById("knockStatus");
const drawPileCount = document.getElementById("drawPileCount");
const botCardCount = document.getElementById("botCardCount");
const startOverlay = document.getElementById("startOverlay");
const playerTurnBadge = document.getElementById("playerTurnBadge");
const lastPlayedBy = document.getElementById("lastPlayedBy");
const lastPlayedHand = document.getElementById("lastPlayedHand");

const declaredSuitIndicator = document.getElementById("declaredSuitIndicator");
const declaredSuitIcon = document.getElementById("declaredSuitIcon");

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const playBtn = document.getElementById("playBtn");
const drawBtn = document.getElementById("drawBtn");
const knockBtn = document.getElementById("knockBtn");

const pauseOverlay = document.getElementById("pauseOverlay");
const resumeBtn = document.getElementById("resumeBtn");
const resumeBtnSecondary = document.getElementById("resumeBtnSecondary");

const choiceOverlay = document.getElementById("choiceOverlay");
const choiceTitle = document.getElementById("choiceTitle");
const choiceConfirmBtn = document.getElementById("choiceConfirmBtn");
const suitChoiceButtons = [...document.querySelectorAll(".suit-choice-btn")];
const rankChoiceButtons = [...document.querySelectorAll(".rank-choice-btn")];
const rankChoicePanel = document.getElementById("rankChoicePanel");

const SUITS = ["♠", "♥", "♦", "♣"];
const TURN_TIME = 15;

let game = null;
let draggedCardId = null;
let timerInterval = null;
let botTimeout = null;
let pendingChoice = null;

function createDeck() {
  const deck = [];
  let id = 0;
  const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

  for (const suit of SUITS) {
    for (const rank of ranks) {
      deck.push({
        id: `c-${id++}`,
        rank,
        suit,
        type: "normal"
      });
    }
  }

  deck.push({ id: `j-${id++}`, rank: "JOKER", suit: "", type: "joker" });
  deck.push({ id: `j-${id++}`, rank: "JOKER", suit: "", type: "joker" });

  return deck;
}

function shuffle(deck) {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function recycleDiscardIntoDrawPile() {
  if (game.drawPile.length > 0) return;
  if (game.discardPile.length <= 1) return;

  const topCard = game.discardPile[game.discardPile.length - 1];
  const recyclable = game.discardPile.slice(0, -1);

  game.drawPile = shuffle(recyclable);
  game.discardPile = [topCard];
}

function drawCardFromPile() {
  if (game.drawPile.length === 0) {
    recycleDiscardIntoDrawPile();
  }

  if (game.drawPile.length === 0) return null;
  return game.drawPile.shift();
}

function drawMany(count) {
  const cards = [];
  for (let i = 0; i < count; i++) {
    const card = drawCardFromPile();
    if (!card) break;
    cards.push(card);
  }
  return cards;
}

function buildInitialGame() {
  const shuffledDeck = shuffle(createDeck());

  game = {
    drawPile: shuffledDeck,
    discardPile: [],
    player: {
      hand: [],
      readyHand: [],
      knockArmed: false
    },
    bot: {
      hand: []
    },
    turn: "player",
    timer: TURN_TIME,
    declaredSuit: null,
    direction: 1,
    pendingDrawTotal: 0,
    pendingSkip: false,
    forcedSkipResponse: false,
    started: false,
    paused: false,
    lastPlayed: { by: null, cards: [] }
  };

  for (let i = 0; i < 7; i++) {
    game.player.hand.push(drawCardFromPile());
    game.bot.hand.push(drawCardFromPile());
  }

  let startingCard = drawCardFromPile();
  while (startingCard && startingCard.type === "joker") {
    game.drawPile.push(startingCard);
    game.drawPile = shuffle(game.drawPile);
    startingCard = drawCardFromPile();
  }

  if (startingCard) {
    game.discardPile.push(startingCard);
  }
}

function setMessage(text) {
  messageText.textContent = text;
}

function getTopCard() {
  return game.discardPile[game.discardPile.length - 1] || null;
}

function getEffectiveRank(card) {
  if (!card) return null;
  if (card.type === "joker" && card.declaredAs) return card.declaredAs.rank;
  return card.rank;
}

function getEffectiveSuit(card) {
  if (!card) return null;
  if (card.type === "joker" && card.declaredAs) return card.declaredAs.suit;
  return card.suit;
}

function getActiveSuit() {
  return game.declaredSuit || getEffectiveSuit(getTopCard()) || null;
}

function getActiveRank() {
  return getEffectiveRank(getTopCard()) || null;
}

function cardLabel(card) {
  if (!card) return "";
  if (card.type === "joker" && card.declaredAs) {
    return `Joker as ${card.declaredAs.rank}${card.declaredAs.suit}`;
  }
  return card.type === "joker" ? "Joker" : `${card.rank}${card.suit}`;
}

function isRedSuit(suit) {
  return suit === "♥" || suit === "♦";
}

function isBlackjack(card) {
  const rank = getEffectiveRank(card);
  const suit = getEffectiveSuit(card);
  return rank === "J" && (suit === "♠" || suit === "♣");
}

function isRedjack(card) {
  const rank = getEffectiveRank(card);
  const suit = getEffectiveSuit(card);
  return rank === "J" && (suit === "♥" || suit === "♦");
}

function isEight(card) {
  return getEffectiveRank(card) === "8";
}

function chooseBestSuitForBot() {
  const counts = { "♠": 0, "♥": 0, "♦": 0, "♣": 0 };
  game.bot.hand.forEach((card) => {
    const suit = getEffectiveSuit(card);
    if (suit && counts[suit] !== undefined) counts[suit] += 1;
  });

  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function chooseBotJokerDeclaration(comboState = {}) {
  const bestSuit = chooseBestSuitForBot();

  if (game.pendingDrawTotal > 0) {
    if (comboState.preferRedjackCancel) return { rank: "J", suit: "♥" };
    if (comboState.preferBlackjackStack) return { rank: "J", suit: "♠" };
    return { rank: "2", suit: bestSuit };
  }

  if (game.pendingSkip) {
    return { rank: "8", suit: bestSuit };
  }

  if (comboState.allowBlackjackAfterTwo) {
    return { rank: "J", suit: "♠" };
  }

  if (comboState.allowTwoAfterRedjackCancel) {
    return { rank: "2", suit: bestSuit };
  }

  return { rank: "8", suit: bestSuit };
}

function createCardHTML(card, options = {}) {
  const { draggable = false, selectable = false } = options;

  const effectiveRank = getEffectiveRank(card);
  const effectiveSuit = getEffectiveSuit(card);
  const red = isRedSuit(effectiveSuit);

  const classes = ["playing-card"];
  if (selectable) classes.push("card-button");
  if (red) classes.push("red-card");
  if (card.type === "joker") classes.push("joker-card");
  if (card.type === "joker" && card.declaredAs) classes.push("joker-declared");

  const buttonTag = selectable ? "button" : "div";
  const draggableAttr = draggable ? 'draggable="true"' : "";
  const typeAttr = selectable ? 'type="button"' : "";

  if (card.type === "joker" && !card.declaredAs) {
    return `
      <${buttonTag}
        class="${classes.join(" ")}"
        ${typeAttr}
        ${draggableAttr}
        data-id="${card.id}"
        data-rank="${card.rank}"
        data-suit="${card.suit}"
        data-type="${card.type}"
      >
        <div class="playing-card__corner playing-card__corner--top">
          <span>JK</span>
          <span>🃏</span>
        </div>
        <div class="playing-card__center joker-center">
          <img src="./assets/images/cards/joker.png" alt="Joker card symbol" class="joker-image" />
        </div>
        <div class="playing-card__corner playing-card__corner--bottom">
          <span>JK</span>
          <span>🃏</span>
        </div>
      </${buttonTag}>
    `;
  }

  return `
    <${buttonTag}
      class="${classes.join(" ")}"
      ${typeAttr}
      ${draggableAttr}
      data-id="${card.id}"
      data-rank="${card.rank}"
      data-suit="${card.suit}"
      data-type="${card.type}"
    >
      ${card.type === "joker" && card.declaredAs ? '<span class="joker-edge-badge joker-edge-badge--top">JK</span>' : ""}
      <div class="playing-card__corner playing-card__corner--top">
        <span>${effectiveRank}</span>
        <span>${effectiveSuit}</span>
      </div>
      <div class="playing-card__center">${effectiveSuit}</div>
      <div class="playing-card__corner playing-card__corner--bottom">
        <span>${effectiveRank}</span>
        <span>${effectiveSuit}</span>
      </div>
      ${card.type === "joker" && card.declaredAs ? '<span class="joker-edge-badge joker-edge-badge--bottom">JK</span>' : ""}
    </${buttonTag}>
  `;
}

function renderBotHand() {
  botHand.innerHTML = "";
  game.bot.hand.forEach(() => {
    const card = document.createElement("div");
    card.className = "mini-playing-card mini-playing-card--back";
    botHand.appendChild(card);
  });
  botCardCount.textContent = `${game.bot.hand.length} Card${game.bot.hand.length === 1 ? "" : "s"}`;
}

function renderDiscardPile() {
  const topCard = getTopCard();
  discardPile.innerHTML = topCard ? createCardHTML(topCard) : "";
}

function renderPlayerHand() {
  playerHand.innerHTML = game.player.hand
    .map((card) =>
      createCardHTML(card, {
        draggable: canInteract(),
        selectable: canInteract()
      })
    )
    .join("");
}

function renderReadyHand() {
  const cards = game.player.readyHand;

  if (cards.length === 0) {
    readyHand.innerHTML = `<div class="ready-empty">No cards prepared yet.</div>`;
  } else {
    readyHand.innerHTML = cards
      .map((card) =>
        createCardHTML(card, {
          draggable: canInteract(),
          selectable: canInteract()
        })
      )
      .join("");
  }

  readyCount.textContent = `${cards.length} Card${cards.length === 1 ? "" : "s"}`;
}

function renderLastPlayed() {
  if (!lastPlayedBy || !lastPlayedHand) return;

  const info = game.lastPlayed || { by: null, cards: [] };
  lastPlayedBy.textContent = info.by === "player" ? "You" : info.by === "bot" ? "Bot" : "—";
  lastPlayedHand.innerHTML = "";

  if (!info.cards || info.cards.length === 0) {
    lastPlayedHand.innerHTML = '<div class="last-played-empty">No move yet.</div>';
    return;
  }

  info.cards.forEach((card) => {
    lastPlayedHand.appendChild(createPlayingCard(card, { mini: false }));
  });
}

function renderMeta() {
  drawPileCount.textContent = `${game.drawPile.length} Cards`;
  turnText.textContent = game.turn === "player" ? "You" : "Bot";
  timerText.textContent = `${game.timer}s`;
  knockStatus.textContent = game.player.knockArmed ? "Armed" : "Not Armed";

  if (playerTurnBadge) {
    playerTurnBadge.textContent = game.turn === "player" ? "Your Turn" : "Bot Turn";
    playerTurnBadge.classList.toggle("player-badge--green", game.turn === "player");
  }

  if (startOverlay) {
    startOverlay.classList.toggle("is-hidden", game.started);
    startOverlay.setAttribute("aria-hidden", game.started ? "true" : "false");
  }

  if (game.declaredSuit) {
    declaredSuitIndicator.classList.remove("is-hidden");
    declaredSuitIcon.textContent = game.declaredSuit;
    declaredSuitIcon.classList.remove("spades", "hearts", "diamonds", "clubs");

    if (game.declaredSuit === "♠") declaredSuitIcon.classList.add("spades");
    if (game.declaredSuit === "♥") declaredSuitIcon.classList.add("hearts");
    if (game.declaredSuit === "♦") declaredSuitIcon.classList.add("diamonds");
    if (game.declaredSuit === "♣") declaredSuitIcon.classList.add("clubs");
  } else {
    declaredSuitIndicator.classList.add("is-hidden");
  }
}

function canInteract() {
  return game.started && !game.paused && game.turn === "player" && !pendingChoice;
}

function renderAll() {
  renderBotHand();
  renderDiscardPile();
  renderPlayerHand();
  renderReadyHand();
  renderLastPlayed();
  renderMeta();
  bindRenderedCards();
  updateControlState();
}

function updateControlState() {
  const canPlay = canInteract();

  if (startBtn) startBtn.style.display = game.started ? "none" : "inline-flex";

  playBtn.disabled = !canPlay;
  drawBtn.disabled = !(game.started && !game.paused && game.turn === "player" && !pendingChoice);
  knockBtn.disabled = !canPlay;

  pauseBtn.disabled = !game.started;
  pauseBtn.textContent = game.paused ? "Resume" : "Pause";
}

function getContainerArray(containerId) {
  return containerId === "playerHand" ? game.player.hand : game.player.readyHand;
}

function findPlayerCard(cardId) {
  const inHand = game.player.hand.find((card) => card.id === cardId);
  if (inHand) return { zone: "hand", card: inHand };

  const inReady = game.player.readyHand.find((card) => card.id === cardId);
  if (inReady) return { zone: "ready", card: inReady };

  return null;
}

function getPlayerAccessibleCards() {
  return [...game.player.hand, ...game.player.readyHand];
}

function playerHasForcedEightResponse() {
  return getPlayerAccessibleCards().some(canCounterSkipWith);
}

function canCounterDrawWith(card) {
  if (!card || game.pendingDrawTotal <= 0) return false;
  if (isRedjack(card)) return true;
  if (getEffectiveRank(card) === "2") return true;
  if (isBlackjack(card)) return true;
  if (card.type === "joker") return true;
  return false;
}

function canCounterSkipWith(card) {
  if (!card) return false;
  if (isEight(card)) return true;
  if (card.type === "joker") return true;
  return false;
}

function moveCardBetweenZones(cardId) {
  if (!canInteract()) return;

  const found = findPlayerCard(cardId);
  if (!found) return;

  if (found.zone === "hand") {
    game.player.hand = game.player.hand.filter((card) => card.id !== cardId);
    game.player.readyHand.push(found.card);
    setMessage(`${cardLabel(found.card)} moved to your ready hand.`);
  } else {
    game.player.readyHand = game.player.readyHand.filter((card) => card.id !== cardId);
    game.player.hand.push(found.card);
    setMessage(`${cardLabel(found.card)} returned to your hand.`);
  }

  renderAll();
}

function reorderWithinContainer(containerId, draggedId, targetId) {
  const arr = getContainerArray(containerId);
  const fromIndex = arr.findIndex((card) => card.id === draggedId);
  const toIndex = arr.findIndex((card) => card.id === targetId);

  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

  const [moved] = arr.splice(fromIndex, 1);
  arr.splice(toIndex, 0, moved);
}

function moveAcrossContainers(fromId, toId, draggedId, beforeTargetId = null) {
  const fromArr = getContainerArray(fromId);
  const toArr = getContainerArray(toId);

  const fromIndex = fromArr.findIndex((card) => card.id === draggedId);
  if (fromIndex === -1) return;

  const [moved] = fromArr.splice(fromIndex, 1);

  if (!beforeTargetId) {
    toArr.push(moved);
    return;
  }

  const targetIndex = toArr.findIndex((card) => card.id === beforeTargetId);
  if (targetIndex === -1) {
    toArr.push(moved);
  } else {
    toArr.splice(targetIndex, 0, moved);
  }
}

function getDragAfterElement(container, x) {
  const cards = [...container.querySelectorAll(".card-button:not(.is-dragging)")];

  return cards.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = x - box.left - box.width / 2;

      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }
      return closest;
    },
    { offset: Number.NEGATIVE_INFINITY, element: null }
  ).element;
}

function bindRenderedCards() {
  document.querySelectorAll(".card-button").forEach((cardEl) => {
    const cardId = cardEl.dataset.id;

    cardEl.addEventListener("click", () => {
      moveCardBetweenZones(cardId);
    });

    cardEl.addEventListener("dragstart", () => {
      if (!canInteract()) return;
      draggedCardId = cardId;
      cardEl.classList.add("is-dragging");
    });

    cardEl.addEventListener("dragend", () => {
      draggedCardId = null;
      cardEl.classList.remove("is-dragging");
      playerHand.classList.remove("drop-zone-active");
      readyHand.classList.remove("drop-zone-active");
      renderAll();
    });
  });
}

function setupDropZone(container, containerId) {
  container.addEventListener("dragover", (event) => {
    if (!canInteract()) return;
    event.preventDefault();
    container.classList.add("drop-zone-active");

    if (!draggedCardId) return;

    const found = findPlayerCard(draggedCardId);
    if (!found) return;

    const afterElement = getDragAfterElement(container, event.clientX);
    const targetId = afterElement ? afterElement.dataset.id : null;

    if (found.zone === (containerId === "playerHand" ? "hand" : "ready")) {
      if (targetId) {
        reorderWithinContainer(containerId, draggedCardId, targetId);
      } else {
        const arr = getContainerArray(containerId);
        const fromIndex = arr.findIndex((card) => card.id === draggedCardId);
        if (fromIndex !== -1) {
          const [moved] = arr.splice(fromIndex, 1);
          arr.push(moved);
        }
      }
    } else {
      moveAcrossContainers(
        found.zone === "hand" ? "playerHand" : "readyHand",
        containerId,
        draggedCardId,
        targetId
      );
    }

    renderAll();
  });

  container.addEventListener("dragleave", () => {
    container.classList.remove("drop-zone-active");
  });

  container.addEventListener("drop", () => {
    container.classList.remove("drop-zone-active");
  });
}

function resetChoiceState() {
  rankChoiceButtons.forEach((btn) => btn.classList.remove("is-active"));
  suitChoiceButtons.forEach((btn) => btn.classList.remove("is-active"));
  choiceConfirmBtn.disabled = true;
}

function showSuitChoiceOverlay(title, onChoose) {
  pendingChoice = {
    mode: "suit",
    selectedRank: null,
    selectedSuit: null,
    onChoose
  };

  choiceTitle.textContent = title;
  rankChoicePanel.style.display = "none";
  resetChoiceState();
  choiceOverlay.classList.remove("is-hidden");
  renderAll();
}

function showJokerChoiceOverlay(onChoose) {
  pendingChoice = {
    mode: "joker",
    selectedRank: null,
    selectedSuit: null,
    onChoose
  };

  choiceTitle.textContent = "Choose the Joker card";
  rankChoicePanel.style.display = "block";
  resetChoiceState();
  choiceOverlay.classList.remove("is-hidden");
  renderAll();
}

function hideChoiceOverlay() {
  pendingChoice = null;
  choiceOverlay.classList.add("is-hidden");
  rankChoicePanel.style.display = "block";
  resetChoiceState();
  renderAll();
}

rankChoiceButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (!pendingChoice || pendingChoice.mode !== "joker") return;

    pendingChoice.selectedRank = button.dataset.rank;
    rankChoiceButtons.forEach((btn) => btn.classList.remove("is-active"));
    button.classList.add("is-active");
    choiceConfirmBtn.disabled = !(pendingChoice.selectedRank && pendingChoice.selectedSuit);
  });
});

suitChoiceButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (!pendingChoice) return;

    pendingChoice.selectedSuit = button.dataset.suit;
    suitChoiceButtons.forEach((btn) => btn.classList.remove("is-active"));
    button.classList.add("is-active");

    if (pendingChoice.mode === "suit") {
      choiceConfirmBtn.disabled = !pendingChoice.selectedSuit;
    } else {
      choiceConfirmBtn.disabled = !(pendingChoice.selectedRank && pendingChoice.selectedSuit);
    }
  });
});

choiceConfirmBtn.addEventListener("click", () => {
  if (!pendingChoice) return;

  const callback = pendingChoice.onChoose;

  if (pendingChoice.mode === "suit" && pendingChoice.selectedSuit) {
    const suit = pendingChoice.selectedSuit;
    hideChoiceOverlay();
    callback(suit);
    return;
  }

  if (pendingChoice.mode === "joker" && pendingChoice.selectedRank && pendingChoice.selectedSuit) {
    const declaredCard = {
      rank: pendingChoice.selectedRank,
      suit: pendingChoice.selectedSuit
    };
    hideChoiceOverlay();
    callback(declaredCard);
  }
});

function isPlayable(card, comboState = {}) {
  if (!card) return false;

  if (game.pendingSkip && game.forcedSkipResponse) {
    return canCounterSkipWith(card);
  }

  if (game.pendingDrawTotal > 0) {
    return canCounterDrawWith(card);
  }

  if (card.type === "joker") return true;
  if (getEffectiveRank(card) === "A") return true;

  if (comboState.allowTwoAfterRedjackCancel && getEffectiveRank(card) === "2") return true;
  if (comboState.allowBlackjackAfterTwo && isBlackjack(card)) return true;

  const activeSuit = getActiveSuit();
  const activeRank = getActiveRank();

  return getEffectiveSuit(card) === activeSuit || getEffectiveRank(card) === activeRank;
}

function removeCardFromPlayerZone(zone, cardId) {
  const arr = zone === "hand" ? game.player.hand : game.player.readyHand;
  const index = arr.findIndex((card) => card.id === cardId);
  if (index === -1) return null;
  return arr.splice(index, 1)[0];
}

function removeCardFromBot(cardId) {
  const index = game.bot.hand.findIndex((card) => card.id === cardId);
  if (index === -1) return null;
  return game.bot.hand.splice(index, 1)[0];
}

function recordLastPlayed(by, cards) {
  game.lastPlayed = {
    by,
    cards: cards.map((card) => ({ ...card, declaredAs: card.declaredAs ? { ...card.declaredAs } : undefined }))
  };
}

function placeCardOnDiscard(card) {
  game.discardPile.push(card);
}

function nextTurnName() {
  return game.turn === "player" ? "bot" : "player";
}

function resolveStartOfTurn() {
  clearTimeout(botTimeout);

  if (game.pendingDrawTotal > 0) {
    const availableCards = game.turn === "player" ? getPlayerAccessibleCards() : game.bot.hand;
    const canCounter = availableCards.some(canCounterDrawWith);

    if (canCounter) {
      if (game.turn === "player") {
        setMessage(`You're under a draw ${game.pendingDrawTotal} attack. You must answer with 2, Blackjack, Redjack, or Joker, or press Draw 1 to accept it.`);
      } else {
        setMessage("Bot is responding to the draw attack...");
      }
      renderAll();
      return false;
    }

    const target = game.turn === "player" ? game.player.hand : game.bot.hand;
    const drawn = drawMany(game.pendingDrawTotal);
    const count = drawn.length;
    target.push(...drawn);

    game.pendingDrawTotal = 0;
    setMessage(`${game.turn === "player" ? "You" : "Bot"} drew ${count} and lost the turn.`);
    renderAll();
    setTimeout(() => nextTurn(), 700);
    return true;
  }

  if (game.pendingSkip) {
    const availableCards = game.turn === "player" ? getPlayerAccessibleCards() : game.bot.hand;
    const canCounter = availableCards.some(canCounterSkipWith);

    if (canCounter) {
      game.forcedSkipResponse = true;
      if (game.turn === "player") {
        setMessage("You must begin with 8 or Joker to pass the skip forward. Otherwise it's a blunder.");
      } else {
        setMessage("Bot is responding to the skip...");
      }
      renderAll();
      return false;
    }

    game.pendingSkip = false;
    game.forcedSkipResponse = false;
    setMessage(game.turn === "player" ? "You were skipped." : "Bot was skipped.");
    renderAll();
    setTimeout(() => nextTurn(), 700);
    return true;
  }

  game.forcedSkipResponse = false;
  return false;
}

function applyCardEffect(card) {
  const rank = getEffectiveRank(card);

  if (isRedjack(card)) {
    if (game.pendingDrawTotal > 0) {
      game.pendingDrawTotal = 0;
      setMessage(`${game.turn === "player" ? "You" : "Bot"} played Redjack and cancelled the draw stack.`);
      return {
        extraTurn: false,
        stopSequence: false,
        needsSuitChoice: false,
        allowTwoAfterRedjackCancel: true,
        allowBlackjackAfterTwo: false
      };
    }

    setMessage(`${game.turn === "player" ? "You" : "Bot"} played Redjack.`);
    return {
      extraTurn: false,
      stopSequence: false,
      needsSuitChoice: false,
      allowTwoAfterRedjackCancel: false,
      allowBlackjackAfterTwo: false
    };
  }

  if (rank === "2") {
    game.pendingDrawTotal += 2;
    game.declaredSuit = null;
    game.forcedSkipResponse = false;
    setMessage(`${game.turn === "player" ? "You" : "Bot"} added 2. Draw stack is now ${game.pendingDrawTotal}.`);
    return {
      extraTurn: false,
      stopSequence: false,
      needsSuitChoice: false,
      allowTwoAfterRedjackCancel: false,
      allowBlackjackAfterTwo: true
    };
  }

  if (isBlackjack(card)) {
    game.pendingDrawTotal += 7;
    game.declaredSuit = null;
    game.forcedSkipResponse = false;
    setMessage(`${game.turn === "player" ? "You" : "Bot"} added Blackjack. Draw stack is now ${game.pendingDrawTotal}.`);
    return {
      extraTurn: false,
      stopSequence: true,
      needsSuitChoice: false,
      allowTwoAfterRedjackCancel: false,
      allowBlackjackAfterTwo: false
    };
  }

  if (rank === "7") {
    game.declaredSuit = null;
    game.forcedSkipResponse = false;
    setMessage(`${game.turn === "player" ? "You" : "Bot"} played 7 and gets another turn.`);
    return {
      extraTurn: true,
      stopSequence: true,
      needsSuitChoice: false,
      allowTwoAfterRedjackCancel: false,
      allowBlackjackAfterTwo: false
    };
  }

  if (rank === "8") {
    game.pendingSkip = true;
    game.declaredSuit = null;
    game.forcedSkipResponse = false;
    setMessage(`${game.turn === "player" ? "You" : "Bot"} played 8. Next player must answer with 8 if they can.`);
    return {
      extraTurn: false,
      stopSequence: true,
      needsSuitChoice: false,
      allowTwoAfterRedjackCancel: false,
      allowBlackjackAfterTwo: false
    };
  }

  if (rank === "10") {
    game.direction *= -1;
    game.declaredSuit = null;
    game.forcedSkipResponse = false;
    setMessage(`${game.turn === "player" ? "You" : "Bot"} played 10 and reversed direction.`);
    return {
      extraTurn: false,
      stopSequence: true,
      needsSuitChoice: false,
      allowTwoAfterRedjackCancel: false,
      allowBlackjackAfterTwo: false
    };
  }

  if (rank === "A" && !(card.type === "joker" && card.declaredAs)) {
    return {
      extraTurn: false,
      stopSequence: true,
      needsSuitChoice: true,
      allowTwoAfterRedjackCancel: false,
      allowBlackjackAfterTwo: false
    };
  }

  game.declaredSuit = null;
  game.forcedSkipResponse = false;
  return {
    extraTurn: false,
    stopSequence: false,
    needsSuitChoice: false,
    allowTwoAfterRedjackCancel: false,
    allowBlackjackAfterTwo: false
  };
}

function endTurn(extraTurn = false) {
  clearInterval(timerInterval);

  if (!extraTurn) {
    game.turn = nextTurnName();
  }

  renderAll();
  startTurn();
}

function nextTurn() {
  endTurn(false);
}

function startTurn() {
  renderAll();

  if (!game.started || game.paused || pendingChoice) return;
  if (resolveStartOfTurn()) return;

  startTimer();

  if (game.turn === "bot") {
    botTimeout = setTimeout(runBotTurn, 900);
  }
}

function continueAfterSuitChoice(chosenSuit, playedLabel, extraTurn) {
  game.declaredSuit = chosenSuit;
  setMessage(`${playedLabel} changed the suit to ${chosenSuit}.`);
  renderAll();
  setTimeout(() => endTurn(extraTurn), 500);
}

function continuePlayerSequence(cardsPlayed, extraTurn, comboState, playedThisTurn = []) {
  while (game.player.readyHand.length > 0) {
    const nextCard = game.player.readyHand[0];

    if (!isPlayable(nextCard, comboState)) {
      if (game.pendingSkip && game.forcedSkipResponse && playerHasForcedEightResponse()) {
        setMessage("You must begin with 8 or Joker while under skip pressure. This should be a blunder.");
      } else if (game.pendingDrawTotal > 0) {
        setMessage(`You must answer the draw ${game.pendingDrawTotal} stack with 2, Blackjack, Redjack, or Joker. Otherwise it's a blunder.`);
      } else if (cardsPlayed === 0) {
        setMessage(`${cardLabel(nextCard)} is not playable on ${cardLabel(getTopCard())}.`);
      } else {
        setMessage(`Sequence stopped because ${cardLabel(nextCard)} is no longer playable.`);
      }

      renderAll();
      if (cardsPlayed > 0) {
        recordLastPlayed("player", playedThisTurn);
        setTimeout(() => endTurn(extraTurn), 500);
      }
      return;
    }

    const playedCard = removeCardFromPlayerZone("ready", nextCard.id);
    if (!playedCard) break;

    if (playedCard.type === "joker" && !playedCard.declaredAs) {
      renderAll();
      showJokerChoiceOverlay((declaredCard) => {
        playedCard.declaredAs = declaredCard;

        if (game.pendingSkip && game.forcedSkipResponse && !canCounterSkipWith(playedCard)) {
          game.player.readyHand.unshift(playedCard);
          setMessage("Your Joker must be declared as an 8 while under skip pressure. Otherwise it's a blunder.");
          renderAll();
          return;
        }

        if (game.pendingDrawTotal > 0 && !canCounterDrawWith(playedCard)) {
          game.player.readyHand.unshift(playedCard);
          setMessage("Your Joker must be declared as 2, Blackjack, or Redjack while under draw pressure. Otherwise it's a blunder.");
          renderAll();
          return;
        }

        placeCardOnDiscard(playedCard);
        playedThisTurn.push(playedCard);

        const result = applyCardEffect(playedCard);
        const newCardsPlayed = cardsPlayed + 1;
        const newComboState = {
          allowTwoAfterRedjackCancel: result.allowTwoAfterRedjackCancel,
          allowBlackjackAfterTwo: result.allowBlackjackAfterTwo
        };

        renderAll();

        if (result.stopSequence) {
          recordLastPlayed("player", playedThisTurn);
          setTimeout(() => endTurn(result.extraTurn), 500);
        } else {
          continuePlayerSequence(newCardsPlayed, result.extraTurn, newComboState, playedThisTurn);
        }
      });
      return;
    }

    placeCardOnDiscard(playedCard);
    playedThisTurn.push(playedCard);
    cardsPlayed += 1;

    const result = applyCardEffect(playedCard);
    extraTurn = result.extraTurn;
    comboState = {
      allowTwoAfterRedjackCancel: result.allowTwoAfterRedjackCancel,
      allowBlackjackAfterTwo: result.allowBlackjackAfterTwo
    };

    if (result.needsSuitChoice) {
      const playedLabel = getEffectiveRank(playedCard) === "A" ? "Ace" : cardLabel(playedCard);
      renderAll();
      showSuitChoiceOverlay("Choose the suit for Ace", (suit) => {
        recordLastPlayed("player", playedThisTurn);
        continueAfterSuitChoice(suit, playedLabel, extraTurn);
      });
      return;
    }

    if (result.stopSequence) {
      renderAll();
      recordLastPlayed("player", playedThisTurn);
      setTimeout(() => endTurn(extraTurn), 500);
      return;
    }
  }

  if (cardsPlayed > 0) {
    recordLastPlayed("player", playedThisTurn);
    renderAll();
    setTimeout(() => endTurn(extraTurn), 500);
  } else {
    renderAll();
  }
}

function playReadyHand() {
  if (!canInteract()) return;

  if (game.player.readyHand.length === 0) {
    setMessage("Your ready hand is empty.");
    return;
  }

  continuePlayerSequence(0, false, {
    allowTwoAfterRedjackCancel: false,
    allowBlackjackAfterTwo: false
  }, []);
}

function drawOne() {
  if (!(game.started && !game.paused && game.turn === "player" && !pendingChoice)) return;

  if (game.pendingDrawTotal > 0) {
    const drawn = drawMany(game.pendingDrawTotal);
    game.player.hand.push(...drawn);
    const amount = drawn.length;
    game.pendingDrawTotal = 0;
    setMessage(`You accepted the attack and drew ${amount}.`);
    renderAll();
    setTimeout(() => endTurn(false), 500);
    return;
  }

  if (game.pendingSkip) {
    game.pendingSkip = false;
    game.forcedSkipResponse = false;
    setMessage("You accepted the skip.");
    renderAll();
    setTimeout(() => endTurn(false), 400);
    return;
  }

  const card = drawCardFromPile();
  if (!card) {
    setMessage("Draw pile is empty.");
    return;
  }

  game.player.hand.push(card);
  setMessage(`You drew ${cardLabel(card)}.`);
  renderAll();
  setTimeout(() => endTurn(false), 400);
}

function toggleKnock() {
  if (!canInteract()) return;

  game.player.knockArmed = !game.player.knockArmed;
  knockStatus.textContent = game.player.knockArmed ? "Armed" : "Not Armed";

  if (playerTurnBadge) {
    playerTurnBadge.textContent = game.turn === "player" ? "Your Turn" : "Bot Turn";
    playerTurnBadge.classList.toggle("player-badge--green", game.turn === "player");
  }

  if (startOverlay) {
    startOverlay.classList.toggle("is-hidden", game.started);
    startOverlay.setAttribute("aria-hidden", game.started ? "true" : "false");
  }
  setMessage(
    game.player.knockArmed
      ? "Knock armed. Your next turn would be the attempt."
      : "Knock cancelled."
  );
}

function findBotPlayableCard(comboState) {
  if (game.pendingDrawTotal > 0) {
    const redjack = game.bot.hand.find(isRedjack);
    if (redjack) return redjack;

    const blackjack = game.bot.hand.find(isBlackjack);
    if (blackjack) return blackjack;

    const two = game.bot.hand.find((card) => getEffectiveRank(card) === "2");
    if (two) return two;

    const joker = game.bot.hand.find((card) => card.type === "joker");
    if (joker) return joker;

    return null;
  }

  if (game.pendingSkip) {
    const eight = game.bot.hand.find((card) => isEight(card));
    if (eight) return eight;

    const joker = game.bot.hand.find((card) => card.type === "joker");
    if (joker) return joker;

    return null;
  }

  if (comboState.allowBlackjackAfterTwo) {
    const blackjack = game.bot.hand.find(isBlackjack);
    if (blackjack) return blackjack;

    const joker = game.bot.hand.find((card) => card.type === "joker");
    if (joker) return joker;
  }

  if (comboState.allowTwoAfterRedjackCancel) {
    const two = game.bot.hand.find((card) => getEffectiveRank(card) === "2");
    if (two) return two;

    const joker = game.bot.hand.find((card) => card.type === "joker");
    if (joker) return joker;
  }

  return game.bot.hand.find((card) => isPlayable(card, comboState)) || null;
}

function runBotTurn() {
  if (!game.started || game.paused || game.turn !== "bot" || pendingChoice) return;

  let extraTurn = false;
  let cardsPlayed = 0;
  let comboState = {
    allowTwoAfterRedjackCancel: false,
    allowBlackjackAfterTwo: false
  };
  const playedThisTurn = [];

  while (true) {
    const legalCard = findBotPlayableCard(comboState);
    if (!legalCard) break;

    const played = removeCardFromBot(legalCard.id);
    if (!played) break;

    if (played.type === "joker" && !played.declaredAs) {
      played.declaredAs = chooseBotJokerDeclaration(comboState);
    }

    placeCardOnDiscard(played);
    playedThisTurn.push(played);
    cardsPlayed += 1;

    const result = applyCardEffect(played);
    extraTurn = result.extraTurn;
    comboState = {
      allowTwoAfterRedjackCancel: result.allowTwoAfterRedjackCancel,
      allowBlackjackAfterTwo: result.allowBlackjackAfterTwo
    };

    if (played.type === "joker" && played.declaredAs) {
      setMessage(`Bot played Joker as ${played.declaredAs.rank}${played.declaredAs.suit}.`);
      renderAll();
      if (result.stopSequence) {
        recordLastPlayed("bot", playedThisTurn);
        setTimeout(() => endTurn(extraTurn), 500);
        return;
      }
      continue;
    }

    if (result.needsSuitChoice) {
      const chosenSuit = chooseBestSuitForBot();
      game.declaredSuit = chosenSuit;
      setMessage(`Bot played Ace and changed the suit to ${chosenSuit}.`);
      recordLastPlayed("bot", playedThisTurn);
      renderAll();
      setTimeout(() => endTurn(extraTurn), 500);
      return;
    }

    if (result.stopSequence) {
      recordLastPlayed("bot", playedThisTurn);
      renderAll();
      setTimeout(() => endTurn(extraTurn), 500);
      return;
    }
  }

  if (cardsPlayed > 0) {
    recordLastPlayed("bot", playedThisTurn);
    renderAll();
    setTimeout(() => endTurn(extraTurn), 500);
    return;
  }

  if (game.pendingSkip) {
    game.pendingSkip = false;
    game.forcedSkipResponse = false;
    setMessage("Bot accepted the skip.");
    renderAll();
    setTimeout(() => endTurn(false), 400);
    return;
  }

  if (game.pendingDrawTotal > 0) {
    const drawn = drawMany(game.pendingDrawTotal);
    game.bot.hand.push(...drawn);
    const amount = drawn.length;
    game.pendingDrawTotal = 0;
    setMessage(`Bot accepted the attack and drew ${amount}.`);
    renderAll();
    setTimeout(() => endTurn(false), 500);
    return;
  }

  const drawn = drawCardFromPile();
  if (drawn) {
    game.bot.hand.push(drawn);
    setMessage("Bot drew 1.");
  } else {
    setMessage("Bot had no move and the draw pile was empty.");
  }

  renderAll();
  setTimeout(() => endTurn(false), 400);
}

function startTimer() {
  clearInterval(timerInterval);
  game.timer = TURN_TIME;
  timerText.textContent = `${game.timer}s`;

  timerInterval = setInterval(() => {
    if (!game.started || game.paused || pendingChoice) return;

    game.timer -= 1;
    timerText.textContent = `${game.timer}s`;

    if (game.timer <= 0) {
      clearInterval(timerInterval);

      if (game.turn === "player") {
        setMessage("Time ran out. For now, your turn auto-passes.");
        setTimeout(() => endTurn(false), 300);
      } else {
        setMessage("Bot timer ended.");
        setTimeout(() => endTurn(false), 300);
      }
    }
  }, 1000);
}

function showPauseOverlay() {
  pauseOverlay.classList.remove("is-hidden");
}

function hidePauseOverlay() {
  pauseOverlay.classList.add("is-hidden");
}

function startGame() {
  if (game.started) return;

  game.started = true;
  game.paused = false;
  hidePauseOverlay();
  setMessage("Game started. Your move.");
  renderAll();
  startTurn();
}

function pauseGame() {
  if (!game.started || game.paused) return;

  game.paused = true;
  clearInterval(timerInterval);
  clearTimeout(botTimeout);
  showPauseOverlay();
  setMessage("Game paused.");
  renderAll();
}

function resumeGame() {
  if (!game.started) return;

  game.paused = false;
  hidePauseOverlay();
  setMessage("Game resumed.");
  renderAll();
  startTurn();
}

function togglePause() {
  if (!game.started) return;

  if (game.paused) {
    resumeGame();
  } else {
    pauseGame();
  }
}

startBtn.addEventListener("click", startGame);
pauseBtn.addEventListener("click", togglePause);
resumeBtn.addEventListener("click", resumeGame);
resumeBtnSecondary.addEventListener("click", resumeGame);

playBtn.addEventListener("click", playReadyHand);
drawBtn.addEventListener("click", drawOne);
knockBtn.addEventListener("click", toggleKnock);

buildInitialGame();
renderAll();
setupDropZone(playerHand, "playerHand");
setupDropZone(readyHand, "readyHand");