import { recycleDiscardIntoDrawPile, drawCardFromPile, drawMany } from "./core/deck.js";
import { buildInitialGame, recordLastPlayed, placeCardOnDiscard, nextTurnName } from "./core/game-state.js";
import { getTopCard, getEffectiveRank, getActiveSuit, getActiveRank, cardLabel, isBlackjack, isRedjack, isEight, canCounterDrawWith, canCounterSkipWith, isPlayable, applyCardEffect } from "./core/rules.js";
import { createRenderer } from "./ui/render.js";
import { createBotController } from "./core/bot-ai.js";
import { createTurnTimer } from "./core/timer.js";
import { createChoiceUI } from "./ui/choice-ui.js";
import { createMessageUI } from "./ui/message-ui.js";
import { createReadyHandUI } from "./ui/ready-hand-ui.js";

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


const SUITS = ["♠", "♥", "♦", "♣"];
const TURN_TIME = 15;

let game = buildInitialGame(SUITS, TURN_TIME);
let botTimeout = null;
let pendingChoice = null;

function canInteract() {
  return game.started && !game.paused && !game.over && game.turn === "player" && !pendingChoice;
}

const { setMessage, renderAll: baseRenderAll } = createRenderer({
  elements: {
    playerHand,
    readyHand,
    botHand,
    discardPile,
    messageText,
    turnText,
    timerText,
    readyCount,
    knockStatus,
    drawPileCount,
    botCardCount,
    startOverlay,
    playerTurnBadge,
    lastPlayedBy,
    lastPlayedHand,
    declaredSuitIndicator,
    declaredSuitIcon,
    playBtn,
    drawBtn,
    knockBtn,
    pauseBtn
  },
  getGame: () => game,
  canInteract
});

function renderAll() {
  baseRenderAll();
  bindRenderedCards();
}

const turnTimer = createTurnTimer({
  getGame: () => game,
  turnTime: TURN_TIME,
  onTick: (time) => {
    timerText.textContent = `${time}s`;
  },
  onTimeout: (turn) => {
    if (turn === "player") {
      messages.playerTimedOut();
      setTimeout(() => endTurn(false), 300);
    } else {
      messages.botTimedOut();
      setTimeout(() => endTurn(false), 300);
    }
  },
  pendingChoiceRef: () => pendingChoice
});

const choiceUI = createChoiceUI({
  elements: {
    choiceOverlay: document.getElementById("choiceOverlay"),
    choiceTitle: document.getElementById("choiceTitle"),
    choiceConfirmBtn: document.getElementById("choiceConfirmBtn"),
    suitChoiceButtons: [...document.querySelectorAll(".suit-choice-btn")],
    rankChoiceButtons: [...document.querySelectorAll(".rank-choice-btn")],
    rankChoicePanel: document.getElementById("rankChoicePanel")
  },
  onStateChange: () => renderAll(),
  getPendingChoice: () => pendingChoice,
  setPendingChoice: (value) => {
    pendingChoice = value;
  }
});

const {
  showSuitChoiceOverlay,
  showJokerChoiceOverlay,
  hideChoiceOverlay
} = choiceUI;

const messages = createMessageUI({ setMessage, cardLabel, getTopCard: () => getTopCard(game) });

const readyHandUI = createReadyHandUI({
  elements: { playerHand, readyHand },
  getGame: () => game,
  canInteract,
  onRender: renderAll,
  messages
});

const {
  findPlayerCard,
  getPlayerAccessibleCards,
  moveCardBetweenZones,
  bindRenderedCards,
  setupDropZone,
  resetDragState
} = readyHandUI;

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

function totalPlayerCards() {
  return game.player.hand.length + game.player.readyHand.length;
}

function endGame(winner, message) {
  game.over = true;
  game.winner = winner;
  game.started = false;
  game.paused = false;
  game.player.knockArmed = false;
  game.player.knockActive = false;
  turnTimer.clearTimer();
  clearTimeout(botTimeout);
  if (startBtn) {
    startBtn.textContent = "Play Again";
  }
  if (message) messages.custom(message);
  renderAll();
  return true;
}

function checkWinState() {
  if (totalPlayerCards() === 0) {
    if (game.player.knockActive || game.player.knockArmed) {
      return endGame("player", "You knocked and went out. You win!");
    }
    return endGame("player", "You went out. You win!");
  }

  if (game.bot.hand.length === 0) {
    return endGame("bot", "Bot went out and wins.");
  }

  return false;
}

function resolveStartOfTurn() {
  clearTimeout(botTimeout);

  if (game.turn === "player" && game.player.knockArmed) {
    game.player.knockArmed = false;
    game.player.knockActive = true;
    messages.knockAttemptLive();
  }

  if (game.pendingDrawTotal > 0) {
    const availableCards = game.turn === "player" ? getPlayerAccessibleCards() : game.bot.hand;
    const canCounter = availableCards.some((card) => canCounterDrawWith(card, game));

    if (canCounter) {
      if (game.turn === "player") {
        messages.playerUnderDrawAttack(game.pendingDrawTotal);
      } else {
        messages.botRespondingToDrawAttack();
      }
      renderAll();
      return false;
    }

    const target = game.turn === "player" ? game.player.hand : game.bot.hand;
    const drawn = drawMany(game, game.pendingDrawTotal);
    const count = drawn.length;
    target.push(...drawn);

    game.pendingDrawTotal = 0;
    game.player.knockActive = false;
    messages.drewAndLostTurn(game.turn, count);
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
        messages.playerMustStartSkipResponse();
      } else {
        messages.botRespondingToSkip();
      }
      renderAll();
      return false;
    }

    game.pendingSkip = false;
    game.forcedSkipResponse = false;
    game.player.knockActive = false;
    messages.wasSkipped(game.turn);
    renderAll();
    setTimeout(() => nextTurn(), 700);
    return true;
  }

  game.forcedSkipResponse = false;
  return false;
}

function endTurn(extraTurn = false) {
  turnTimer.clearTimer();

  if (checkWinState()) return;

  if (game.turn === "player" && game.player.knockActive && totalPlayerCards() > 0) {
    game.player.knockActive = false;
    messages.knockFailed();
  }

  if (!extraTurn) {
    game.turn = nextTurnName(game);
  }

  renderAll();
  startTurn();
}

function nextTurn() {
  endTurn(false);
}

const botController = createBotController({
  getGame: () => game,
  setMessage,
  renderAll,
  removeCardFromBot,
  drawMany,
  drawCardFromPile,
  endTurn,
  pendingChoiceRef: () => pendingChoice
});

function startTurn() {
  renderAll();

  if (!game.started || game.paused || game.over || pendingChoice) return;
  if (resolveStartOfTurn()) return;
  if (checkWinState()) return;

  turnTimer.startTimer();

  if (game.turn === "bot") {
    botTimeout = setTimeout(botController.runBotTurn, 900);
  }
}

function continueAfterSuitChoice(chosenSuit, playedLabel, extraTurn) {
  game.declaredSuit = chosenSuit;
  messages.changedSuit(playedLabel, chosenSuit);
  renderAll();
  setTimeout(() => endTurn(extraTurn), 500);
}

function continuePlayerSequence(cardsPlayed, extraTurn, comboState, playedThisTurn = []) {
  while (game.player.readyHand.length > 0) {
    const nextCard = game.player.readyHand[0];

    if (!isPlayable(nextCard, game, comboState)) {
      if (game.pendingSkip && game.forcedSkipResponse && playerHasForcedEightResponse()) {
        messages.mustBeginWithEightOrJoker();
      } else if (game.pendingDrawTotal > 0) {
        messages.mustAnswerDrawStack(game.pendingDrawTotal);
      } else if (cardsPlayed === 0) {
        messages.notPlayableOnTop(nextCard);
      } else {
        messages.sequenceStopped(nextCard);
      }

      renderAll();
      if (cardsPlayed > 0) {
        recordLastPlayed(game, "player", playedThisTurn);
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
          messages.jokerMustBeEightUnderSkip();
          renderAll();
          return;
        }

        if (game.pendingDrawTotal > 0 && !canCounterDrawWith(playedCard)) {
          game.player.readyHand.unshift(playedCard);
          messages.jokerMustCounterDraw();
          renderAll();
          return;
        }

        placeCardOnDiscard(game, playedCard);
        playedThisTurn.push(playedCard);

        const result = applyCardEffect(playedCard, game, setMessage);
        const newCardsPlayed = cardsPlayed + 1;
        const newComboState = {
          allowTwoAfterRedjackCancel: result.allowTwoAfterRedjackCancel,
          allowBlackjackAfterTwo: result.allowBlackjackAfterTwo
        };

        if (checkWinState()) {
          recordLastPlayed(game, "player", playedThisTurn);
          return;
        }

        renderAll();

        if (result.stopSequence) {
          recordLastPlayed(game, "player", playedThisTurn);
          setTimeout(() => endTurn(result.extraTurn), 500);
        } else {
          continuePlayerSequence(newCardsPlayed, result.extraTurn, newComboState, playedThisTurn);
        }
      });
      return;
    }

    placeCardOnDiscard(game, playedCard);
    playedThisTurn.push(playedCard);
    cardsPlayed += 1;

    const result = applyCardEffect(playedCard, game, setMessage);
    extraTurn = result.extraTurn;
    comboState = {
      allowTwoAfterRedjackCancel: result.allowTwoAfterRedjackCancel,
      allowBlackjackAfterTwo: result.allowBlackjackAfterTwo
    };

    if (checkWinState()) {
      recordLastPlayed(game, "player", playedThisTurn);
      return;
    }

    if (result.needsSuitChoice) {
      const playedLabel = getEffectiveRank(playedCard) === "A" ? "Ace" : cardLabel(playedCard);
      renderAll();
      showSuitChoiceOverlay("Choose the suit for Ace", (suit) => {
        recordLastPlayed(game, "player", playedThisTurn);
        continueAfterSuitChoice(suit, playedLabel, extraTurn);
      });
      return;
    }

    if (result.stopSequence) {
      renderAll();
      recordLastPlayed(game, "player", playedThisTurn);
      setTimeout(() => endTurn(extraTurn), 500);
      return;
    }
  }

  if (cardsPlayed > 0) {
    recordLastPlayed(game, "player", playedThisTurn);
    renderAll();
    setTimeout(() => endTurn(extraTurn), 500);
  } else {
    renderAll();
  }
}

function playReadyHand() {
  if (!canInteract() || game.over) return;

  if (game.player.readyHand.length === 0) {
    messages.readyHandEmpty();
    return;
  }

  continuePlayerSequence(0, false, {
    allowTwoAfterRedjackCancel: false,
    allowBlackjackAfterTwo: false
  }, []);
}

function drawOne() {
  if (!(game.started && !game.paused && game.turn === "player" && !pendingChoice && !game.over)) return;

  if (game.pendingDrawTotal > 0) {
    const drawn = drawMany(game, game.pendingDrawTotal);
    game.player.hand.push(...drawn);
    const amount = drawn.length;
    game.pendingDrawTotal = 0;
    game.player.knockActive = false;
    messages.acceptedAttack(amount);
    renderAll();
    setTimeout(() => endTurn(false), 500);
    return;
  }

  if (game.pendingSkip) {
    game.pendingSkip = false;
    game.forcedSkipResponse = false;
    game.player.knockActive = false;
    messages.acceptedSkip();
    renderAll();
    setTimeout(() => endTurn(false), 400);
    return;
  }

  const card = drawCardFromPile(game);
  if (!card) {
    messages.drawPileEmpty();
    return;
  }

  game.player.hand.push(card);
  game.player.knockActive = false;
  messages.drewCard(card);
  renderAll();
  setTimeout(() => endTurn(false), 400);
}

function toggleKnock() {
  if (!canInteract() || game.over) return;
  if (game.player.knockActive) return;

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
  messages.knockToggled(game.player.knockArmed);
}

function showPauseOverlay() {
  pauseOverlay.classList.remove("is-hidden");
}

function hidePauseOverlay() {
  pauseOverlay.classList.add("is-hidden");
}

function resetGameState() {
  turnTimer.clearTimer();
  clearTimeout(botTimeout);
  botTimeout = null;
  resetDragState();
  pendingChoice = null;
  hideChoiceOverlay();
  hidePauseOverlay();

  game = buildInitialGame(SUITS, TURN_TIME);
  game.started = true;
  game.paused = false;
  game.over = false;
  game.winner = null;

  if (startBtn) {
    startBtn.textContent = "Start Game";
  }
}

function startGame() {
  if (game.started && !game.over) return;

  resetGameState();
  messages.gameStarted();
  renderAll();
  startTurn();
}

function pauseGame() {
  if (!game.started || game.paused) return;

  game.paused = true;
  turnTimer.clearTimer();
  clearTimeout(botTimeout);
  showPauseOverlay();
  messages.gamePaused();
  renderAll();
}

function resumeGame() {
  if (!game.started) return;

  game.paused = false;
  hidePauseOverlay();
  messages.gameResumed();
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

renderAll();
setupDropZone(playerHand, "playerHand");
setupDropZone(readyHand, "readyHand");
