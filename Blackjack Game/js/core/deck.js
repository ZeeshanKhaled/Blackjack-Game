export function createDeck(suits) {
  const deck = [];
  let id = 0;
  const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

  for (const suit of suits) {
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

export function shuffle(deck) {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function recycleDiscardIntoDrawPile(game) {
  if (game.drawPile.length > 0) return;
  if (game.discardPile.length <= 1) return;

  const topCard = game.discardPile[game.discardPile.length - 1];
  const recyclable = game.discardPile.slice(0, -1);

  game.drawPile = shuffle(recyclable);
  game.discardPile = [topCard];
}

export function drawCardFromPile(game) {
  if (game.drawPile.length === 0) {
    recycleDiscardIntoDrawPile(game);
  }

  if (game.drawPile.length === 0) return null;
  return game.drawPile.shift();
}

export function drawMany(game, count) {
  const cards = [];
  for (let i = 0; i < count; i++) {
    const card = drawCardFromPile(game);
    if (!card) break;
    cards.push(card);
  }
  return cards;
}
