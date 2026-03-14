export function createMessageUI({ setMessage, cardLabel, getTopCard }) {
  return {
    custom(message) {
      setMessage(message);
    },
    playerTimedOut() {
      setMessage("Time ran out. For now, your turn auto-passes.");
    },
    botTimedOut() {
      setMessage("Bot timer ended.");
    },
    movedToReady(card) {
      setMessage(`${cardLabel(card)} moved to your ready hand.`);
    },
    returnedToHand(card) {
      setMessage(`${cardLabel(card)} returned to your hand.`);
    },
    knockAttemptLive() {
      setMessage("Knock attempt live. Go out this turn.");
    },
    playerUnderDrawAttack(total) {
      setMessage(`You're under a draw ${total} attack. You must answer with 2, Blackjack, Redjack, or Joker, or press Draw 1 to accept it.`);
    },
    botRespondingToDrawAttack() {
      setMessage("Bot is responding to the draw attack...");
    },
    drewAndLostTurn(turn, count) {
      setMessage(`${turn === "player" ? "You" : "Bot"} drew ${count} and lost the turn.`);
    },
    playerMustStartSkipResponse() {
      setMessage("You must begin with 8 or Joker to pass the skip forward. Otherwise it's a blunder.");
    },
    botRespondingToSkip() {
      setMessage("Bot is responding to the skip...");
    },
    wasSkipped(turn) {
      setMessage(turn === "player" ? "You were skipped." : "Bot was skipped.");
    },
    knockFailed() {
      setMessage("Knock failed. You did not go out this turn.");
    },
    changedSuit(playedLabel, suit) {
      setMessage(`${playedLabel} changed the suit to ${suit}.`);
    },
    mustBeginWithEightOrJoker() {
      setMessage("You must begin with 8 or Joker while under skip pressure. This should be a blunder.");
    },
    mustAnswerDrawStack(total) {
      setMessage(`You must answer the draw ${total} stack with 2, Blackjack, Redjack, or Joker. Otherwise it's a blunder.`);
    },
    notPlayableOnTop(card) {
      setMessage(`${cardLabel(card)} is not playable on ${cardLabel(getTopCard())}.`);
    },
    sequenceStopped(card) {
      setMessage(`Sequence stopped because ${cardLabel(card)} is no longer playable.`);
    },
    jokerMustBeEightUnderSkip() {
      setMessage("Your Joker must be declared as an 8 while under skip pressure. Otherwise it's a blunder.");
    },
    jokerMustCounterDraw() {
      setMessage("Your Joker must be declared as 2, Blackjack, or Redjack while under draw pressure. Otherwise it's a blunder.");
    },
    readyHandEmpty() {
      setMessage("Your ready hand is empty.");
    },
    acceptedAttack(amount) {
      setMessage(`You accepted the attack and drew ${amount}.`);
    },
    acceptedSkip() {
      setMessage("You accepted the skip.");
    },
    drawPileEmpty() {
      setMessage("Draw pile is empty.");
    },
    drewCard(card) {
      setMessage(`You drew ${cardLabel(card)}.`);
    },
    knockToggled(isArmed) {
      setMessage(isArmed ? "Knock armed. Your next turn would be the attempt." : "Knock cancelled.");
    },
    gameStarted() {
      setMessage("Game started. Your move.");
    },
    gamePaused() {
      setMessage("Game paused.");
    },
    gameResumed() {
      setMessage("Game resumed.");
    }
  };
}
