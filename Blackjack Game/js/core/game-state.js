import { createDeck, shuffle, drawCardFromPile } from "./deck.js";

export function buildInitialGame(suits, turnTime) {
  const shuffledDeck = shuffle(createDeck(suits));

  const game = {
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
    timer: turnTime,
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
    game.player.hand.push(drawCardFromPile(game));
    game.bot.hand.push(drawCardFromPile(game));
  }

  let startingCard = drawCardFromPile(game);
  while (startingCard && startingCard.type === "joker") {
    game.drawPile.push(startingCard);
    game.drawPile = shuffle(game.drawPile);
    startingCard = drawCardFromPile(game);
  }

  if (startingCard) {
    game.discardPile.push(startingCard);
  }

  return game;
}

export function recordLastPlayed(game, by, cards) {
  game.lastPlayed = {
    by,
    cards: cards.map((card) => ({
      ...card,
      declaredAs: card.declaredAs ? { ...card.declaredAs } : null
    }))
  };
}

export function placeCardOnDiscard(game, card) {
  game.declaredSuit = null;
  game.discardPile.push(card);
}

export function nextTurnName(game) {
  return game.turn === "player" ? "bot" : "player";
}
