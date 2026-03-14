const tablesGrid = document.getElementById("tablesGrid");
const tableCardTemplate = document.getElementById("tableCardTemplate");

const tableCards = {
  "bot-table": { rank: "A", suit: "♠" },
  "private-room": { rank: "A", suit: "♦" },
  "silver-table": { rank: "Q", suit: "♥" },
  "gold-table": { rank: "K", suit: "♦" },
  "crown-table": { rank: "J", suit: "♣" }
};

async function loadTables() {
  try {
    const response = await fetch("./data/tables.json");
    if (!response.ok) {
      throw new Error("Failed to load tables.");
    }

    const tables = await response.json();
    renderTables(tables);
  } catch (error) {
    tablesGrid.innerHTML = `
      <div class="table-card table-card--locked theme-silver">
        <div>
          <h3 class="table-card__title">Error</h3>
          <p class="table-card__description">Could not load the tables data.</p>
        </div>
      </div>
    `;
    console.error(error);
  }
}

function formatBuyIn(amount) {
  if (amount === 0) return "Free";
  return `${amount.toLocaleString()} Coins`;
}

function createStatusBadge(isLocked) {
  const badge = document.createElement("span");
  badge.className = `badge ${isLocked ? "badge-locked" : "badge-open"}`;
  badge.textContent = isLocked ? "Locked" : "Open";
  return badge;
}

function createButton(table) {
  const button = document.createElement("button");
  button.classList.add("table-card__button");

  if (table.locked) {
    button.classList.add("button-locked");
    button.textContent = "Locked";
    button.disabled = true;
  } else {
    button.classList.add("button-primary");
    button.textContent = "Play";
    button.addEventListener("click", () => {
      window.location.href = table.page;
    });
  }

  return button;
}

function renderTables(tables) {
  tablesGrid.innerHTML = "";

  tables.forEach((table) => {
    const fragment = tableCardTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".table-card");
    const subtitle = fragment.querySelector(".table-card__subtitle");
    const title = fragment.querySelector(".table-card__title");
    const description = fragment.querySelector(".table-card__description");
    const status = fragment.querySelector(".table-card__status");
    const buyIn = fragment.querySelector(".table-card__buyin");
    const buttonWrap = fragment.querySelector(".table-card__button");

    const cornerRanks = fragment.querySelectorAll(".table-card__corner-rank");
    const cornerSuits = fragment.querySelectorAll(".table-card__corner-suit");

    card.classList.add(table.theme);

    if (table.locked) {
      card.classList.add("table-card--locked");
    }

    subtitle.textContent = table.subtitle;
    title.textContent = table.name;
    description.textContent = table.description;
    buyIn.textContent = formatBuyIn(table.buyIn);

    const faceCard = tableCards[table.id] || { rank: "A", suit: "♠" };

    cornerRanks.forEach((node) => {
      node.textContent = faceCard.rank;
    });

    cornerSuits.forEach((node) => {
      node.textContent = faceCard.suit;
    });

    status.replaceWith(createStatusBadge(table.locked));
    buttonWrap.replaceWith(createButton(table));

    tablesGrid.appendChild(fragment);
  });
}

loadTables();