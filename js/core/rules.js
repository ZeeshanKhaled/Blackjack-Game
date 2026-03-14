export function getTopCard(game) {
  return game.discardPile[game.discardPile.length - 1] || null;
}

export function getEffectiveRank(card) {
  if (!card) return null;
  if (card.type === "joker" && card.declaredAs) return card.declaredAs.rank;
  return card.rank;
}

export function getEffectiveSuit(card) {
  if (!card) return null;
  if (card.type === "joker" && card.declaredAs) return card.declaredAs.suit;
  return card.suit;
}

export function getActiveSuit(game) {
  return game.declaredSuit || getEffectiveSuit(getTopCard(game)) || null;
}

export function getActiveRank(game) {
  return getEffectiveRank(getTopCard(game)) || null;
}

export function cardLabel(card) {
  if (!card) return "";
  if (card.type === "joker" && card.declaredAs) {
    return `Joker as ${card.declaredAs.rank}${card.declaredAs.suit}`;
  }
  return card.type === "joker" ? "Joker" : `${card.rank}${card.suit}`;
}

export function isRedSuit(suit) {
  return suit === "♥" || suit === "♦";
}

export function isBlackjack(card) {
  const rank = getEffectiveRank(card);
  const suit = getEffectiveSuit(card);
  return rank === "J" && (suit === "♠" || suit === "♣");
}

export function isRedjack(card) {
  const rank = getEffectiveRank(card);
  const suit = getEffectiveSuit(card);
  return rank === "J" && (suit === "♥" || suit === "♦");
}

export function isEight(card) {
  return getEffectiveRank(card) === "8";
}

export function canCounterDrawWith(card, game) {
  if (!card || game.pendingDrawTotal <= 0) return false;
  if (isRedjack(card)) return true;
  if (getEffectiveRank(card) === "2") return true;
  if (isBlackjack(card)) return true;
  if (card.type === "joker") return true;
  return false;
}

export function canCounterSkipWith(card) {
  if (!card) return false;
  if (isEight(card)) return true;
  if (card.type === "joker") return true;
  return false;
}


const RANK_ORDER = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function areAdjacentRanks(rankA, rankB) {
  const a = RANK_ORDER.indexOf(rankA);
  const b = RANK_ORDER.indexOf(rankB);
  if (a === -1 || b === -1) return false;
  const diff = Math.abs(a - b);
  return diff === 1 || diff === RANK_ORDER.length - 1;
}

export function isPlayable(card, game, comboState = {}) {
  if (!card) return false;

  if (game.pendingSkip && game.forcedSkipResponse) {
    return canCounterSkipWith(card);
  }

  if (game.pendingDrawTotal > 0) {
    return canCounterDrawWith(card, game);
  }

  if (card.type === "joker") return true;

  if (comboState.allowTwoAfterRedjackCancel && getEffectiveRank(card) === "2") return true;
  if (comboState.allowBlackjackAfterTwo && isBlackjack(card)) return true;

  const activeSuit = getActiveSuit(game);
  const activeRank = getActiveRank(game);

  if (getEffectiveRank(card) === "A") return true;

  return getEffectiveSuit(card) === activeSuit || getEffectiveRank(card) === activeRank;
}

export function isSequencePlayable(card, game, comboState = {}) {
  if (!card) return false;

  if (game.pendingSkip && game.forcedSkipResponse) {
    return canCounterSkipWith(card);
  }

  if (game.pendingDrawTotal > 0) {
    return canCounterDrawWith(card, game);
  }

  if (card.type === "joker") return true;

  if (comboState.allowTwoAfterRedjackCancel && getEffectiveRank(card) === "2") return true;
  if (comboState.allowBlackjackAfterTwo && isBlackjack(card)) return true;

  const topCard = getTopCard(game);
  if (!topCard) return isPlayable(card, game, comboState);

  const activeSuit = getActiveSuit(game);
  const activeRank = getActiveRank(game);
  const cardSuit = getEffectiveSuit(card);
  const cardRank = getEffectiveRank(card);

  if (cardRank === activeRank) return true;
  if (cardSuit === activeSuit && areAdjacentRanks(cardRank, activeRank)) return true;

  return false;
}

export function applyCardEffect(card, game, setMessage) {
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
    setMessage(`${game.turn === "player" ? "You" : "Bot"} played 10, reversed direction, and gets another turn.`);
    return {
      extraTurn: true,
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
