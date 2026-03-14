export function createTurnTimer({ getGame, turnTime, onTick, onTimeout, pendingChoiceRef }) {
  let timerInterval = null;

  function clearTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  function startTimer() {
    const game = getGame();
    clearTimer();
    game.timer = turnTime;
    onTick(game.timer);

    timerInterval = setInterval(() => {
      const currentGame = getGame();
      if (!currentGame.started || currentGame.paused || pendingChoiceRef()) return;

      currentGame.timer -= 1;
      onTick(currentGame.timer);

      if (currentGame.timer <= 0) {
        clearTimer();
        onTimeout(currentGame.turn);
      }
    }, 1000);
  }

  return {
    startTimer,
    clearTimer
  };
}
