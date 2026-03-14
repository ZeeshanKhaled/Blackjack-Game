export function createHandUI({ getGame }) {
  function findPlayerCard(cardId) {
    const game = getGame();

    const inHand = game.player.hand.find((card) => card.id === cardId);
    if (inHand) return { zone: "hand", card: inHand };

    const inReady = game.player.readyHand.find((card) => card.id === cardId);
    if (inReady) return { zone: "ready", card: inReady };

    return null;
  }

  function getPlayerAccessibleCards() {
    const game = getGame();
    return [...game.player.hand, ...game.player.readyHand];
  }

  return {
    findPlayerCard,
    getPlayerAccessibleCards
  };
}
