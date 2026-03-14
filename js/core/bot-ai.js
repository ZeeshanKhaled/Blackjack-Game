import {
  getEffectiveRank,
  getEffectiveSuit,
  isRedjack,
  isBlackjack,
  isEight,
  isPlayable,
  isSequencePlayable,
  applyCardEffect
} from './rules.js';
import { recordLastPlayed, placeCardOnDiscard } from './game-state.js';

export function createBotController(deps) {
  const {
    getGame,
    setMessage,
    renderAll,
    removeCardFromBot,
    drawMany,
    drawCardFromPile,
    endTurn,
    pendingChoiceRef
  } = deps;

  function chooseBestSuitForBot() {
    const game = getGame();
    const counts = { '♠': 0, '♥': 0, '♦': 0, '♣': 0 };

    game.bot.hand.forEach((card) => {
      const suit = getEffectiveSuit(card);
      if (suit && counts[suit] !== undefined) counts[suit] += 1;
    });

    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  function chooseBotJokerDeclaration(comboState = {}) {
    const game = getGame();
    const bestSuit = chooseBestSuitForBot();

    if (game.pendingDrawTotal > 0) {
      if (comboState.preferRedjackCancel) return { rank: 'J', suit: '♥' };
      if (comboState.preferBlackjackStack) return { rank: 'J', suit: '♠' };
      return { rank: '2', suit: bestSuit };
    }

    if (game.pendingSkip) {
      return { rank: '8', suit: bestSuit };
    }

    if (comboState.allowBlackjackAfterTwo) {
      return { rank: 'J', suit: '♠' };
    }

    if (comboState.allowTwoAfterRedjackCancel) {
      return { rank: '2', suit: bestSuit };
    }

    return { rank: '8', suit: bestSuit };
  }

  function findBotPlayableCard(comboState) {
    const game = getGame();

    if (game.pendingDrawTotal > 0) {
      const redjack = game.bot.hand.find(isRedjack);
      if (redjack) return redjack;

      const blackjack = game.bot.hand.find(isBlackjack);
      if (blackjack) return blackjack;

      const two = game.bot.hand.find((card) => getEffectiveRank(card) === '2');
      if (two) return two;

      const joker = game.bot.hand.find((card) => card.type === 'joker');
      if (joker) return joker;

      return null;
    }

    if (game.pendingSkip) {
      const eight = game.bot.hand.find((card) => isEight(card));
      if (eight) return eight;

      const joker = game.bot.hand.find((card) => card.type === 'joker');
      if (joker) return joker;

      return null;
    }

    if (comboState.allowBlackjackAfterTwo) {
      const blackjack = game.bot.hand.find(isBlackjack);
      if (blackjack) return blackjack;

      const joker = game.bot.hand.find((card) => card.type === 'joker');
      if (joker) return joker;
    }

    if (comboState.allowTwoAfterRedjackCancel) {
      const two = game.bot.hand.find((card) => getEffectiveRank(card) === '2');
      if (two) return two;

      const joker = game.bot.hand.find((card) => card.type === 'joker');
      if (joker) return joker;
    }

    const playCheck = comboState.sequenceMode ? isSequencePlayable : isPlayable;
    return game.bot.hand.find((card) => playCheck(card, game, comboState)) || null;
  }

  function runBotTurn() {
    const game = getGame();
    if (!game.started || game.paused || game.turn !== 'bot' || pendingChoiceRef()) return;

    let extraTurn = false;
    let cardsPlayed = 0;
    let comboState = {
      allowTwoAfterRedjackCancel: false,
      allowBlackjackAfterTwo: false
    };
    const playedThisTurn = [];

    while (true) {
      const legalCard = findBotPlayableCard({ ...comboState, sequenceMode: cardsPlayed > 0 });
      if (!legalCard) break;

      const played = removeCardFromBot(legalCard.id);
      if (!played) break;

      if (played.type === 'joker' && !played.declaredAs) {
        played.declaredAs = chooseBotJokerDeclaration(comboState);
      }

      placeCardOnDiscard(game, played);
      playedThisTurn.push(played);
      cardsPlayed += 1;

      const result = applyCardEffect(played, game, setMessage);
      extraTurn = result.extraTurn;
      comboState = {
        allowTwoAfterRedjackCancel: result.allowTwoAfterRedjackCancel,
        allowBlackjackAfterTwo: result.allowBlackjackAfterTwo
      };

      if (played.type === 'joker' && played.declaredAs) {
        setMessage(`Bot played Joker as ${played.declaredAs.rank}${played.declaredAs.suit}.`);
        renderAll();
        if (result.stopSequence) {
          recordLastPlayed(game, 'bot', playedThisTurn);
          setTimeout(() => endTurn(extraTurn), 500);
          return;
        }
        continue;
      }

      if (result.needsSuitChoice) {
        const chosenSuit = chooseBestSuitForBot();
        game.declaredSuit = chosenSuit;
        setMessage(`Bot played Ace and changed the suit to ${chosenSuit}.`);
        recordLastPlayed(game, 'bot', playedThisTurn);
        renderAll();
        setTimeout(() => endTurn(extraTurn), 500);
        return;
      }

      if (result.stopSequence) {
        recordLastPlayed(game, 'bot', playedThisTurn);
        renderAll();
        setTimeout(() => endTurn(extraTurn), 500);
        return;
      }
    }

    if (cardsPlayed > 0) {
      recordLastPlayed(game, 'bot', playedThisTurn);
      renderAll();
      setTimeout(() => endTurn(extraTurn), 500);
      return;
    }

    if (game.pendingSkip) {
      game.pendingSkip = false;
      game.forcedSkipResponse = false;
      setMessage('Bot accepted the skip.');
      renderAll();
      setTimeout(() => endTurn(false), 400);
      return;
    }

    if (game.pendingDrawTotal > 0) {
      const drawn = drawMany(game, game.pendingDrawTotal);
      game.bot.hand.push(...drawn);
      const amount = drawn.length;
      game.pendingDrawTotal = 0;
      setMessage(`Bot accepted the attack and drew ${amount}.`);
      renderAll();
      setTimeout(() => endTurn(false), 500);
      return;
    }

    const drawn = drawCardFromPile(game);
    if (drawn) {
      game.bot.hand.push(drawn);
      setMessage('Bot drew 1.');
    } else {
      setMessage('Bot had no move and the draw pile was empty.');
    }

    renderAll();
    setTimeout(() => endTurn(false), 400);
  }

  return {
    chooseBestSuitForBot,
    chooseBotJokerDeclaration,
    findBotPlayableCard,
    runBotTurn
  };
}
