import { getTopCard, getEffectiveRank, getEffectiveSuit, isRedSuit } from "../core/rules.js";
import { createTableUI } from "./table-ui.js";

export function createCardHTML(card, options = {}) {
  const { draggable = false, selectable = false } = options;

  const effectiveRank = getEffectiveRank(card);
  const effectiveSuit = getEffectiveSuit(card);
  const red = isRedSuit(effectiveSuit);

  const classes = ["playing-card"];
  if (selectable) classes.push("card-button");
  if (red) classes.push("red-card");
  if (card.type === "joker") classes.push("joker-card");
  if (card.type === "joker" && card.declaredAs) classes.push("joker-declared");

  const buttonTag = selectable ? "button" : "div";
  const draggableAttr = draggable ? 'draggable="true"' : "";
  const typeAttr = selectable ? 'type="button"' : "";

  if (card.type === "joker" && !card.declaredAs) {
    return `
      <${buttonTag}
        class="${classes.join(" ")}" 
        ${typeAttr}
        ${draggableAttr}
        data-id="${card.id}"
        data-rank="${card.rank}"
        data-suit="${card.suit}"
        data-type="${card.type}"
      >
        <div class="playing-card__corner playing-card__corner--top">
          <span>JK</span>
          <span>🃏</span>
        </div>
        <div class="playing-card__center joker-center">
          <img src="./assets/images/cards/joker.png" alt="Joker card symbol" class="joker-image" />
        </div>
        <div class="playing-card__corner playing-card__corner--bottom">
          <span>JK</span>
          <span>🃏</span>
        </div>
      </${buttonTag}>
    `;
  }

  return `
    <${buttonTag}
      class="${classes.join(" ")}" 
      ${typeAttr}
      ${draggableAttr}
      data-id="${card.id}"
      data-rank="${card.rank}"
      data-suit="${card.suit}"
      data-type="${card.type}"
    >
      ${card.type === "joker" && card.declaredAs ? '<span class="joker-edge-badge joker-edge-badge--top">JK</span>' : ""}
      <div class="playing-card__corner playing-card__corner--top">
        <span>${effectiveRank}</span>
        <span>${effectiveSuit}</span>
      </div>
      <div class="playing-card__center">${effectiveSuit}</div>
      <div class="playing-card__corner playing-card__corner--bottom">
        <span>${effectiveRank}</span>
        <span>${effectiveSuit}</span>
      </div>
      ${card.type === "joker" && card.declaredAs ? '<span class="joker-edge-badge joker-edge-badge--bottom">JK</span>' : ""}
    </${buttonTag}>
  `;
}

export function createRenderer({ elements, getGame, canInteract }) {
  const {
    playerHand,
    readyHand,
    botHand
  } = elements;

  const tableUI = createTableUI({
    elements,
    getGame,
    canInteract,
    createCardHTML,
    getTopCard
  });

  function renderBotHand() {
    const game = getGame();
    botHand.innerHTML = "";
    game.bot.hand.forEach(() => {
      const card = document.createElement("div");
      card.className = "mini-playing-card mini-playing-card--back";
      botHand.appendChild(card);
    });
    tableUI.setBotCardCount(game.bot.hand.length);
  }

  function renderPlayerHand() {
    const game = getGame();
    playerHand.innerHTML = game.player.hand
      .map((card) =>
        createCardHTML(card, {
          draggable: canInteract(),
          selectable: canInteract()
        })
      )
      .join("");
  }

  function renderReadyHand() {
    const game = getGame();
    const cards = game.player.readyHand;

    if (cards.length === 0) {
      readyHand.innerHTML = `<div class="ready-empty">No cards prepared yet.</div>`;
    } else {
      readyHand.innerHTML = cards
        .map((card) =>
          createCardHTML(card, {
            draggable: canInteract(),
            selectable: canInteract()
          })
        )
        .join("");
    }

    tableUI.setReadyCount(cards.length);
  }

  function renderAll() {
    renderBotHand();
    tableUI.renderDiscardPile();
    renderPlayerHand();
    renderReadyHand();
    tableUI.renderLastPlayed();
    tableUI.renderMeta();
    tableUI.updateControlState();
  }

  return {
    setMessage: tableUI.setMessage,
    renderAll,
    updateControlState: tableUI.updateControlState
  };
}
