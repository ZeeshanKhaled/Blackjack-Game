export function createChoiceUI({
  elements,
  onStateChange,
  getPendingChoice,
  setPendingChoice
}) {
  const {
    choiceOverlay,
    choiceTitle,
    choiceConfirmBtn,
    suitChoiceButtons,
    rankChoiceButtons,
    rankChoicePanel
  } = elements;

  function resetChoiceState() {
    rankChoiceButtons.forEach((btn) => btn.classList.remove("is-active"));
    suitChoiceButtons.forEach((btn) => btn.classList.remove("is-active"));
    choiceConfirmBtn.disabled = true;
  }

  function showSuitChoiceOverlay(title, onChoose) {
    setPendingChoice({
      mode: "suit",
      selectedRank: null,
      selectedSuit: null,
      onChoose
    });

    choiceTitle.textContent = title;
    rankChoicePanel.style.display = "none";
    resetChoiceState();
    choiceOverlay.classList.remove("is-hidden");
    onStateChange();
  }

  function showJokerChoiceOverlay(onChoose) {
    setPendingChoice({
      mode: "joker",
      selectedRank: null,
      selectedSuit: null,
      onChoose
    });

    choiceTitle.textContent = "Choose the Joker card";
    rankChoicePanel.style.display = "block";
    resetChoiceState();
    choiceOverlay.classList.remove("is-hidden");
    onStateChange();
  }

  function hideChoiceOverlay() {
    setPendingChoice(null);
    choiceOverlay.classList.add("is-hidden");
    rankChoicePanel.style.display = "block";
    resetChoiceState();
    onStateChange();
  }

  rankChoiceButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const pendingChoice = getPendingChoice();
      if (!pendingChoice || pendingChoice.mode !== "joker") return;

      pendingChoice.selectedRank = button.dataset.rank;
      rankChoiceButtons.forEach((btn) => btn.classList.remove("is-active"));
      button.classList.add("is-active");
      choiceConfirmBtn.disabled = !(pendingChoice.selectedRank && pendingChoice.selectedSuit);
    });
  });

  suitChoiceButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const pendingChoice = getPendingChoice();
      if (!pendingChoice) return;

      pendingChoice.selectedSuit = button.dataset.suit;
      suitChoiceButtons.forEach((btn) => btn.classList.remove("is-active"));
      button.classList.add("is-active");

      if (pendingChoice.mode === "suit") {
        choiceConfirmBtn.disabled = !pendingChoice.selectedSuit;
      } else {
        choiceConfirmBtn.disabled = !(pendingChoice.selectedRank && pendingChoice.selectedSuit);
      }
    });
  });

  choiceConfirmBtn.addEventListener("click", () => {
    const pendingChoice = getPendingChoice();
    if (!pendingChoice) return;

    const callback = pendingChoice.onChoose;

    if (pendingChoice.mode === "suit" && pendingChoice.selectedSuit) {
      const suit = pendingChoice.selectedSuit;
      hideChoiceOverlay();
      callback(suit);
      return;
    }

    if (pendingChoice.mode === "joker" && pendingChoice.selectedRank && pendingChoice.selectedSuit) {
      const declaredCard = {
        rank: pendingChoice.selectedRank,
        suit: pendingChoice.selectedSuit
      };
      hideChoiceOverlay();
      callback(declaredCard);
    }
  });

  return {
    resetChoiceState,
    showSuitChoiceOverlay,
    showJokerChoiceOverlay,
    hideChoiceOverlay
  };
}
