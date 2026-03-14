export function createTableUI({ elements, getGame, canInteract, createCardHTML, getTopCard }) {
  const {
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
  } = elements;

  function setMessage(text) {
    messageText.textContent = text;
  }

  function setReadyCount(count) {
    readyCount.textContent = `${count} Card${count === 1 ? "" : "s"}`;
  }

  function setBotCardCount(count) {
    botCardCount.textContent = `${count} Card${count === 1 ? "" : "s"}`;
  }

  function renderDiscardPile() {
    const game = getGame();
    const topCard = getTopCard(game);
    discardPile.innerHTML = topCard ? createCardHTML(topCard) : "";
  }

  function renderLastPlayed() {
    const game = getGame();
    if (!lastPlayedBy || !lastPlayedHand) return;

    const info = game.lastPlayed || { by: null, cards: [] };
    lastPlayedBy.textContent = info.by === "player" ? "You" : info.by === "bot" ? "Bot" : "—";
    lastPlayedHand.innerHTML = "";

    if (!info.cards || info.cards.length === 0) {
      lastPlayedHand.innerHTML = '<div class="last-played-empty">No move yet.</div>';
      return;
    }

    info.cards.forEach((card) => {
      lastPlayedHand.insertAdjacentHTML("beforeend", createCardHTML(card));
    });
  }

  function renderMeta() {
    const game = getGame();
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

  function updateControlState() {
    const disabled = !canInteract();
    playBtn.disabled = disabled;
    drawBtn.disabled = disabled;
    knockBtn.disabled = disabled;
    pauseBtn.disabled = !getGame().started;
  }

  return {
    setMessage,
    setReadyCount,
    setBotCardCount,
    renderDiscardPile,
    renderLastPlayed,
    renderMeta,
    updateControlState
  };
}
