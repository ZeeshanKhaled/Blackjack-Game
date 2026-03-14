import { drawCardFromPile, drawMany } from "./deck.js";
import { recordLastPlayed, placeCardOnDiscard, nextTurnName } from "./game-state.js";
import {
  getTopCard,
  getEffectiveRank,
  cardLabel,
  canCounterDrawWith,
  canCounterSkipWith,
  isPlayable,
  applyCardEffect
} from "./rules.js";

export function createTurnManager(ctx) {
  const {
    getGame,
    getPendingChoice,
    setMessage,
    renderAll,
    startTimer,
    scheduleBotTurn,
    clearBotTurn,
    showSuitChoiceOverlay,
    showJokerChoiceOverlay,
    removeCardFromPlayerZone,
    getPlayerAccessibleCards,
    playerHasForcedEightResponse,
    onGameOver
  } = ctx;

  function totalPlayerCards(game) {
    return game.player.hand.length + game.player.readyHand.length;
  }

  function endGame(winner, message) {
    const game = getGame();
    game.over = true;
    game.winner = winner;
    game.started = false;
    game.paused = false;
    game.player.knockArmed = false;
    game.player.knockActive = false;
    clearBotTurn();
    if (message) setMessage(message);
    renderAll();
    onGameOver?.(winner);
    return true;
  }

  function checkWinState() {
    const game = getGame();

    if (totalPlayerCards(game) === 0) {
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
    const game = getGame();
    clearBotTurn();

    if (game.turn === "player" && game.player.knockArmed) {
      game.player.knockArmed = false;
      game.player.knockActive = true;
      setMessage("Knock attempt live. Go out this turn.");
    }

    if (game.pendingDrawTotal > 0) {
      const availableCards = game.turn === "player" ? getPlayerAccessibleCards() : game.bot.hand;
      const canCounter = availableCards.some((card) => canCounterDrawWith(card, game));

      if (canCounter) {
        if (game.turn === "player") {
          setMessage(`You're under a draw ${game.pendingDrawTotal} attack. Answer with 2, Blackjack, Redjack, or Joker, or press Draw 1 to accept it.`);
        } else {
          setMessage("Bot is responding to the draw attack...");
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
          setMessage("You must begin with 8 or Joker to pass the skip forward. Otherwise it is a blunder.");
        } else {
          setMessage("Bot is responding to the skip...");
        }
        renderAll();
        return false;
      }

      game.pendingSkip = false;
      game.forcedSkipResponse = false;
      game.player.knockActive = false;
      setMessage(game.turn === "player" ? "You were skipped." : "Bot was skipped.");
      renderAll();
      setTimeout(() => nextTurn(), 700);
      return true;
    }

    game.forcedSkipResponse = false;
    return false;
  }

  function endTurn(extraTurn = false) {
    const game = getGame();

    if (checkWinState()) return;

    if (game.turn === "player" && game.player.knockActive && totalPlayerCards(game) > 0) {
      game.player.knockActive = false;
      setMessage("Knock failed. You did not go out this turn.");
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

  function startTurn() {
    const game = getGame();
    renderAll();

    if (!game.started || game.paused || game.over || getPendingChoice()) return;
    if (resolveStartOfTurn()) return;
    if (checkWinState()) return;

    startTimer();
    if (game.turn === "bot") scheduleBotTurn();
  }

  function continueAfterSuitChoice(chosenSuit, playedLabel, extraTurn) {
    const game = getGame();
    game.declaredSuit = chosenSuit;
    setMessage(`${playedLabel} changed the suit to ${chosenSuit}.`);
    renderAll();
    setTimeout(() => endTurn(extraTurn), 500);
  }

  function continuePlayerSequence(cardsPlayed, extraTurn, comboState, playedThisTurn = []) {
    const game = getGame();

    while (game.player.readyHand.length > 0) {
      const nextCard = game.player.readyHand[0];

      if (!isPlayable(nextCard, game, comboState)) {
        if (game.pendingSkip && game.forcedSkipResponse && playerHasForcedEightResponse()) {
          setMessage("You must begin with 8 or Joker while under skip pressure. This should be a blunder.");
        } else if (game.pendingDrawTotal > 0) {
          setMessage(`You must answer the draw ${game.pendingDrawTotal} stack with 2, Blackjack, Redjack, or Joker.`);
        } else if (cardsPlayed === 0) {
          setMessage(`${cardLabel(nextCard)} is not playable on ${cardLabel(getTopCard(game))}.`);
        } else {
          setMessage(`Sequence stopped because ${cardLabel(nextCard)} is no longer playable.`);
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
          const innerGame = getGame();
          playedCard.declaredAs = declaredCard;

          if (innerGame.pendingSkip && innerGame.forcedSkipResponse && !canCounterSkipWith(playedCard)) {
            innerGame.player.readyHand.unshift(playedCard);
            setMessage("Your Joker must be declared as an 8 while under skip pressure.");
            renderAll();
            return;
          }

          if (innerGame.pendingDrawTotal > 0 && !canCounterDrawWith(playedCard, innerGame)) {
            innerGame.player.readyHand.unshift(playedCard);
            setMessage("Your Joker must be declared as 2, Blackjack, or Redjack while under draw pressure.");
            renderAll();
            return;
          }

          placeCardOnDiscard(innerGame, playedCard);
          playedThisTurn.push(playedCard);

          const result = applyCardEffect(playedCard, innerGame, setMessage);
          const newCardsPlayed = cardsPlayed + 1;
          const newComboState = {
            allowTwoAfterRedjackCancel: result.allowTwoAfterRedjackCancel,
            allowBlackjackAfterTwo: result.allowBlackjackAfterTwo
          };

          if (checkWinState()) return;

          renderAll();

          if (result.stopSequence) {
            recordLastPlayed(innerGame, "player", playedThisTurn);
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
          const innerGame = getGame();
          recordLastPlayed(innerGame, "player", playedThisTurn);
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
      if (checkWinState()) return;
      setTimeout(() => endTurn(extraTurn), 500);
    } else {
      renderAll();
    }
  }

  function playReadyHand() {
    const game = getGame();
    if (!game.started || game.paused || game.turn !== "player" || getPendingChoice() || game.over) return;

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
    const game = getGame();
    if (!(game.started && !game.paused && game.turn === "player" && !getPendingChoice() && !game.over)) return;

    if (game.pendingDrawTotal > 0) {
      const drawn = drawMany(game, game.pendingDrawTotal);
      game.player.hand.push(...drawn);
      const amount = drawn.length;
      game.pendingDrawTotal = 0;
      game.player.knockActive = false;
      setMessage(`You accepted the attack and drew ${amount}.`);
      renderAll();
      setTimeout(() => endTurn(false), 500);
      return;
    }

    if (game.pendingSkip) {
      game.pendingSkip = false;
      game.forcedSkipResponse = false;
      game.player.knockActive = false;
      setMessage("You accepted the skip.");
      renderAll();
      setTimeout(() => endTurn(false), 400);
      return;
    }

    const card = drawCardFromPile(game);
    if (!card) {
      setMessage("Draw pile is empty.");
      return;
    }

    game.player.hand.push(card);
    game.player.knockActive = false;
    setMessage(`You drew ${cardLabel(card)}.`);
    renderAll();
    setTimeout(() => endTurn(false), 400);
  }

  function toggleKnock() {
    const game = getGame();
    if (!(game.started && !game.paused && game.turn === "player" && !getPendingChoice() && !game.over)) return;
    if (game.player.knockActive) return;

    game.player.knockArmed = !game.player.knockArmed;
    setMessage(game.player.knockArmed ? "Knock armed. Your next turn is your attempt to go out." : "Knock cancelled.");
    renderAll();
  }

  return {
    checkWinState,
    startTurn,
    endTurn,
    nextTurn,
    playReadyHand,
    drawOne,
    toggleKnock
  };
}
