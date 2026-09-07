
import { ensureAuth, getUsername, claimUsername, registerUser } from "./user.js";
import { applyNameStyle } from "./vip.js";
import { APP_VERSION, CREATOR_NAME } from "./firebase-config.js";

import {
  createRoom,
  joinRoom,
  listenRoom,
  makeMove,
  resetRoom,
  deleteRoom,
  requestRematch,
  declineRematch,
  markPlayerBanned,
  skipTurn,
  checkWinner,
  emptyBoard,
  armRoomAutoCleanup,
  TURN_SECONDS
} from "./rooms.js";

import { listenBan, isBanActive } from "./ban.js";

import { getAIMove } from "./ai.js";

import {
  recordMyResult,
  getTopStreaks,
  getUserStats,
  resetMyStreak
} from "./stats.js";

import {
  findMatch,
  listenForMatch,
  clearMatchNotification,
  cancelSearch
} from "./matchmaking.js";

import {
  getSummary,
  getNewlyUnlocked
} from "./achievements.js";

import {
  NAME_COLORS,
  RANDOM_NAME_COLOR_PRICE,
  purchaseRandomNameColor,
  equipNameColor,
  SYMBOL_COLORS,
  purchaseSymbolColor,
  equipSymbolColor
} from "./store.js";


// ============================================================
// ELEMENTOS
// ============================================================

const views = {
  menu: document.getElementById("view-menu"),
  ranking: document.getElementById("view-ranking"),
  achievements: document.getElementById("view-achievements"),
  store: document.getElementById("view-store"),
  searching: document.getElementById("view-searching"),
  waiting: document.getElementById("view-waiting"),
  game: document.getElementById("view-game")
};

const els = {
  userChip: document.getElementById("user-chip"),
  userNameLabel: document.getElementById("user-name-label"),
  userIdLabel: document.getElementById("user-id-label"),

  btnRanking: document.getElementById("btn-ranking"),
  rankingBack: document.getElementById("ranking-back"),
  rankingList: document.getElementById("ranking-list"),
  rankingEmpty: document.getElementById("ranking-empty"),

  btnAchievements: document.getElementById("btn-achievements"),
  achievementsBack: document.getElementById("achievements-back"),
  achievementsTotal: document.getElementById("achievements-total"),
  achievementsList: document.getElementById("achievements-list"),

  btnStore: document.getElementById("btn-store"),
  storeBack: document.getElementById("store-back"),
  storeCoins: document.getElementById("store-coins"),
  storeRandomPrice: document.getElementById("store-random-price"),
  storeRandomBuy: document.getElementById("store-random-buy"),
  storeNameList: document.getElementById("store-name-list"),
  storeSymbolList: document.getElementById("store-symbol-list"),

  userStreakLabel: document.getElementById("user-streak-label"),

  btnSearch: document.getElementById("btn-search"),
  btnJoin: document.getElementById("btn-join"),
  btnCreate: document.getElementById("btn-create"),
  btnAI: document.getElementById("btn-ai"),

  cancelSearch: document.getElementById("cancel-search"),

  joinPanel: document.getElementById("join-panel"),
  joinInput: document.getElementById("join-code-input"),
  joinConfirm: document.getElementById("join-confirm"),
  joinError: document.getElementById("join-error"),

  aiPanel: document.getElementById("ai-panel"),
  difficultyRow: document.getElementById("difficulty-row"),
  aiStart: document.getElementById("ai-start"),

  roomCodeDisplay: document.getElementById("room-code-display"),
  copyCode: document.getElementById("copy-code"),
  cancelWaiting: document.getElementById("cancel-waiting"),

  board: document.getElementById("board"),
  statusLine: document.getElementById("status-line"),
  nameX: document.getElementById("name-x"),
  nameO: document.getElementById("name-o"),
  streakX: document.getElementById("streak-x"),
  streakO: document.getElementById("streak-o"),
  leaveBtn: document.getElementById("leave-btn"),

  timerWrap: document.getElementById("timer-wrap"),
  timerFill: document.getElementById("timer-fill"),
  timerValue: document.getElementById("timer-value"),

  nameModal: document.getElementById("name-modal"),
  nameInput: document.getElementById("name-input"),
  nameError: document.getElementById("name-error"),
  nameSave: document.getElementById("name-save"),
  nameClose: document.getElementById("name-close"),
  ownStatsGrid: document.getElementById("own-stats-grid"),

  playerStatsModal: document.getElementById("player-stats-modal"),
  playerStatsName: document.getElementById("player-stats-name"),
  playerStatsGrid: document.getElementById("player-stats-grid"),
  playerStatsClose: document.getElementById("player-stats-close"),

  resultModal: document.getElementById("result-modal"),
  resultTitle: document.getElementById("result-title"),
  rematchAskBox: document.getElementById("rematch-ask-box"),
  rematchAskBtn: document.getElementById("rematch-ask-btn"),
  rematchWaitingText: document.getElementById("rematch-waiting-text"),
  rematchRequestBox: document.getElementById("rematch-request-box"),
  rematchRequestText: document.getElementById("rematch-request-text"),
  rematchAccept: document.getElementById("rematch-accept"),
  rematchReject: document.getElementById("rematch-reject"),
  resultLeaveBtn: document.getElementById("result-leave-btn"),

  bannedScreen: document.getElementById("banned-screen"),
  bannedReason: document.getElementById("banned-reason"),
  bannedUntil: document.getElementById("banned-until"),

  welcomeModal: document.getElementById("welcome-modal"),
  welcomeVersionNum: document.getElementById("welcome-version-num"),
  welcomeCreator: document.getElementById("welcome-creator"),
  welcomeClose: document.getElementById("welcome-close")
};


// ============================================================
// ESTADO
// ============================================================

let userId = null;
let authReady = false;

let username = getUsername();

let myStreak = 0;

let myStats = {
  wins: 0,
  losses: 0,
  draws: 0,
  streak: 0,
  bestStreak: 0,
  coins: 0,
  nameColor: "",
  unlockedColors: {},
  symbolColor: "",
  unlockedSymbolColors: {}
};

let currentRoomCode = null;
let unsubscribeRoom = null;
let mySymbol = null;
let waitingDisconnectHandle = null;
let unsubscribeMatch = null;

let streaksLoadedForCode = null;
let statsAppliedLocallyFor = null;
let xSymbolColor = "";
let oSymbolColor = "";

let aiMode = false;
let aiDifficulty = "imposible";
let aiBoard = emptyBoard();
let aiTurn = "X";
let aiTurnStartedAt = Date.now();

let timerInterval = null;

let pendingAfterNameSave = null;
let banRecheckTimeout = null;


// ============================================================
// ARRANQUE
// ============================================================

// ============================================================
// AVISO DE BIENVENIDA (sale siempre al entrar, no solo la primera vez)
// ============================================================

els.welcomeVersionNum.textContent = APP_VERSION;
els.welcomeCreator.textContent = CREATOR_NAME;
els.welcomeModal.classList.remove("hidden");

els.welcomeClose.addEventListener("click", () => {
  els.welcomeModal.classList.add("hidden");
});


bootstrap();

async function bootstrap() {

  try {

    userId = await ensureAuth();

  } catch (e) {

    console.error(
      "No se pudo iniciar sesión anónima en Firebase:",
      e
    );

    alert(
      "No se pudo conectar con Firebase. Comprueba que la autenticación " +
      "anónima esté activada en tu proyecto."
    );

    return;
  }

  authReady = true;

  els.userIdLabel.textContent =
    "ID " + userId.slice(0, 8);

  // Escucha en tiempo real por si te banean, tanto al entrar como a
  // mitad de sesión (incluso a mitad de partida).
  listenBan(userId, (ban) => {
    if (isBanActive(ban)) {
      handleOwnBan(ban);
    } else {
      hideBannedScreen();
    }
  });


  if (!username) {

    openNameModal(true);

  } else {

    els.userNameLabel.textContent = username;
    applyNameStyle(els.userNameLabel, username);

    claimUsername(userId, username).catch((e) => {
      console.warn("No se pudo reservar el nombre existente:", e.message);
    });

  }


  try {

    await registerUser(userId);

  } catch (e) {

    console.warn(
      "No se pudo registrar el usuario en Firebase:",
      e
    );

  }


  try {

    const stats = await getUserStats(userId);

    if (stats) {

      myStats = normalizeStats(stats);

      myStreak = myStats.streak;

    }

  } catch (e) {

    console.warn(
      "No se pudieron cargar las estadísticas:",
      e
    );

  }


  updateMyStreakBadge();
  applyNameStyle(els.userNameLabel, username, myStats.nameColor);
}


// ============================================================
// NORMALIZAR ESTADÍSTICAS
// ============================================================

// ============================================================
// BANEO PROPIO
// ============================================================

function handleOwnBan(ban) {

  // Si estoy en mitad de una partida online, se lo hago saber al
  // rival (la sala se marca y se borra) antes de salir yo.
  if (currentRoomCode && !aiMode) {

    const code = currentRoomCode;
    markPlayerBanned(code).catch(() => {});
    cleanupRoomWatch();
    currentRoomCode = null;
  }

  if (aiMode) {
    aiMode = false;
  }

  stopTimer();
  closeResultModal();
  els.nameModal.classList.add("hidden");
  els.playerStatsModal?.classList.add("hidden");

  showBannedScreen(ban);
}

function showBannedScreen(ban) {

  els.bannedReason.textContent =
    ban.reason || "Sin motivo especificado.";

  els.bannedUntil.textContent =
    ban.permanent || !ban.until
      ? "Permanente."
      : "Hasta " +
        new Date(ban.until).toLocaleString("es-ES", {
          dateStyle: "long",
          timeStyle: "short"
        });

  els.bannedScreen.classList.remove("hidden");

  if (banRecheckTimeout) {
    clearTimeout(banRecheckTimeout);
    banRecheckTimeout = null;
  }

  // Si es un baneo temporal, cuando toque que expire recargamos la
  // página sola para que pueda volver a jugar sin tener que hacer nada.
  if (!ban.permanent && ban.until) {
    const ms = ban.until - Date.now();
    if (ms > 0) {
      banRecheckTimeout = setTimeout(() => location.reload(), ms + 500);
    }
  }
}

function hideBannedScreen() {

  els.bannedScreen.classList.add("hidden");

  if (banRecheckTimeout) {
    clearTimeout(banRecheckTimeout);
    banRecheckTimeout = null;
  }
}


// ============================================================
// NORMALIZAR ESTADÍSTICAS
// ============================================================

function normalizeStats(stats = {}) {

  return {

    wins: Number(stats.wins) || 0,

    losses: Number(stats.losses) || 0,

    draws: Number(stats.draws) || 0,

    streak: Number(stats.streak) || 0,

    bestStreak: Number(stats.bestStreak) || 0,

    coins: Number(stats.coins) || 0,

    nameColor: typeof stats.nameColor === "string" ? stats.nameColor : "",

    unlockedColors:
      stats.unlockedColors && typeof stats.unlockedColors === "object"
        ? stats.unlockedColors
        : {},

    symbolColor: typeof stats.symbolColor === "string" ? stats.symbolColor : "",

    unlockedSymbolColors:
      stats.unlockedSymbolColors && typeof stats.unlockedSymbolColors === "object"
        ? stats.unlockedSymbolColors
        : {}

  };

}


// ============================================================
// ACTUALIZAR RACHA
// ============================================================

function updateMyStreakBadge() {

  els.userStreakLabel.textContent =
    "🔥 Racha: " + myStreak;

}


// ============================================================
// MODAL DE NOMBRE
// ============================================================

function openNameModal(forced = false) {

  els.nameInput.value = username || "";

  renderStatsGrid(els.ownStatsGrid, myStats);

  els.nameModal.classList.remove("hidden");

  els.nameModal.dataset.forced =
    forced ? "1" : "0";

  // Si aún no tiene nombre (primera vez), no puede cerrar sin ponerlo.
  els.nameClose.classList.toggle("hidden", forced);
}

els.nameClose.addEventListener("click", () => {
  els.nameModal.classList.add("hidden");
});


// ============================================================
// REJILLA DE ESTADÍSTICAS (compartida: modal propio y modal de rival)
// ============================================================

function renderStatsGrid(container, stats) {

  container.innerHTML = "";

  const wins = stats.wins || 0;
  const losses = stats.losses || 0;
  const draws = stats.draws || 0;

  const items = [
    { label: "Victorias", value: wins },
    { label: "Derrotas", value: losses },
    { label: "Empates", value: draws },
    { label: "Partidas", value: wins + losses + draws },
    { label: "Racha actual", value: stats.streak || 0 },
    { label: "Mejor racha", value: stats.bestStreak || 0 },
    { label: "Monedas", value: "🪙 " + (stats.coins || 0) }
  ];

  items.forEach((item) => {

    const cell = document.createElement("div");
    cell.className = "stat-cell";

    const val = document.createElement("span");
    val.className = "stat-value";
    val.textContent = item.value;

    const label = document.createElement("span");
    label.className = "stat-label";
    label.textContent = item.label;

    cell.appendChild(val);
    cell.appendChild(label);
    container.appendChild(cell);
  });
}


// ============================================================
// MODAL DE ESTADÍSTICAS DE UN JUGADOR (click en su nombre en partida)
// ============================================================

async function openPlayerStats(player) {

  if (!player || !player.id) return;

  els.playerStatsName.textContent = player.name || "Jugador";
  applyNameStyle(els.playerStatsName, player.name || "");

  els.playerStatsGrid.innerHTML = "";
  els.playerStatsModal.classList.remove("hidden");

  try {
    const stats = await getUserStats(player.id);
    renderStatsGrid(els.playerStatsGrid, stats);
    applyNameStyle(els.playerStatsName, player.name || "", stats.nameColor);
  } catch (e) {
    showToast("No se pudieron cargar sus estadísticas.");
  }
}

els.playerStatsClose.addEventListener(
  "click",
  () => els.playerStatsModal.classList.add("hidden")
);

// Activa/desactiva que un span de nombre (name-x / name-o) se pueda
// pulsar para abrir sus estadísticas. player = {id, name} o null
// (null = sin jugador todavía, o rival IA sin estadísticas reales).
function setPlayerNameClickable(el, player) {
  el.onclick = player ? () => openPlayerStats(player) : null;
  el.classList.toggle("clickable-name", !!player);
}


els.userChip.addEventListener(
  "click",
  () => openNameModal(false)
);


els.nameSave.addEventListener(
  "click",
  async () => {

    const val =
      els.nameInput.value.trim();

    if (!val) return;

    els.nameError.textContent = "";
    els.nameSave.disabled = true;

    try {

      const claimed = await claimUsername(userId, val);

      username = claimed;

      els.userNameLabel.textContent =
        username;

      applyNameStyle(els.userNameLabel, username, myStats.nameColor);

      els.nameModal.classList.add("hidden");

      if (userId) {

        try {

          await registerUser(userId);

        } catch (e) {

          console.warn(e);

        }

      }

      const cb = pendingAfterNameSave;
      pendingAfterNameSave = null;
      if (cb) cb();

    } catch (e) {

      els.nameError.textContent = e.message;

    } finally {

      els.nameSave.disabled = false;

    }

  }
);


// ============================================================
// NAVEGACIÓN
// ============================================================

function showView(name) {

  Object.values(views).forEach(
    (v) => v.classList.add("hidden")
  );

  views[name].classList.remove("hidden");

}


// ============================================================
// ASEGURAR NOMBRE
// ============================================================

function ensureUsername(action) {

  if (!authReady) return;

  if (!username) {

    pendingAfterNameSave = action;
    openNameModal(true);

    return;
  }

  action();

}


// ============================================================
// TOAST NORMAL
// ============================================================

function showToast(message) {

  const el =
    document.createElement("div");

  el.className = "toast";

  el.textContent = message;

  document.body.appendChild(el);


  requestAnimationFrame(
    () => el.classList.add("show")
  );


  setTimeout(() => {

    el.classList.remove("show");

    setTimeout(
      () => el.remove(),
      300
    );

  }, 2600);

}


// ============================================================
// RANKING
// ============================================================

els.btnRanking.addEventListener(
  "click",
  () => {

    showView("ranking");

    loadRanking();

  }
);


els.rankingBack.addEventListener(
  "click",
  () => showView("menu")
);


async function loadRanking() {

  els.rankingList.innerHTML = "";

  els.rankingEmpty.classList.add("hidden");


  try {

    const top =
      await getTopStreaks(50);

    const withStreak =
      top.filter(
        (u) => (u.streak || 0) > 0
      );

    const list =
      withStreak.length > 0
        ? withStreak
        : top;


    if (list.length === 0) {

      els.rankingEmpty.classList.remove(
        "hidden"
      );

      return;

    }


    list.forEach((u, i) => {

      const li =
        document.createElement("li");

      li.className =
        "ranking-row" +
        (u.id === userId ? " me" : "");


      const pos =
        document.createElement("span");

      pos.className =
        "ranking-pos";

      pos.textContent =
        "#" + (i + 1);


      const name =
        document.createElement("span");

      name.className =
        "ranking-name";

      name.textContent =
        u.name || "Jugador";

      applyNameStyle(name, u.name || "", u.nameColor || "");


      const streak =
        document.createElement("span");

      streak.className =
        "ranking-streak";

      streak.textContent =
        "🔥 " + (u.streak || 0);


      li.appendChild(pos);

      li.appendChild(name);

      li.appendChild(streak);

      els.rankingList.appendChild(li);

    });

  } catch (e) {

    console.error(e);

    showToast(
      "No se pudo cargar el ranking."
    );

  }

}


// ============================================================
// LOGROS
// ============================================================

els.btnAchievements.addEventListener(
  "click",
  async () => {

    showView("achievements");

    // Cargamos las estadísticas directamente
    // para asegurarnos de tener los datos actuales.

    try {

      const latestStats =
        await getUserStats(userId);


      if (latestStats) {

        myStats =
          normalizeStats(latestStats);

        myStreak =
          myStats.streak;

        updateMyStreakBadge();

      }

    } catch (e) {

      console.warn(
        "No se pudieron actualizar las estadísticas " +
        "de los logros:",
        e
      );

    }


    renderAchievementsView();

  }
);


els.achievementsBack.addEventListener(
  "click",
  () => showView("menu")
);


function renderAchievementsView() {

  const summary =
    getSummary(myStats);


  els.achievementsTotal.textContent =
    `${summary.totalUnlocked} / ` +
    `${summary.totalCount} logros desbloqueados`;


  els.achievementsList.innerHTML = "";


  summary.items.forEach((item) => {

    const card =
      document.createElement("div");

    card.className =
      "achievement-card" +
      (
        item.unlocked
          ? " unlocked"
          : " locked"
      );


    const head =
      document.createElement("div");

    head.className =
      "achievement-card-head";


    const icon =
      document.createElement("span");

    icon.className =
      "achievement-icon";

    icon.textContent =
      item.unlocked
        ? item.icon
        : "🔒";


    const textWrap =
      document.createElement("span");

    textWrap.className =
      "achievement-item-text";


    const title =
      document.createElement("span");

    title.className =
      "achievement-item-title";

    title.textContent =
      item.title;


    const desc =
      document.createElement("span");

    desc.className =
      "achievement-item-desc";

    desc.textContent =
      item.description;


    textWrap.appendChild(title);

    textWrap.appendChild(desc);

    head.appendChild(icon);

    head.appendChild(textWrap);

    card.appendChild(head);

    els.achievementsList.appendChild(card);

  });

}


// ============================================================
// TIENDA
// ============================================================

els.btnStore.addEventListener("click", () => {
  showView("store");
  renderStoreView();
});

els.storeBack.addEventListener("click", () => showView("menu"));

function renderStoreView() {

  els.storeCoins.textContent = "🪙 " + (myStats.coins || 0) + " monedas";

  // ---------- Color del nombre: compra sorpresa ----------

  els.storeRandomPrice.textContent = RANDOM_NAME_COLOR_PRICE + " monedas";
  els.storeRandomBuy.disabled = (myStats.coins || 0) < RANDOM_NAME_COLOR_PRICE;

  els.storeNameList.innerHTML = "";

  els.storeNameList.appendChild(
    buildEquipOnlyRow(
      { key: "", label: "Por defecto (negro)", hex: "#111111" },
      myStats.nameColor,
      (hex) => handleEquipName(hex)
    )
  );

  NAME_COLORS.filter(
    (c) => myStats.unlockedColors && myStats.unlockedColors[c.key]
  ).forEach((c) => {
    els.storeNameList.appendChild(
      buildEquipOnlyRow(c, myStats.nameColor, (hex) => handleEquipName(hex))
    );
  });

  // ---------- Color del símbolo (X / O): se elige directamente ----------

  els.storeSymbolList.innerHTML = "";

  els.storeSymbolList.appendChild(
    buildEquipOnlyRow(
      { key: "", label: "Por defecto (negro)", hex: "#111111" },
      myStats.symbolColor,
      (hex) => handleEquipSymbol(hex)
    )
  );

  SYMBOL_COLORS.forEach((item) => {
    els.storeSymbolList.appendChild(buildSymbolRow(item));
  });

}

// Fila de "solo equipar" (para colores de nombre ya comprados, y para
// la opción por defecto de ambos catálogos): sin precio, solo cambia
// cuál llevas puesto.
function buildEquipOnlyRow(item, currentHex, onEquip) {

  const row = document.createElement("div");
  row.className = "store-item";

  const swatch = document.createElement("span");
  swatch.className = "store-swatch";
  swatch.style.background = item.hex;

  const info = document.createElement("div");
  info.className = "store-info";

  const name = document.createElement("span");
  name.className = "store-name";
  name.textContent = item.label;

  const price = document.createElement("span");
  price.className = "store-price";

  const equipped = (currentHex || "") === item.hex;

  const btn = document.createElement("button");

  if (equipped) {
    price.textContent = "Equipado";
    btn.className = "btn-secondary";
    btn.textContent = "Equipado";
    btn.disabled = true;
  } else {
    price.textContent = "Lo tienes";
    btn.className = "btn-secondary";
    btn.textContent = "Equipar";
    btn.addEventListener("click", () => onEquip(item.hex));
  }

  info.appendChild(name);
  info.appendChild(price);

  row.appendChild(swatch);
  row.appendChild(info);
  row.appendChild(btn);

  return row;
}

// Fila de un color de símbolo comprable: Comprar / Equipar / Equipado.
function buildSymbolRow(item) {

  const row = document.createElement("div");
  row.className = "store-item";

  const swatch = document.createElement("span");
  swatch.className = "store-swatch";
  swatch.style.background = item.hex;

  const info = document.createElement("div");
  info.className = "store-info";

  const name = document.createElement("span");
  name.className = "store-name";
  name.textContent = item.label;

  const price = document.createElement("span");
  price.className = "store-price";

  const owned = !!(
    myStats.unlockedSymbolColors &&
    myStats.unlockedSymbolColors[item.key]
  );
  const equipped = (myStats.symbolColor || "") === item.hex;

  const btn = document.createElement("button");

  if (equipped) {

    price.textContent = "Equipado";
    btn.className = "btn-secondary";
    btn.textContent = "Equipado";
    btn.disabled = true;

  } else if (owned) {

    price.textContent = "Ya lo tienes";
    btn.className = "btn-secondary";
    btn.textContent = "Equipar";
    btn.addEventListener("click", () => handleEquipSymbol(item.hex));

  } else {

    price.textContent = item.price + " monedas";
    btn.className = "btn-primary";
    btn.textContent = "Comprar";
    btn.disabled = (myStats.coins || 0) < item.price;
    btn.addEventListener("click", () => handlePurchaseSymbol(item));

  }

  info.appendChild(name);
  info.appendChild(price);

  row.appendChild(swatch);
  row.appendChild(info);
  row.appendChild(btn);

  return row;
}

els.storeRandomBuy.addEventListener("click", handleRandomNamePurchase);

async function handleRandomNamePurchase() {
  try {
    const picked = await purchaseRandomNameColor(userId);
    myStats = normalizeStats({
      ...myStats,
      coins: (myStats.coins || 0) - RANDOM_NAME_COLOR_PRICE,
      nameColor: picked.hex,
      unlockedColors: {
        ...(myStats.unlockedColors || {}),
        [picked.key]: true
      }
    });
    applyNameStyle(els.userNameLabel, username, myStats.nameColor);
    showToast("¡Te ha tocado " + picked.label + "!");
    renderStoreView();
  } catch (e) {
    showToast(e.message || "No se pudo comprar.");
  }
}

async function handleEquipName(hex) {
  try {
    await equipNameColor(userId, hex);
    myStats = normalizeStats({ ...myStats, nameColor: hex });
    applyNameStyle(els.userNameLabel, username, myStats.nameColor);
    renderStoreView();
  } catch (e) {
    showToast(e.message || "No se pudo equipar.");
  }
}

async function handlePurchaseSymbol(item) {
  try {
    await purchaseSymbolColor(userId, item.key);
    myStats = normalizeStats({
      ...myStats,
      coins: (myStats.coins || 0) - item.price,
      symbolColor: item.hex,
      unlockedSymbolColors: {
        ...(myStats.unlockedSymbolColors || {}),
        [item.key]: true
      }
    });
    renderStoreView();
  } catch (e) {
    showToast(e.message || "No se pudo comprar.");
  }
}

async function handleEquipSymbol(hex) {
  try {
    await equipSymbolColor(userId, hex);
    myStats = normalizeStats({ ...myStats, symbolColor: hex });
    renderStoreView();
  } catch (e) {
    showToast(e.message || "No se pudo equipar.");
  }
}


// ============================================================
// NOTIFICACIONES DE LOGROS
// ============================================================

let achievementQueue = [];

let achievementShowing = false;


function queueAchievementToast(
  achievement
) {

  achievementQueue.push(
    achievement
  );

  processAchievementQueue();

}


function processAchievementQueue() {

  if (
    achievementShowing ||
    achievementQueue.length === 0
  ) {

    return;

  }


  achievementShowing = true;

  const a =
    achievementQueue.shift();


  const el =
    document.createElement("div");

  el.className =
    "achievement-toast";


  const icon =
    document.createElement("span");

  icon.className =
    "achievement-toast-icon";

  icon.textContent =
    a.icon;


  const textWrap =
    document.createElement("span");

  textWrap.className =
    "achievement-toast-text";


  const kicker =
    document.createElement("span");

  kicker.className =
    "achievement-toast-kicker";

  kicker.textContent =
    "Logro desbloqueado";


  const title =
    document.createElement("span");

  title.className =
    "achievement-toast-title";

  title.textContent =
    a.title;


  textWrap.appendChild(kicker);

  textWrap.appendChild(title);

  el.appendChild(icon);

  el.appendChild(textWrap);

  document.body.appendChild(el);


  requestAnimationFrame(
    () => el.classList.add("show")
  );


  setTimeout(() => {

    el.classList.remove("show");


    setTimeout(() => {

      el.remove();

      achievementShowing = false;

      processAchievementQueue();

    }, 300);

  }, 3200);

}


// ============================================================
// BOTONES DEL MENÚ
// ============================================================

els.btnJoin.addEventListener(
  "click",
  () => {

    els.aiPanel.classList.add("hidden");

    els.joinPanel.classList.toggle(
      "hidden"
    );

    els.joinInput.focus();

  }
);


els.btnAI.addEventListener(
  "click",
  () => {

    els.joinPanel.classList.add("hidden");

    els.aiPanel.classList.toggle(
      "hidden"
    );

  }
);


els.difficultyRow.addEventListener(
  "click",
  (e) => {

    const btn =
      e.target.closest(".pill");

    if (!btn) return;


    [...els.difficultyRow.children]
      .forEach(
        (p) =>
          p.classList.remove("active")
      );


    btn.classList.add("active");

    aiDifficulty =
      btn.dataset.diff;

  }
);


els.aiStart.addEventListener(
  "click",
  () => startAIGame()
);


// ============================================================
// CREAR SALA
// ============================================================

els.btnCreate.addEventListener(
  "click",
  () => {

    ensureUsername(async () => {

      els.btnCreate.disabled = true;


      try {

        const code =
          await createRoom(
            userId,
            username
          );


        currentRoomCode = code;

        els.roomCodeDisplay.textContent =
          code;


        waitingDisconnectHandle =
          armRoomAutoCleanup(code);


        showView("waiting");

        watchRoom(code);


      } catch (e) {

        alert(
          "No se pudo crear la sala: " +
          e.message
        );

      } finally {

        els.btnCreate.disabled = false;

      }

    });

  }
);


// ============================================================
// UNIRSE A SALA
// ============================================================

els.joinConfirm.addEventListener(
  "click",
  () => {

    ensureUsername(async () => {

      const code =
        els.joinInput.value.trim();


      if (!code) return;


      els.joinError.textContent = "";


      try {

        const finalCode =
          await joinRoom(
            code,
            userId,
            username
          );


        currentRoomCode =
          finalCode;


        watchRoom(finalCode);


      } catch (e) {

        els.joinError.textContent =
          e.message;

      }

    });

  }
);


// ============================================================
// CANCELAR ESPERA
// ============================================================

els.cancelWaiting.addEventListener(
  "click",
  async () => {

    if (waitingDisconnectHandle) {

      waitingDisconnectHandle
        .cancel()
        .catch(() => {});

      waitingDisconnectHandle = null;

    }


    const code =
      currentRoomCode;


    cleanupRoomWatch();

    currentRoomCode = null;

    showView("menu");


    if (code) {

      deleteRoom(code)
        .catch(() => {});

    }

  }
);


// ============================================================
// COPIAR CÓDIGO
// ============================================================

els.copyCode.addEventListener(
  "click",
  () => {

    navigator.clipboard
      .writeText(
        els.roomCodeDisplay.textContent
      )
      .then(() => {

        els.copyCode.textContent =
          "¡Copiado!";


        setTimeout(
          () =>
            (els.copyCode.textContent =
              "Copiar código"),
          1500
        );

      });

  }
);


// ============================================================
// MATCHMAKING
// ============================================================

els.btnSearch.addEventListener(
  "click",
  () => {

    ensureUsername(
      () => startSearch()
    );

  }
);


async function startSearch() {

  els.joinPanel.classList.add("hidden");

  els.aiPanel.classList.add("hidden");

  showView("searching");


  try {

    const res =
      await findMatch(
        userId,
        username
      );


    if (res.status === "matched") {

      currentRoomCode =
        res.code;

      watchRoom(res.code);


    } else {

      unsubscribeMatch =
        listenForMatch(
          userId,
          async (match) => {

            if (unsubscribeMatch) {

              unsubscribeMatch();

              unsubscribeMatch = null;

            }


            await clearMatchNotification(
              userId
            ).catch(() => {});


            currentRoomCode =
              match.code;


            watchRoom(match.code);

          }
        );

    }

  } catch (e) {

    showToast(
      "No se pudo buscar partida."
    );

    showView("menu");

  }

}


els.cancelSearch.addEventListener(
  "click",
  async () => {

    if (unsubscribeMatch) {

      unsubscribeMatch();

      unsubscribeMatch = null;

    }


    await cancelSearch(userId)
      .catch(() => {});


    showView("menu");

  }
);


// ============================================================
// TEMPORIZADOR
// ============================================================

function stopTimer() {

  if (timerInterval) {

    clearInterval(timerInterval);

    timerInterval = null;

  }

}


function hideTimer() {

  stopTimer();

  els.timerWrap.style.visibility =
    "hidden";

}


function updateTimerUI(
  remaining
) {

  const pct =
    Math.max(
      0,
      Math.min(
        100,
        (remaining / TURN_SECONDS) *
          100
      )
    );


  els.timerFill.style.width =
    pct + "%";


  els.timerValue.textContent =
    Math.ceil(remaining) + "s";


  els.timerFill.classList.toggle(
    "warn",
    remaining <= 5
  );

}


function startTimerFor(
  startedAt,
  isMine,
  onExpire
) {

  stopTimer();

  els.timerWrap.style.visibility =
    "visible";


  function tick() {

    const elapsed =
      (
        Date.now() -
        (startedAt || Date.now())
      ) / 1000;


    const remaining =
      Math.max(
        0,
        TURN_SECONDS - elapsed
      );


    updateTimerUI(
      remaining
    );


    if (remaining <= 0) {

      stopTimer();


      if (isMine) {

        onExpire();

      }

    }

  }


  tick();

  timerInterval =
    setInterval(
      tick,
      250
    );

}


// ============================================================
// MODAL DE RESULTADO
// ============================================================

function setResultTitle(
  text,
  kind
) {

  els.resultTitle.textContent =
    text;


  els.resultTitle.classList.remove(
    "win",
    "lose"
  );


  if (kind) {

    els.resultTitle.classList.add(
      kind
    );

  }

}


function closeResultModal() {

  els.resultModal.classList.add(
    "hidden"
  );

}


function openResultModalOnline(
  room,
  code
) {

  const isDraw =
    room.winner === "draw";


  const iWon =
    room.winner === mySymbol;


  setResultTitle(

    isDraw
      ? "Empate"
      : iWon
        ? "¡Has ganado!"
        : "Has perdido",

    isDraw
      ? ""
      : iWon
        ? "win"
        : "lose"

  );


  const requestedBy =
    room.rematchRequestedBy;


  if (!requestedBy) {

    els.rematchAskBox.classList.remove(
      "hidden"
    );

    els.rematchRequestBox.classList.add(
      "hidden"
    );

    els.rematchAskBtn.classList.remove(
      "hidden"
    );

    els.rematchWaitingText.classList.add(
      "hidden"
    );


    els.rematchAskBtn.onclick =
      () =>
        requestRematch(
          code,
          mySymbol
        );


  } else if (
    requestedBy === mySymbol
  ) {

    els.rematchAskBox.classList.remove(
      "hidden"
    );

    els.rematchRequestBox.classList.add(
      "hidden"
    );

    els.rematchAskBtn.classList.add(
      "hidden"
    );

    els.rematchWaitingText.classList.remove(
      "hidden"
    );


  } else {

    els.rematchAskBox.classList.add(
      "hidden"
    );

    els.rematchRequestBox.classList.remove(
      "hidden"
    );


    els.rematchAccept.onclick =
      () => resetRoom(code);


    els.rematchReject.onclick =
      () => declineRematch(code);

  }


  els.resultLeaveBtn.onclick =
    () => {

      closeResultModal();

      stopTimer();


      const c =
        currentRoomCode;


      cleanupRoomWatch();

      currentRoomCode = null;


      showView("menu");


      if (c) {

        deleteRoom(c)
          .catch(() => {});

      }

    };


  els.resultModal.classList.remove(
    "hidden"
  );

}


function openResultModalAI(
  winInfo,
  isDraw
) {

  setResultTitle(

    isDraw
      ? "Empate"
      : winInfo.winner === "X"
        ? "¡Has ganado!"
        : "Has perdido",

    isDraw
      ? ""
      : winInfo.winner === "X"
        ? "win"
        : "lose"

  );


  els.rematchAskBox.classList.remove(
    "hidden"
  );

  els.rematchRequestBox.classList.add(
    "hidden"
  );

  els.rematchAskBtn.classList.remove(
    "hidden"
  );

  els.rematchWaitingText.classList.add(
    "hidden"
  );


  els.rematchAskBtn.onclick =
    () => {

      closeResultModal();

      startAIGame();

    };


  els.resultLeaveBtn.onclick =
    () => {

      closeResultModal();

      aiMode = false;

      stopTimer();

      showView("menu");

    };


  els.resultModal.classList.remove(
    "hidden"
  );

}


// ============================================================
// SALA ONLINE
// ============================================================

function cleanupRoomWatch() {

  if (unsubscribeRoom) {

    unsubscribeRoom();

    unsubscribeRoom = null;

  }


  hideTimer();

  closeResultModal();


  streaksLoadedForCode = null;

  statsAppliedLocallyFor = null;

  xSymbolColor = "";

  oSymbolColor = "";

}


function handleRoomGone() {

  stopTimer();

  closeResultModal();

  cleanupRoomWatch();


  if (currentRoomCode) {

    showToast(
      "Tu rival ha salido de la partida."
    );

  }


  currentRoomCode = null;


  if (!aiMode) {

    showView("menu");

  }

}


function watchRoom(code) {

  cleanupRoomWatch();


  unsubscribeRoom =
    listenRoom(
      code,
      (room) => {

        if (!room) {

          handleRoomGone();

          return;

        }


        if (room.status === "declined") {

          showToast(
            "La revancha no se ha aceptado."
          );


          closeResultModal();


          const codeToClean =
            currentRoomCode;


          cleanupRoomWatch();

          currentRoomCode = null;


          showView("menu");


          setTimeout(() => {

            if (codeToClean) {

              deleteRoom(
                codeToClean
              ).catch(() => {});

            }

          }, 800);


          return;

        }


        if (room.status === "player-banned") {

          showToast(
            "El jugador ha sido baneado."
          );


          closeResultModal();


          const codeToClean =
            currentRoomCode;


          cleanupRoomWatch();

          currentRoomCode = null;


          showView("menu");


          setTimeout(() => {

            if (codeToClean) {

              deleteRoom(
                codeToClean
              ).catch(() => {});

            }

          }, 800);


          return;

        }


        if (
          room.playerX &&
          room.playerX.id === userId
        ) {

          mySymbol = "X";

        } else if (
          room.playerO &&
          room.playerO.id === userId
        ) {

          mySymbol = "O";

        }


        if (
          room.status === "waiting"
        ) {

          showView("waiting");

          return;

        }


        if (waitingDisconnectHandle) {

          waitingDisconnectHandle
            .cancel()
            .catch(() => {});

          waitingDisconnectHandle = null;

        }


        showView("game");


        maybeLoadStreaks(
          code,
          room
        );


        renderOnlineRoom(
          room,
          code
        );

      }
    );

}


// ============================================================
// CARGAR RACHAS DE LOS JUGADORES
// ============================================================

async function maybeLoadStreaks(
  code,
  room
) {

  if (
    streaksLoadedForCode === code
  ) {

    return;

  }


  if (
    !room.playerX ||
    !room.playerO
  ) {

    return;

  }


  streaksLoadedForCode = code;


  try {

    const [
      statsX,
      statsO
    ] = await Promise.all([

      getUserStats(
        room.playerX.id
      ),

      getUserStats(
        room.playerO.id
      )

    ]);


    els.streakX.textContent =
      statsX.streak > 0
        ? `🔥 Racha ${statsX.streak}`
        : "";


    els.streakO.textContent =
      statsO.streak > 0
        ? `🔥 Racha ${statsO.streak}`
        : "";


    applyNameStyle(els.nameX, room.playerX.name, statsX.nameColor);
    applyNameStyle(els.nameO, room.playerO.name, statsO.nameColor);


    xSymbolColor = statsX.symbolColor || "";
    oSymbolColor = statsO.symbolColor || "";

    // El tablero ya se pintó una vez sin estos colores (esta consulta
    // es asíncrona); lo volvemos a pintar ahora que ya los tenemos.
    renderOnlineRoom(room, code);


  } catch (e) {

    // Si falla, simplemente no se muestran las rachas ni los colores.

  }

}


// ============================================================
// RENDER DE SALA ONLINE
// ============================================================

function renderOnlineRoom(
  room,
  code
) {

  els.nameX.textContent =
    room.playerX
      ? room.playerX.name
      : "—";

  applyNameStyle(els.nameX, room.playerX ? room.playerX.name : "");
  setPlayerNameClickable(els.nameX, room.playerX || null);


  els.nameO.textContent =
    room.playerO
      ? room.playerO.name
      : "—";

  applyNameStyle(els.nameO, room.playerO ? room.playerO.name : "");
  setPlayerNameClickable(els.nameO, room.playerO || null);


  const finished =
    !!room.winner;


  const winInfo =
    finished
      ? checkWinner(room.board)
      : null;


  renderBoard(

    room.board,

    winInfo
      ? winInfo.line
      : room.winningLine || null,

    finished,

    (index) => {

      if (room.winner) return;

      if (room.turn !== mySymbol) return;

      makeMove(
        code,
        index,
        mySymbol
      );

    },

    xSymbolColor,
    oSymbolColor

  );


  // ==========================================================
  // PARTIDA TERMINADA
  // ==========================================================

  if (finished) {

    hideTimer();


    // Cada cliente registra únicamente su resultado.

    if (
      statsAppliedLocallyFor !== code
    ) {

      statsAppliedLocallyFor = code;


      const outcome =
        room.winner === "draw"
          ? "draw"
          : room.winner === mySymbol
            ? "win"
            : "loss";


      recordMyResult(
        userId,
        outcome
      )

        .then(async (updated) => {

          if (!updated) {

            console.warn(
              "recordMyResult no devolvió estadísticas."
            );

            return;

          }


          // ==================================================
          // ESTADÍSTICAS NUEVAS
          // ==================================================

          const newStats =
            normalizeStats(updated);


          // ==================================================
          // COMPROBAR LOGROS
          // ==================================================

          const newlyUnlocked =
            getNewlyUnlocked(
              myStats,
              newStats
            );


          // ==================================================
          // ACTUALIZAR ESTADO LOCAL
          // ==================================================

          myStats =
            newStats;


          myStreak =
            newStats.streak;


          updateMyStreakBadge();


          // ==================================================
          // ACTUALIZAR LA PANTALLA DE LOGROS
          // ==================================================

          renderAchievementsView();


          // ==================================================
          // MOSTRAR NOTIFICACIONES
          // ==================================================

          newlyUnlocked.forEach(
            (achievement) => {

              queueAchievementToast(
                achievement
              );

            }
          );


          // ==================================================
          // VOLVER A COMPROBAR FIREBASE
          // ==================================================
          // Esto evita que la UI se quede con estadísticas
          // antiguas si Firebase tarda un poco en actualizar.

          try {

            const firebaseStats =
              await getUserStats(
                userId
              );


            if (firebaseStats) {

              myStats =
                normalizeStats(
                  firebaseStats
                );


              myStreak =
                myStats.streak;


              updateMyStreakBadge();


              renderAchievementsView();

            }

          } catch (e) {

            console.warn(
              "No se pudieron verificar las estadísticas " +
              "actualizadas:",
              e
            );

          }

        })

        .catch((e) => {

          console.warn(
            "No se pudo actualizar la racha:",
            e
          );

        });

    }


    els.statusLine.textContent =

      room.winner === "draw"
        ? "Empate."
        : room.winner === mySymbol
          ? "¡Has ganado!"
          : "Has perdido.";


    openResultModalOnline(
      room,
      code
    );


  } else {

    closeResultModal();


    const myTurn =
      room.turn === mySymbol;


    els.statusLine.textContent =
      myTurn
        ? "Tu turno"
        : "Turno del rival";


    startTimerFor(

      room.turnStartedAt,

      myTurn,

      () =>
        skipTurn(
          code,
          mySymbol
        )

    );

  }

}


// ============================================================
// SALIR DE PARTIDA
// ============================================================

els.leaveBtn.addEventListener(
  "click",
  () => {

    stopTimer();

    closeResultModal();


    if (aiMode) {

      aiMode = false;

      showView("menu");

      return;

    }


    resetMyStreak(
      userId
    ).catch(() => {});


    myStats = {

      ...myStats,

      streak: 0

    };


    myStreak = 0;

    updateMyStreakBadge();


    const code =
      currentRoomCode;


    cleanupRoomWatch();

    currentRoomCode = null;

    showView("menu");


    if (code) {

      deleteRoom(code)
        .catch(() => {});

    }

  }
);


// ============================================================
// MODO IA
// ============================================================

function startAIGame() {

  aiMode = true;

  currentRoomCode = null;

  cleanupRoomWatch();


  aiBoard =
    emptyBoard();


  aiTurn = "X";

  aiTurnStartedAt =
    Date.now();


  mySymbol = "X";


  els.nameX.textContent =
    username || "Tú";

  applyNameStyle(els.nameX, username, myStats.nameColor);
  setPlayerNameClickable(els.nameX, userId ? { id: userId, name: username } : null);


  els.nameO.textContent =
    "IA (" +
    labelDifficulty(aiDifficulty) +
    ")";

  applyNameStyle(els.nameO, "");
  setPlayerNameClickable(els.nameO, null);


  els.streakX.textContent = "";

  els.streakO.textContent = "";


  showView("game");

  renderAIBoard();

}


function labelDifficulty(d) {

  return {

    facil: "fácil",

    normal: "normal",

    imposible: "imposible"

  }[d] || d;

}


// ============================================================
// RENDER IA
// ============================================================

function renderAIBoard() {

  const winInfo =
    checkWinner(aiBoard);


  const full =
    aiBoard.every(
      (c) => c !== ""
    );


  renderBoard(

    aiBoard,

    winInfo
      ? winInfo.line
      : null,

    !!winInfo || full,

    (index) => {

      if (winInfo || full) return;

      if (aiTurn !== "X") return;

      handleHumanMove(index);

    },

    myStats.symbolColor,
    ""

  );


  if (winInfo || full) {

    hideTimer();


    els.statusLine.textContent =

      winInfo
        ? winInfo.winner === "X"
          ? "¡Has ganado!"
          : "Ha ganado la IA."
        : "Empate.";


    openResultModalAI(
      winInfo,
      !winInfo
    );


  } else if (
    aiTurn === "X"
  ) {

    closeResultModal();

    els.statusLine.textContent =
      "Tu turno";


    startTimerFor(

      aiTurnStartedAt,

      true,

      handleHumanTimeout

    );


  } else {

    closeResultModal();

    els.statusLine.textContent =
      "Pensando...";

    hideTimer();

  }

}


// ============================================================
// MOVIMIENTO HUMANO IA
// ============================================================

function handleHumanMove(index) {

  if (
    aiBoard[index] !== ""
  ) {

    return;

  }


  aiBoard[index] = "X";

  aiTurn = "O";


  renderAIBoard();

  proceedAfterHumanTurn();

}


// ============================================================
// TIMEOUT HUMANO
// ============================================================

function handleHumanTimeout() {

  if (
    aiTurn !== "X"
  ) {

    return;

  }


  aiTurn = "O";

  renderAIBoard();

  proceedAfterHumanTurn();

}


// ============================================================
// TURNO IA
// ============================================================

function proceedAfterHumanTurn() {

  const winInfo =
    checkWinner(aiBoard);


  const full =
    aiBoard.every(
      (c) => c !== ""
    );


  if (
    winInfo ||
    full
  ) {

    return;

  }


  setTimeout(() => {

    const move =
      getAIMove(
        aiBoard,
        "O",
        "X",
        aiDifficulty
      );


    if (
      move !== null
    ) {

      aiBoard[move] =
        "O";

    }


    aiTurn = "X";

    aiTurnStartedAt =
      Date.now();


    renderAIBoard();

  }, 350);

}


// ============================================================
// RENDER DEL TABLERO
// ============================================================

function renderBoard(
  board,
  winningLine,
  locked,
  onCellClick,
  xColor,
  oColor
) {

  els.board.innerHTML = "";


  board.forEach(
    (value, index) => {

      const btn =
        document.createElement(
          "button"
        );


      const classes =
        ["cell"];


      if (value) {

        classes.push(
          "filled"
        );

      }


      const isWinCell =
        winningLine &&
        winningLine.includes(index);

      if (isWinCell) {

        classes.push(
          "win"
        );

      }


      btn.className =
        classes.join(" ");


      btn.textContent =
        value || "";


      // El color personalizado no se aplica en las casillas ganadoras:
      // ahí manda el estilo de "ganada" (fondo negro, texto blanco)
      // para que siga siendo legible.
      if (!isWinCell) {

        if (value === "X" && xColor) {

          btn.style.color = xColor;

        } else if (value === "O" && oColor) {

          btn.style.color = oColor;

        }

      }


      btn.disabled =
        !!value ||
        locked;


      btn.addEventListener(
        "click",
        () =>
          onCellClick(index)
      );


      els.board.appendChild(
        btn
      );

    }
  );

}