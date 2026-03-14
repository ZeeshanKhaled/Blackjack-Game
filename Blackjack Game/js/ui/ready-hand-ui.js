import { createHandUI } from "./hand-ui.js";

export function createReadyHandUI({
  elements,
  getGame,
  canInteract,
  onRender,
  messages,
  onCardClick
}) {
  const { playerHand, readyHand } = elements;

  let draggedCardId = null;

  const handUI = createHandUI({ getGame });
  const { findPlayerCard, getPlayerAccessibleCards } = handUI;

  function getContainerArray(containerId) {
    const game = getGame();
    return containerId === "playerHand" ? game.player.hand : game.player.readyHand;
  }


  function moveCardBetweenZones(cardId) {
    if (!canInteract()) return;

    const game = getGame();
    const found = findPlayerCard(cardId);
    if (!found) return;

    if (found.zone === "hand") {
      game.player.hand = game.player.hand.filter((card) => card.id !== cardId);
      game.player.readyHand.push(found.card);
      messages.movedToReady(found.card);
    } else {
      game.player.readyHand = game.player.readyHand.filter((card) => card.id !== cardId);
      game.player.hand.push(found.card);
      messages.returnedToHand(found.card);
    }

    onRender();
  }

  function reorderWithinContainer(containerId, draggedId, targetId) {
    const arr = getContainerArray(containerId);
    const fromIndex = arr.findIndex((card) => card.id === draggedId);
    const toIndex = arr.findIndex((card) => card.id === targetId);

    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

    const [moved] = arr.splice(fromIndex, 1);
    arr.splice(toIndex, 0, moved);
  }

  function moveAcrossContainers(fromId, toId, draggedId, beforeTargetId = null) {
    const fromArr = getContainerArray(fromId);
    const toArr = getContainerArray(toId);

    const fromIndex = fromArr.findIndex((card) => card.id === draggedId);
    if (fromIndex === -1) return;

    const [moved] = fromArr.splice(fromIndex, 1);

    if (!beforeTargetId) {
      toArr.push(moved);
      return;
    }

    const targetIndex = toArr.findIndex((card) => card.id === beforeTargetId);
    if (targetIndex === -1) {
      toArr.push(moved);
    } else {
      toArr.splice(targetIndex, 0, moved);
    }
  }

  function getDragAfterElement(container, x) {
    const cards = [...container.querySelectorAll(".card-button:not(.is-dragging)")];

    return cards.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = x - box.left - box.width / 2;

        if (offset < 0 && offset > closest.offset) {
          return { offset, element: child };
        }
        return closest;
      },
      { offset: Number.NEGATIVE_INFINITY, element: null }
    ).element;
  }


  function canReorderOwnHand() {
    const game = getGame();
    return !!(game && game.started && !game.paused && !game.over);
  }

  function clearDropZoneStyles() {
    playerHand.classList.remove("drop-zone-active");
    readyHand.classList.remove("drop-zone-active");
  }

  function bindRenderedCards() {
    document.querySelectorAll(".card-button").forEach((cardEl) => {
      const cardId = cardEl.dataset.id;

      cardEl.addEventListener("click", () => {
        if (typeof onCardClick === "function") {
          onCardClick(cardId);
          return;
        }
        moveCardBetweenZones(cardId);
      });

      cardEl.addEventListener("dragstart", () => {
        const found = findPlayerCard(cardId);
        const allowFullInteraction = canInteract();
        const allowHandReorderOnly = !!found && found.zone === "hand" && canReorderOwnHand();

        if (!allowFullInteraction && !allowHandReorderOnly) return;

        draggedCardId = cardId;
        cardEl.classList.add("is-dragging");
      });

      cardEl.addEventListener("dragend", () => {
        draggedCardId = null;
        cardEl.classList.remove("is-dragging");
        clearDropZoneStyles();
        onRender();
      });
    });
  }

  function setupDropZone(container, containerId) {
    container.addEventListener("dragover", (event) => {
      if (!draggedCardId) return;

      const found = findPlayerCard(draggedCardId);
      if (!found) return;

      const isSameZone = found.zone === (containerId === "playerHand" ? "hand" : "ready");
      const allowFullInteraction = canInteract();
      const allowHandReorderOnly =
        canReorderOwnHand() &&
        containerId === "playerHand" &&
        found.zone === "hand" &&
        isSameZone;

      if (!allowFullInteraction && !allowHandReorderOnly) return;

      event.preventDefault();
      container.classList.add("drop-zone-active");

      const afterElement = getDragAfterElement(container, event.clientX);
      const targetId = afterElement ? afterElement.dataset.id : null;

      if (isSameZone) {
        if (targetId) {
          reorderWithinContainer(containerId, draggedCardId, targetId);
        } else {
          const arr = getContainerArray(containerId);
          const fromIndex = arr.findIndex((card) => card.id === draggedCardId);
          if (fromIndex !== -1) {
            const [moved] = arr.splice(fromIndex, 1);
            arr.push(moved);
          }
        }
      } else {
        if (!allowFullInteraction) return;
        moveAcrossContainers(
          found.zone === "hand" ? "playerHand" : "readyHand",
          containerId,
          draggedCardId,
          targetId
        );
      }

      onRender();
    });

    container.addEventListener("dragleave", () => {
      container.classList.remove("drop-zone-active");
    });

    container.addEventListener("drop", () => {
      container.classList.remove("drop-zone-active");
    });
  }

  function resetDragState() {
    draggedCardId = null;
    clearDropZoneStyles();
  }

  return {
    findPlayerCard,
    getPlayerAccessibleCards,
    moveCardBetweenZones,
    bindRenderedCards,
    setupDropZone,
    resetDragState
  };
}
