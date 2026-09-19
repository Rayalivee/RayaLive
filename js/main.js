
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
  TURN_SECONDS,
  getModeConfig,
  getCurrentTurnPlayer,
  buildTurnOrder
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
  cancelSearch,
  MODE_PLAYERS,
  startLobbyGame
} from "./matchmaking.js";

import {
  getSummary,
  getNewlyUnlocked
} from "./achievements.js";

import {
  listenNews,
  createNews,
  deleteNews,
  canManageNews,
  markAllSeen,
  countUnread,
  isUnread
} from "./news.js";

import {
  listenTournaments,
  listenTournament,
  createTournament,
  updateTournament,
  deleteTournament,
  joinTournament,
  leaveTournament,
  setPlayerScore,
  canManageTournaments,
  getLeaderboard,
  playerCount,
  isJoined,
  canJoin,
  formatTournamentDate,
  TOURNAMENT_STATUSES,
  findTournamentMatch,
  listenTournamentMatch,
  clearTournamentMatch,
  cancelTournamentQueue,
  recordTournamentResult,
  recordMyTournamentResult,
  maybeAutoFinishTournament,
  isTournamentClosed,
  assertNotPenalized,
  getPenalty,
  penalizeTournamentAbandon,
  markRoomAbandoned,
  TOURNAMENT_ABANDON_BAN_MS
} from "./tournaments.js";

import {
  listenFriends,
  listenFriendRequests,
  sendFriendRequest,
  findUserIdByName,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend
} from "./friends.js";

import {
  PARTY_MODES,
  createLobby,
  listenLobby,
  listenLobbyInvites,
  inviteToLobby,
  acceptLobbyInvite,
  declineLobbyInvite,
  leaveLobby,
  setLobbyMode,
  memberList,
  requestLobbyPlay,
  clearLobbyPlaySignal,
  requestLobbyCancel,
  confirmLobbyCancel,
  rejectLobbyCancel
} from "./lobbies.js";

import {
  NAME_COLORS,
  RANDOM_NAME_COLOR_PRICE,
  purchaseRandomNameColor,
  equipNameColor,
  SYMBOL_COLORS,
  purchaseSymbolColor,
  equipSymbolColor
} from "./store.js";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

const views = {
  menu: document.getElementById("view-menu"),
  ranking: document.getElementById("view-ranking"),
  achievements: document.getElementById("view-achievements"),
  store: document.getElementById("view-store"),
  inventory: document.getElementById("view-inventory"),
  modeSelect: document.getElementById("view-mode-select"),
  news: document.getElementById("view-news"),
  friends: document.getElementById("view-friends"),
  partyLobby: document.getElementById("view-party-lobby"),
  tournaments: document.getElementById("view-tournaments"),
  tournamentDetail: document.getElementById("view-tournament-detail"),
  searching: document.getElementById("view-searching"),
  waiting: document.getElementById("view-waiting"),
  lobby: document.getElementById("view-lobby"),
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

  btnFriends: document.getElementById("btn-friends"),
  friendsBack: document.getElementById("friends-back"),
  friendsBadge: document.getElementById("friends-badge"),
  friendNameInput: document.getElementById("friend-name-input"),
  friendAddBtn: document.getElementById("friend-add-btn"),
  friendAddError: document.getElementById("friend-add-error"),
  friendRequestsList: document.getElementById("friend-requests-list"),
  friendRequestsEmpty: document.getElementById("friend-requests-empty"),
  friendsList: document.getElementById("friends-list"),
  friendsEmpty: document.getElementById("friends-empty"),
  btnCreateLobby: document.getElementById("btn-create-lobby"),
  partyLobbyBack: document.getElementById("party-lobby-back"),
  partyLobbyMeta: document.getElementById("party-lobby-meta"),
  partyModeRow: document.getElementById("party-mode-row"),
  partyMembers: document.getElementById("party-members"),
  partyInviteList: document.getElementById("party-invite-list"),
  partyInviteEmpty: document.getElementById("party-invite-empty"),
  partyLobbyError: document.getElementById("party-lobby-error"),
  partyPlayBtn: document.getElementById("party-play-btn"),
  partyLeaveBtn: document.getElementById("party-leave-btn"),
  partyBar: document.getElementById("party-bar"),
  partyBarMode: document.getElementById("party-bar-mode"),
  partyBarMembers: document.getElementById("party-bar-members"),
  partyBarOpen: document.getElementById("party-bar-open"),
  tTeamBased: document.getElementById("t-team-based"),

  btnTournaments: document.getElementById("btn-tournaments"),
  tournamentsBack: document.getElementById("tournaments-back"),
  tournamentAdmin: document.getElementById("tournament-admin"),
  tournamentsList: document.getElementById("tournaments-list"),
  tournamentsEmpty: document.getElementById("tournaments-empty"),
  tTitle: document.getElementById("t-title"),
  tDesc: document.getElementById("t-desc"),
  tPrize: document.getElementById("t-prize"),
  tStart: document.getElementById("t-start"),
  tEnd: document.getElementById("t-end"),
  tMinWins: document.getElementById("t-min-wins"),
  tMinStreak: document.getElementById("t-min-streak"),
  tMax: document.getElementById("t-max"),
  tMode: document.getElementById("t-mode"),
  tStatus: document.getElementById("t-status"),
  tFormError: document.getElementById("t-form-error"),
  tCreate: document.getElementById("t-create"),

  tdTitle: document.getElementById("td-title"),
  tdBack: document.getElementById("td-back"),
  tdMeta: document.getElementById("td-meta"),
  tdDesc: document.getElementById("td-desc"),
  tdPrize: document.getElementById("td-prize"),
  tdReqs: document.getElementById("td-reqs"),
  tdActions: document.getElementById("td-actions"),
  tdError: document.getElementById("td-error"),
  tdLeaderboard: document.getElementById("td-leaderboard"),
  tdLbEmpty: document.getElementById("td-lb-empty"),
  tdAdmin: document.getElementById("td-admin"),
  tdStatusSelect: document.getElementById("td-status-select"),
  tdSaveStatus: document.getElementById("td-save-status"),
  tdDelete: document.getElementById("td-delete"),
  tdScorePlayer: document.getElementById("td-score-player"),
  tdScorePoints: document.getElementById("td-score-points"),
  tdScoreWins: document.getElementById("td-score-wins"),
  tdScoreLosses: document.getElementById("td-score-losses"),
  tdSaveScore: document.getElementById("td-save-score"),

  btnNews: document.getElementById("btn-news"),
  newsBack: document.getElementById("news-back"),
  newsBadge: document.getElementById("news-badge"),
  newsAdmin: document.getElementById("news-admin"),
  newsTitleInput: document.getElementById("news-title-input"),
  newsBodyInput: document.getElementById("news-body-input"),
  newsFormError: document.getElementById("news-form-error"),
  newsPublish: document.getElementById("news-publish"),
  newsList: document.getElementById("news-list"),
  newsEmpty: document.getElementById("news-empty"),

  btnAchievements: document.getElementById("btn-achievements"),
  achievementsBack: document.getElementById("achievements-back"),
  achievementsTotal: document.getElementById("achievements-total"),
  achievementsList: document.getElementById("achievements-list"),

  btnStore: document.getElementById("btn-store"),
  storeBack: document.getElementById("store-back"),
  storeCoins: document.getElementById("store-coins"),
  storeRandomPrice: document.getElementById("store-random-price"),
  storeRandomBuy: document.getElementById("store-random-buy"),
  storeSymbolList: document.getElementById("store-symbol-list"),

  btnInventory: document.getElementById("btn-inventory"),
  inventoryBack: document.getElementById("inventory-back"),
  inventoryNameList: document.getElementById("inventory-name-list"),
  inventorySymbolList: document.getElementById("inventory-symbol-list"),

  userStreakLabel: document.getElementById("user-streak-label"),

  btnSearch: document.getElementById("btn-search"),
  btnJoin: document.getElementById("btn-join"),
  btnCreate: document.getElementById("btn-create"),
  btnAI: document.getElementById("btn-ai"),

  modeGrid: document.getElementById("mode-grid"),
  modeBack: document.getElementById("mode-back"),
  searchingModeLabel: document.getElementById("searching-mode-label"),

  cancelSearch: document.getElementById("cancel-search"),

  lobbyTitle: document.getElementById("lobby-title"),
  lobbyModeLabel: document.getElementById("lobby-mode-label"),
  lobbyStatus: document.getElementById("lobby-status"),
  teamBlueList: document.getElementById("team-blue-list"),
  teamRedList: document.getElementById("team-red-list"),
  lobbyCancel: document.getElementById("lobby-cancel"),

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

let selectedMode = "1v1";
let pendingModeAction = null; // "search" | "create"
let newsItems = [];
let unsubscribeNews = null;
let tournamentList = [];
let unsubscribeTournaments = null;
let unsubscribeTournamentDetail = null;
let currentTournamentId = null;
let currentTournament = null;
let friendsListData = [];
let friendRequestsData = [];
let unsubscribeFriends = null;
let unsubscribeFriendRequests = null;
let unsubscribeLobbyInvites = null;
let currentLobbyId = null;
let currentLobby = null;
let unsubscribeLobby = null;
let seenLobbyInviteIds = new Set();
let seenFriendRequestIds = new Set();
let activeTournamentId = null;
let unsubscribeTournamentMatch = null;
let lastLobbyPlayTs = 0;
let lastLobbyCancelTs = 0;
let partySearchActive = false;

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

    try {

      await registerUser(userId);

    } catch (e) {

      console.warn(
        "No se pudo registrar el usuario en Firebase:",
        e
      );

    }

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
  startNewsListener();
  startTournamentsListener();
  startFriendsListeners();
  startLobbyInvitesListener();
  // Penalización si abandonas partida de torneo cerrando/recargando
  window.addEventListener("beforeunload", () => {
    const tid = window.__lastRoomTournamentId;
    const room = window.__lastRoomSnapshot;
    const code = currentRoomCode;
    if (!tid || !userId || !code) return;
    if (room && room.winner) return; // ya terminó
    // best-effort (navegador puede cancelar async)
    try {
      const payload = JSON.stringify({
        tournamentId: tid,
        userId,
        code,
        room: {
          teams: room && room.teams,
          playerX: room && room.playerX,
          playerO: room && room.playerO
        }
      });
      // Usar sendBeacon no puede escribir Firebase; marcamos localStorage para aplicar al volver
      localStorage.setItem("rayalive_tournament_abandon", payload);
    } catch (e) {}
  });
  // Al cargar: si hubo abandono pendiente, aplicar penalización
  try {
    const raw = localStorage.getItem("rayalive_tournament_abandon");
    if (raw) {
      localStorage.removeItem("rayalive_tournament_abandon");
      const data = JSON.parse(raw);
      if (data && data.tournamentId && data.userId === userId) {
        penalizeTournamentAbandon(data.tournamentId, data.userId, data.room || {}).then(() => {
          if (data.code) markRoomAbandoned(data.code, data.userId).catch(() => {});
          showToast("Abandonaste una partida de torneo. Estás vetado 10 minutos y el rival recibe la victoria.");
        }).catch(() => {});
      }
    }
  } catch (e) {}

  // Ocultar formularios admin si no eres el creador
  if (els.newsAdmin) {
    if (canManageNews(username)) {
      els.newsAdmin.classList.remove("hidden");
    } else {
      els.newsAdmin.classList.add("hidden");
    }
  }
  if (els.tournamentAdmin) {
    if (canManageTournaments(username)) {
      els.tournamentAdmin.classList.remove("hidden");
    } else {
      els.tournamentAdmin.classList.add("hidden");
    }
  }
}

function handleOwnBan(ban) {

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

function updateMyStreakBadge() {

  els.userStreakLabel.textContent =
    "🔥 Racha: " + myStreak;

}

function openNameModal(forced = false) {

  els.nameInput.value = username || "";

  renderStatsGrid(els.ownStatsGrid, myStats);

  els.nameModal.classList.remove("hidden");

  els.nameModal.dataset.forced =
    forced ? "1" : "0";

  els.nameClose.classList.toggle("hidden", forced);
}

els.nameClose.addEventListener("click", () => {
  els.nameModal.classList.add("hidden");
});

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

function showView(name) {

  Object.values(views).forEach(
    (v) => v.classList.add("hidden")
  );

  views[name].classList.remove("hidden");

}

function ensureUsername(action) {

  if (!authReady) return;

  if (!username) {

    pendingAfterNameSave = action;
    openNameModal(true);

    return;
  }

  action();

}

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

    const withWins =
      top.filter(
        (u) => (u.wins || 0) > 0
      );

    const list =
      withWins.length > 0
        ? withWins
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

      const wins =
        document.createElement("span");

      wins.className =
        "ranking-streak";

      wins.textContent =
        "🏆 " + (u.wins || 0) + " victorias";

      li.appendChild(pos);

      li.appendChild(name);

      li.appendChild(wins);

      els.rankingList.appendChild(li);

    });

  } catch (e) {

    console.error(e);

    showToast(
      "No se pudo cargar el ranking."
    );

  }

}





async function startTournamentPlay(tournamentId) {
  activeTournamentId = tournamentId;

  const t = tournamentList.find((x) => x.id === tournamentId) || currentTournament;
  if (!t) {
    showToast("Torneo no encontrado.");
    return;
  }
  if (isTournamentClosed(t)) {
    showToast("El torneo ha finalizado. Ya no se puede jugar.");
    activeTournamentId = null;
    return;
  }

  const imIn = isJoined(t, userId);
  if (!imIn) {
    showToast("No estás inscrito en este torneo.");
    activeTournamentId = null;
    return;
  }

  const teamModes = ["DUO", "TRIO", "SQUAD", "2v2", "3v3", "4v4"];
  const isTeamTour = teamModes.includes(t.mode);
  const partySize = currentLobby ? Object.keys(currentLobby.members || {}).length : 0;

  // Con equipo: todos los miembros de la lobby deben estar inscritos
  if (isTeamTour && currentLobbyId && partySize >= 2) {
    const members = Object.keys(currentLobby.members || {});
    const missing = members.filter((id) => id !== userId && !isJoined(t, id));
    // isJoined needs player ids from tournament - members who aren't in players
    const notEnrolled = members.filter((id) => !(t.players && t.players[id]));
    if (notEnrolled.length) {
      const names = notEnrolled.map((id) => {
        if (id === userId) return username;
        const m = currentLobby.members[id];
        return (m && m.name) || "Compañero";
      });
      if (notEnrolled.includes(userId)) {
        showToast("No estás inscrito en este torneo.");
      } else {
        showToast("Tu compañero no está inscrito: " + names.filter((n) => n !== username).join(", "));
      }
      activeTournamentId = null;
      return;
    }

    const gameMode = mapPartyToGameMode(currentLobby.mode || t.mode);
    selectedMode = gameMode;
    try {
      await requestLobbyPlay(currentLobbyId, userId, username, gameMode);
      lastLobbyPlayTs = Date.now();
      partySearchActive = true;
      startSearch({ fromParty: true });
    } catch (e) {
      showToast(friendlyError(e, "No se pudo iniciar con el equipo. Comprueba que sigues en la lobby."));
    }
    return;
  }

  // Solo (sin duo): emparejar 1v1 con otro inscrito del torneo
  showView("searching");
  if (els.searchingModeLabel) {
    els.searchingModeLabel.textContent = isTeamTour
      ? "Torneo " + (t.mode || "DUO") + ": buscando compañeros y rivales…"
      : "Torneo: buscando rival inscrito…";
  }
  try {
    await assertNotPenalized(tournamentId, userId);
    const res = await findTournamentMatch(tournamentId, userId, username);
    if (res.status === "matched") {
      currentRoomCode = res.code;
      await clearTournamentMatch(tournamentId, userId).catch(() => {});
      watchRoom(res.code);
    } else {
      if (els.searchingModeLabel) {
        if (res.phase === "partner") {
          els.searchingModeLabel.textContent =
            "Buscando compañero de equipo (" + (res.queueCount || 1) + "/" + (res.teamSize || 2) + ")…";
        } else if (res.phase === "opponent") {
          els.searchingModeLabel.textContent =
            "Compañero listo. Buscando equipo rival (" + (res.queueCount || 0) + "/" + (res.needed || 4) + ")…";
        } else {
          els.searchingModeLabel.textContent = "Torneo: buscando rival…";
        }
      }
      if (unsubscribeTournamentMatch) {
        unsubscribeTournamentMatch();
        unsubscribeTournamentMatch = null;
      }
      unsubscribeTournamentMatch = listenTournamentMatch(tournamentId, userId, async (match) => {
        if (!match || !match.code) return;
        if (unsubscribeTournamentMatch) {
          unsubscribeTournamentMatch();
          unsubscribeTournamentMatch = null;
        }
        await clearTournamentMatch(tournamentId, userId).catch(() => {});
        currentRoomCode = match.code;
        watchRoom(match.code);
      });
    }
  } catch (e) {
    showToast(friendlyError(e, "No se pudo buscar partida de torneo. ¿Estás inscrito y el torneo está abierto o en curso?"));
    activeTournamentId = null;
    showView("tournamentDetail");
  }
}


// ——— Amigos y Lobby ———

function friendlyError(err, fallback) {
  const raw = (err && (err.message || err.code || String(err))) || "";
  const s = raw.toLowerCase();
  if (s.includes("permission_denied") || s.includes("permission denied")) {
    return (
      fallback ||
      "No tienes permiso para eso. Si es un torneo, asegúrate de estar inscrito y de que esté abierto o en curso. Si es la lobby, tienes que ser miembro."
    );
  }
  if (s.includes("network") || s.includes("offline")) {
    return "Sin conexión. Revisa tu internet e inténtalo de nuevo.";
  }
  if (raw && raw.length < 180 && !s.includes("firebase")) {
    return raw;
  }
  return fallback || "Ha ocurrido un error. Inténtalo de nuevo.";
}


function startFriendsListeners() {
  if (!userId) return;
  if (!unsubscribeFriends) {
    unsubscribeFriends = listenFriends(userId, (list) => {
      friendsListData = list;
      if (views.friends && !views.friends.classList.contains("hidden")) {
        renderFriendsView();
      }
      if (views.partyLobby && !views.partyLobby.classList.contains("hidden")) {
        renderPartyInviteFriends();
      }
    });
  }
  if (!unsubscribeFriendRequests) {
    unsubscribeFriendRequests = listenFriendRequests(userId, (list) => {
      friendRequestsData = list;
      updateFriendsBadge();
      // Toast for new requests
      list.forEach((req) => {
        const key = req.fromId;
        if (!seenFriendRequestIds.has(key)) {
          seenFriendRequestIds.add(key);
          showInviteToast({
            kicker: "Solicitud de amistad",
            title: req.fromName,
            text: "Quiere ser tu amigo.",
            onAccept: async () => {
              try {
                await acceptFriendRequest(userId, username, req.fromId, req.fromName);
                showToast("Amigo añadido.");
              } catch (e) {
                showToast(friendlyError(e, "Error al realizar la acción."));
              }
            },
            onDecline: async () => {
              try {
                await declineFriendRequest(userId, req.fromId);
              } catch (e) {}
            }
          });
        }
      });
      if (views.friends && !views.friends.classList.contains("hidden")) {
        renderFriendsView();
      }
    });
  }
}

function startLobbyInvitesListener() {
  if (!userId || unsubscribeLobbyInvites) return;
  unsubscribeLobbyInvites = listenLobbyInvites(userId, (list) => {
    list.forEach((inv) => {
      if (seenLobbyInviteIds.has(inv.id)) return;
      seenLobbyInviteIds.add(inv.id);
      const modeLabel = (PARTY_MODES[inv.mode] && PARTY_MODES[inv.mode].label) || inv.mode;
      showInviteToast({
        kicker: "Invitación a lobby",
        title: inv.fromName,
        text: "Te invita a una lobby " + modeLabel + ".",
        onAccept: async () => {
          try {
            const lid = await acceptLobbyInvite(userId, username, inv.id, inv.lobbyId);
            openPartyLobby(lid);
            showToast("Te has unido a la lobby.");
          } catch (e) {
            showToast(e.message || "No se pudo unir.");
          }
        },
        onDecline: async () => {
          try {
            await declineLobbyInvite(userId, inv.id);
          } catch (e) {}
        }
      });
    });
  });
}

function updateFriendsBadge() {
  if (!els.friendsBadge) return;
  const n = friendRequestsData.length;
  if (n > 0) {
    els.friendsBadge.textContent = n > 9 ? "9+" : String(n);
    els.friendsBadge.classList.remove("hidden");
  } else {
    els.friendsBadge.classList.add("hidden");
  }
}

function showInviteToast({ kicker, title, text, onAccept, onDecline }) {
  const el = document.createElement("div");
  el.className = "invite-toast";
  el.innerHTML =
    '<div class="invite-toast-kicker"></div>' +
    '<p class="invite-toast-title"></p>' +
    '<p class="invite-toast-text"></p>' +
    '<div class="invite-toast-actions">' +
    '<button type="button" class="btn-accept">Aceptar</button>' +
    '<button type="button" class="btn-decline">Rechazar</button>' +
    "</div>";
  el.querySelector(".invite-toast-kicker").textContent = kicker || "";
  el.querySelector(".invite-toast-title").textContent = title || "";
  el.querySelector(".invite-toast-text").textContent = text || "";
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));

  const close = () => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  };

  el.querySelector(".btn-accept").addEventListener("click", async () => {
    close();
    if (onAccept) await onAccept();
  });
  el.querySelector(".btn-decline").addEventListener("click", async () => {
    close();
    if (onDecline) await onDecline();
  });

  // Auto dismiss after 20s without action (still can accept from friends view)
  setTimeout(() => {
    if (document.body.contains(el)) close();
  }, 20000);
}

function renderFriendsView() {
  // Requests
  if (els.friendRequestsList) {
    els.friendRequestsList.innerHTML = "";
    if (!friendRequestsData.length) {
      if (els.friendRequestsEmpty) els.friendRequestsEmpty.classList.remove("hidden");
    } else {
      if (els.friendRequestsEmpty) els.friendRequestsEmpty.classList.add("hidden");
      friendRequestsData.forEach((req) => {
        const row = document.createElement("div");
        row.className = "friend-row";
        const name = document.createElement("span");
        name.className = "friend-row-name";
        name.textContent = req.fromName;
        const actions = document.createElement("div");
        actions.className = "friend-row-actions";
        const acc = document.createElement("button");
        acc.className = "btn-accept";
        acc.textContent = "Aceptar";
        acc.addEventListener("click", async () => {
          try {
            await acceptFriendRequest(userId, username, req.fromId, req.fromName);
            showToast("Amigo añadido.");
          } catch (e) {
            showToast(friendlyError(e, "Error al realizar la acción."));
          }
        });
        const dec = document.createElement("button");
        dec.className = "btn-decline";
        dec.textContent = "Rechazar";
        dec.addEventListener("click", async () => {
          await declineFriendRequest(userId, req.fromId).catch(() => {});
        });
        actions.appendChild(acc);
        actions.appendChild(dec);
        row.appendChild(name);
        row.appendChild(actions);
        els.friendRequestsList.appendChild(row);
      });
    }
  }

  // Friends list
  if (els.friendsList) {
    els.friendsList.innerHTML = "";
    if (!friendsListData.length) {
      if (els.friendsEmpty) els.friendsEmpty.classList.remove("hidden");
    } else {
      if (els.friendsEmpty) els.friendsEmpty.classList.add("hidden");
      friendsListData.forEach((f) => {
        const row = document.createElement("div");
        row.className = "friend-row";
        const name = document.createElement("span");
        name.className = "friend-row-name";
        name.textContent = f.name;
        const actions = document.createElement("div");
        actions.className = "friend-row-actions";
        const rm = document.createElement("button");
        rm.className = "btn-decline";
        rm.textContent = "Eliminar";
        rm.addEventListener("click", async () => {
          if (!confirm("¿Eliminar a " + f.name + " de amigos?")) return;
          await removeFriend(userId, f.id).catch(() => {});
        });
        actions.appendChild(rm);
        row.appendChild(name);
        row.appendChild(actions);
        els.friendsList.appendChild(row);
      });
    }
  }
}

function openPartyLobby(lobbyId) {
  currentLobbyId = lobbyId;
  showView("partyLobby");
  if (els.partyBar) els.partyBar.classList.add("hidden");
  // Reutilizar listener si ya estamos en esta lobby
  if (!unsubscribeLobby) {
    unsubscribeLobby = listenLobby(lobbyId, (lobby) => {
      currentLobby = lobby;
      if (!lobby) {
        showToast("La lobby se ha cerrado.");
        currentLobbyId = null;
        if (els.partyBar) els.partyBar.classList.add("hidden");
        if (unsubscribeLobby) {
          unsubscribeLobby();
          unsubscribeLobby = null;
        }
        showView("friends");
        return;
      }
      renderPartyLobby(lobby);
    });
  } else if (currentLobby) {
    renderPartyLobby(currentLobby);
  }
}

function renderPartyLobby(lobby) {
  const members = memberList(lobby);
  // Tú primero, luego el resto
  members.sort((a, b) => {
    if (a.id === userId) return -1;
    if (b.id === userId) return 1;
    if (a.isHost) return -1;
    if (b.isHost) return 1;
    return (a.joinedAt || 0) - (b.joinedAt || 0);
  });

  const modeLabel = (PARTY_MODES[lobby.mode] && PARTY_MODES[lobby.mode].label) || lobby.mode;
  if (els.partyLobbyMeta) {
    els.partyLobbyMeta.textContent =
      modeLabel + " · " + members.length + "/" + (lobby.maxSize || 2) + " jugadores";
  }

  if (els.partyModeRow) {
    els.partyModeRow.querySelectorAll(".pill").forEach((pill) => {
      const m = pill.dataset.party;
      pill.classList.toggle("active", m === lobby.mode);
      pill.disabled = lobby.hostId !== userId;
    });
  }

  if (els.partyMembers) {
    els.partyMembers.innerHTML = "";
    members.forEach((m) => {
      const li = document.createElement("li");
      if (m.isHost) li.classList.add("host-crown");
      let label = m.name;
      if (m.id === userId) label += " (tú)";
      if (m.isHost) label += " · anfitrión";
      li.textContent = label;
      els.partyMembers.appendChild(li);
    });
    const max = lobby.maxSize || 2;
    for (let i = members.length; i < max; i++) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "— vacío —";
      els.partyMembers.appendChild(li);
    }
  }

  // Cualquier miembro puede iniciar búsqueda para el equipo
  if (els.partyPlayBtn) {
    els.partyPlayBtn.style.display = "";
    els.partyPlayBtn.textContent = lobby.searching ? "Buscando…" : "Jugar partida";
  }

  updatePartyBar(lobby);

  // Si alguien de la lobby busca, TODOS ven la pantalla de búsqueda
  if (lobby.searching && lobby.playSignal) {
    if (lobby.playSignal.ts !== lastLobbyPlayTs) {
      lastLobbyPlayTs = lobby.playSignal.ts;
      selectedMode = lobby.playSignal.gameMode || mapPartyToGameMode(lobby.mode);
      if (lobby.playSignal.by !== userId && !partySearchActive) {
        // Unirse automáticamente a la búsqueda
        partySearchActive = true;
        startSearch({ fromParty: true });
      }
    }
  }

  // Petición de cancelar emparejamiento
  if (lobby.cancelSignal && lobby.cancelSignal.ts && lobby.cancelSignal.ts !== lastLobbyCancelTs) {
    if (lobby.cancelSignal.by !== userId) {
      lastLobbyCancelTs = lobby.cancelSignal.ts;
      const who = lobby.cancelSignal.byName || "Un jugador";
      showInviteToast({
        kicker: "Emparejamiento",
        title: who + " quiere cancelar",
        text: "¿Cancelar la búsqueda de partida de la lobby?",
        onAccept: async () => {
          try {
            await confirmLobbyCancel(currentLobbyId);
          } catch (e) {}
          await doCancelSearchLocal();
        },
        onDecline: async () => {
          try {
            await rejectLobbyCancel(currentLobbyId);
          } catch (e) {}
        }
      });
    }
  }

  // Si la lobby ya no busca, quitar pantalla de búsqueda al resto del equipo
  if (!lobby.searching && partySearchActive) {
    partySearchActive = false;
    const onSearching = views.searching && !views.searching.classList.contains("hidden");
    if (onSearching && !currentRoomCode) {
      if (unsubscribeMatch) {
        unsubscribeMatch();
        unsubscribeMatch = null;
      }
      cancelSearch(userId, selectedMode).catch(() => {});
      showView("partyLobby");
      showToast("El emparejamiento de la lobby ha terminado.");
    }
  }

  renderPartyInviteFriends();
}

function mapPartyToGameMode(partyMode) {
  const map = { SOLO: "1v1", DUO: "2v2", TRIO: "3v3", SQUAD: "4v4" };
  return map[partyMode] || "1v1";
}

function updatePartyBar(lobby) {
  if (!els.partyBar) return;
  if (!lobby || !currentLobbyId) {
    els.partyBar.classList.add("hidden");
    return;
  }
  // Mostrar barra solo si no estamos en la vista de lobby
  const onLobbyView = views.partyLobby && !views.partyLobby.classList.contains("hidden");
  if (onLobbyView) {
    els.partyBar.classList.add("hidden");
  } else {
    els.partyBar.classList.remove("hidden");
  }
  const members = memberList(lobby);
  const modeLabel = (PARTY_MODES[lobby.mode] && PARTY_MODES[lobby.mode].label) || lobby.mode;
  if (els.partyBarMode) els.partyBarMode.textContent = "Lobby " + modeLabel;
  if (els.partyBarMembers) {
    const names = members.map((m) => {
      let n = m.name;
      if (m.isHost) n = "👑 " + n;
      if (m.id === userId) n += " (tú)";
      return n;
    });
    // Tú arriba conceptualmente: poner tu nombre primero
    names.sort((a, b) => (a.includes("(tú)") ? -1 : b.includes("(tú)") ? 1 : 0));
    els.partyBarMembers.textContent = names.join(" · ");
  }
}

function renderPartyInviteFriends() {
  if (!els.partyInviteList) return;
  els.partyInviteList.innerHTML = "";
  if (!currentLobby || currentLobby.hostId !== userId) {
    if (els.partyInviteEmpty) {
      els.partyInviteEmpty.classList.remove("hidden");
      els.partyInviteEmpty.textContent = currentLobby && currentLobby.hostId !== userId
        ? "Solo el anfitrión puede invitar."
        : "No tienes amigos para invitar.";
    }
    return;
  }
  const inLobby = currentLobby.members || {};
  const available = friendsListData.filter((f) => !inLobby[f.id]);
  if (!available.length) {
    if (els.partyInviteEmpty) {
      els.partyInviteEmpty.classList.remove("hidden");
      els.partyInviteEmpty.textContent = "No tienes amigos para invitar.";
    }
    return;
  }
  if (els.partyInviteEmpty) els.partyInviteEmpty.classList.add("hidden");
  available.forEach((f) => {
    const row = document.createElement("div");
    row.className = "friend-row";
    const name = document.createElement("span");
    name.className = "friend-row-name";
    name.textContent = f.name;
    const actions = document.createElement("div");
    actions.className = "friend-row-actions";
    const inv = document.createElement("button");
    inv.className = "btn-accept";
    inv.textContent = "Invitar";
    inv.addEventListener("click", async () => {
      if (els.partyLobbyError) els.partyLobbyError.textContent = "";
      try {
        await inviteToLobby(currentLobbyId, userId, username, f.id, currentLobby.mode);
        showToast("Invitación enviada a " + f.name);
      } catch (e) {
        if (els.partyLobbyError) els.partyLobbyError.textContent = e.message || "Error";
      }
    });
    actions.appendChild(inv);
    row.appendChild(name);
    row.appendChild(actions);
    els.partyInviteList.appendChild(row);
  });
}

if (els.btnFriends) {
  els.btnFriends.addEventListener("click", () => {
    showView("friends");
    renderFriendsView();
  });
}
if (els.friendsBack) {
  els.friendsBack.addEventListener("click", () => showView("menu"));
}

if (els.friendAddBtn) {
  els.friendAddBtn.addEventListener("click", async () => {
    if (els.friendAddError) els.friendAddError.textContent = "";
    try {
      const name = els.friendNameInput ? els.friendNameInput.value.trim() : "";
      const toId = await findUserIdByName(name);
      await sendFriendRequest(userId, username, toId);
      if (els.friendNameInput) els.friendNameInput.value = "";
      showToast("Solicitud enviada.");
    } catch (e) {
      if (els.friendAddError) els.friendAddError.textContent = e.message || "Error";
    }
  });
}

if (els.btnCreateLobby) {
  els.btnCreateLobby.addEventListener("click", async () => {
    try {
      const id = await createLobby(userId, username, "DUO");
      openPartyLobby(id);
    } catch (e) {
      showToast(e.message || "No se pudo crear la lobby.");
    }
  });
}

if (els.partyLobbyBack) {
  els.partyLobbyBack.addEventListener("click", () => {
    // Volver al menú SIN salir de la lobby
    showView("menu");
    if (currentLobby) updatePartyBar(currentLobby);
  });
}

if (els.partyLeaveBtn) {
  els.partyLeaveBtn.addEventListener("click", async () => {
    if (!currentLobbyId) return;
    if (!confirm("¿Abandonar la lobby?")) return;
    try {
      await leaveLobby(currentLobbyId, userId);
    } catch (e) {}
    if (unsubscribeLobby) {
      unsubscribeLobby();
      unsubscribeLobby = null;
    }
    currentLobbyId = null;
    currentLobby = null;
    if (els.partyBar) els.partyBar.classList.add("hidden");
    showView("friends");
  });
}

if (els.partyPlayBtn) {
  els.partyPlayBtn.addEventListener("click", async () => {
    if (!currentLobbyId || !currentLobby) return;
    if (currentLobby.searching) {
      showToast("La lobby ya está buscando partida.");
      return;
    }
    try {
      const gameMode = mapPartyToGameMode(currentLobby.mode);
      await requestLobbyPlay(currentLobbyId, userId, username, gameMode);
      lastLobbyPlayTs = Date.now();
      selectedMode = gameMode;
      partySearchActive = true;
      showToast("Buscando partida para la lobby…");
      startSearch({ fromParty: true });
    } catch (e) {
      showToast(friendlyError(e, "No se pudo iniciar la partida de la lobby."));
    }
  });
}

if (els.partyBarOpen) {
  els.partyBarOpen.addEventListener("click", () => {
    if (currentLobbyId) openPartyLobby(currentLobbyId);
  });
}

if (els.partyModeRow) {
  els.partyModeRow.addEventListener("click", async (e) => {
    const pill = e.target.closest(".pill");
    if (!pill || !currentLobbyId || !currentLobby) return;
    if (currentLobby.hostId !== userId) return;
    const mode = pill.dataset.party;
    try {
      await setLobbyMode(currentLobbyId, userId, mode);
    } catch (err) {
      showToast(err.message || "Error");
    }
  });
}


// ——— Torneos ———
function startTournamentsListener() {
  if (unsubscribeTournaments) return;
  unsubscribeTournaments = listenTournaments((list) => {
    tournamentList = list;
    // Auto-finalizar torneos cuya hora de fin ya pasó (solo el creador escribe)
    list.forEach((t) => {
      maybeAutoFinishTournament(t, username).catch(() => {});
    });
    if (views.tournaments && !views.tournaments.classList.contains("hidden")) {
      renderTournamentsList();
    }
  });
}

function renderTournamentsList() {
  if (!els.tournamentsList) return;
  els.tournamentsList.innerHTML = "";
  if (!tournamentList.length) {
    if (els.tournamentsEmpty) els.tournamentsEmpty.classList.remove("hidden");
    return;
  }
  if (els.tournamentsEmpty) els.tournamentsEmpty.classList.add("hidden");

  tournamentList.forEach((t) => {
    const btn = document.createElement("button");
    btn.className = "tournament-card";
    btn.type = "button";

    const top = document.createElement("div");
    top.className = "t-card-top";
    const title = document.createElement("h3");
    title.className = "t-card-title";
    title.textContent = t.title;
    const st = document.createElement("span");
    const listClosed = isTournamentClosed(t);
    const listStatus = listClosed && t.status !== "cancelled" ? "finished" : (t.status || "open");
    st.className = "t-status t-status-" + listStatus;
    st.textContent = listClosed && t.status !== "cancelled"
      ? "Finalizado"
      : (TOURNAMENT_STATUSES[t.status] || t.status);
    top.appendChild(title);
    top.appendChild(st);
    btn.appendChild(top);

    const meta = document.createElement("p");
    meta.className = "t-card-meta";
    meta.textContent =
      formatTournamentDate(t.startAt) +
      " · " +
      playerCount(t) +
      "/" +
      (t.maxPlayers || 32) +
      " jugadores · " +
      (t.mode || "SOLO") +
      (t.teamBased ? " · Por equipos" : "");
    btn.appendChild(meta);

    if (t.prize) {
      const prize = document.createElement("p");
      prize.className = "t-card-prize";
      prize.textContent = "🏆 " + t.prize;
      btn.appendChild(prize);
    }

    btn.addEventListener("click", () => openTournamentDetail(t.id));
    els.tournamentsList.appendChild(btn);
  });
}

function openTournamentDetail(id) {
  currentTournamentId = id;
  if (unsubscribeTournamentDetail) {
    unsubscribeTournamentDetail();
    unsubscribeTournamentDetail = null;
  }
  showView("tournamentDetail");
  unsubscribeTournamentDetail = listenTournament(id, (t) => {
    currentTournament = t;
    if (!t) {
      showToast("Torneo eliminado.");
      showView("tournaments");
      return;
    }
    renderTournamentDetail(t);
  });
}

function renderTournamentDetail(t) {
  // Auto-finalizar si pasó la hora (el creador escribe en Firebase)
  maybeAutoFinishTournament(t, username).then((shouldBeFinished) => {
    if (shouldBeFinished && t.status !== "finished" && canManageTournaments(username)) {
      // status se actualizará por el listener
    }
  }).catch(() => {});

  const closed = isTournamentClosed(t);
  let displayStatus = TOURNAMENT_STATUSES[t.status] || t.status || "Abierto";
  if (t.status === "cancelled") displayStatus = "Cancelado";
  else if (t.status === "finished" || closed) displayStatus = "Finalizado";

  if (els.tdTitle) els.tdTitle.textContent = t.title;
  if (els.tdMeta) {
    let meta =
      displayStatus +
      " · Inicio " +
      formatTournamentDate(t.startAt) +
      " · Modo " +
      (t.mode || "SOLO");
    if (t.endAt) {
      meta += " · Fin " + formatTournamentDate(t.endAt);
    }
    els.tdMeta.textContent = meta;
  }
  if (els.tdDesc) els.tdDesc.textContent = t.description || "";
  if (els.tdPrize) els.tdPrize.textContent = t.prize || "Sin premio definido";

  if (els.tdReqs) {
    const parts = [];
    parts.push(playerCount(t) + " / " + (t.maxPlayers || 32) + " inscritos");
    if (t.minWins > 0) parts.push("Mín. " + t.minWins + " victorias");
    if (t.minStreak > 0) parts.push("Mín. racha " + t.minStreak);
    if (closed) parts.push("Inscripciones cerradas");
    els.tdReqs.textContent = parts.join(" · ");
  }

  if (els.tdError) els.tdError.textContent = "";
  if (els.tdActions) {
    els.tdActions.innerHTML = "";
    const joined = isJoined(t, userId);

    if (closed) {
      const note = document.createElement("p");
      note.className = "hint";
      note.textContent = joined
        ? "Torneo finalizado. Ya no puedes desinscribirte ni jugar más partidas de torneo."
        : "Torneo finalizado. Ya no te puedes inscribir.";
      els.tdActions.appendChild(note);
    } else if (joined) {
      const leave = document.createElement("button");
      leave.className = "btn-ghost full";
      leave.textContent = "Salir del torneo";
      leave.addEventListener("click", async () => {
        try {
          await leaveTournament(t.id, userId);
          showToast("Has salido del torneo.");
        } catch (e) {
          if (els.tdError) els.tdError.textContent = friendlyError(e, e.message || "Error");
        }
      });
      els.tdActions.appendChild(leave);
      const badge = document.createElement("p");
      badge.className = "hint";
      badge.textContent = "Estás inscrito.";
      els.tdActions.appendChild(badge);
    } else {
      const join = document.createElement("button");
      join.className = "btn-primary full";
      join.textContent = "Inscribirme";
      const check = canJoin(t, userId, myStats);
      if (!check.ok) {
        join.disabled = true;
        join.title = check.reason;
      }
      join.addEventListener("click", async () => {
        try {
          await joinTournament(t.id, userId, username, myStats);
          showToast("¡Inscrito!");
        } catch (e) {
          if (els.tdError) els.tdError.textContent = friendlyError(e, "No se pudo inscribir. Revisa requisitos (victorias, racha) y que las inscripciones estén abiertas.");
        }
      });
      els.tdActions.appendChild(join);
      if (!check.ok) {
        const why = document.createElement("p");
        why.className = "error-text";
        why.textContent = check.reason;
        els.tdActions.appendChild(why);
      }
    }

    // Jugar solo si inscrito y torneo activo
    if (!closed && joined && (t.status === "live" || t.status === "open")) {
      const playBtn = document.createElement("button");
      playBtn.className = "btn-primary full";
      playBtn.textContent = "Jugar torneo";
      playBtn.addEventListener("click", () => startTournamentPlay(t.id));
      els.tdActions.appendChild(playBtn);
    }
  }

  // Leaderboard
  const lb = getLeaderboard(t);
  if (els.tdLeaderboard) {
    els.tdLeaderboard.innerHTML = "";
    if (!lb.length) {
      if (els.tdLbEmpty) els.tdLbEmpty.classList.remove("hidden");
    } else {
      if (els.tdLbEmpty) els.tdLbEmpty.classList.add("hidden");
      lb.forEach((p, i) => {
        const li = document.createElement("li");
        li.className = "ranking-row" + (p.id === userId ? " me" : "");
        const pos = document.createElement("span");
        pos.className = "ranking-pos";
        pos.textContent = "#" + (i + 1);
        const name = document.createElement("span");
        name.className = "ranking-name";
        name.textContent = p.name;
        const score = document.createElement("span");
        score.className = "ranking-streak";
        score.textContent = p.points + " pts · " + p.wins + "V";
        li.appendChild(pos);
        li.appendChild(name);
        li.appendChild(score);
        els.tdLeaderboard.appendChild(li);
      });
    }
  }

  // Admin panel
  const isAdmin = canManageTournaments(username);
  if (els.tdAdmin) {
    if (isAdmin) {
      els.tdAdmin.classList.remove("hidden");
      if (els.tdStatusSelect) els.tdStatusSelect.value = t.status || "open";
      if (els.tdScorePlayer) {
        els.tdScorePlayer.innerHTML = "";
        lb.forEach((p) => {
          const opt = document.createElement("option");
          opt.value = p.id;
          opt.textContent = p.name + " (" + p.points + " pts)";
          opt.dataset.points = p.points;
          opt.dataset.wins = p.wins;
          opt.dataset.losses = p.losses;
          els.tdScorePlayer.appendChild(opt);
        });
        if (lb[0]) {
          els.tdScorePoints.value = lb[0].points;
          els.tdScoreWins.value = lb[0].wins;
          els.tdScoreLosses.value = lb[0].losses;
        }
      }
    } else {
      els.tdAdmin.classList.add("hidden");
    }
  }
}

if (els.btnTournaments) {
  els.btnTournaments.addEventListener("click", () => {
    showView("tournaments");
    if (els.tournamentAdmin) {
      if (canManageTournaments(username)) {
        els.tournamentAdmin.classList.remove("hidden");
      } else {
        els.tournamentAdmin.classList.add("hidden");
      }
    }
    renderTournamentsList();
  });
}

if (els.tournamentsBack) {
  els.tournamentsBack.addEventListener("click", () => showView("menu"));
}

if (els.tdBack) {
  els.tdBack.addEventListener("click", () => {
    if (unsubscribeTournamentDetail) {
      unsubscribeTournamentDetail();
      unsubscribeTournamentDetail = null;
    }
    currentTournamentId = null;
    currentTournament = null;
    showView("tournaments");
  });
}

if (els.tCreate) {
  els.tCreate.addEventListener("click", async () => {
    if (!canManageTournaments(username)) return;
    if (els.tFormError) els.tFormError.textContent = "";
    try {
      const startVal = els.tStart && els.tStart.value;
      const startAt = startVal ? new Date(startVal).getTime() : NaN;
      if (!startAt || isNaN(startAt)) {
        throw new Error("Pon una fecha y hora de inicio válidas.");
      }
      const endVal = els.tEnd && els.tEnd.value ? els.tEnd.value.trim() : "";
      let endAt = 0;
      if (endVal) {
        endAt = new Date(endVal).getTime();
        if (!endAt || isNaN(endAt)) {
          throw new Error("La fecha de fin no es válida. Déjala vacía si no quieres fin automático.");
        }
        if (endAt <= startAt) {
          throw new Error("La hora de fin debe ser posterior al inicio.");
        }
        if (endAt <= Date.now()) {
          throw new Error("La hora de fin no puede ser en el pasado. Si no quieres fin automático, deja el campo vacío.");
        }
      }
      const statusVal = els.tStatus ? els.tStatus.value : "open";
      if (statusVal === "finished" || statusVal === "cancelled") {
        throw new Error("No crees el torneo ya finalizado. Usa Inscripciones abiertas o En curso.");
      }
      await createTournament(
        {
          title: els.tTitle ? els.tTitle.value : "",
          description: els.tDesc ? els.tDesc.value : "",
          prize: els.tPrize ? els.tPrize.value : "",
          startAt,
          endAt,
          minWins: els.tMinWins ? els.tMinWins.value : 0,
          minStreak: els.tMinStreak ? els.tMinStreak.value : 0,
          maxPlayers: els.tMax ? els.tMax.value : 16,
          mode: els.tMode ? els.tMode.value : "SOLO",
          teamBased: els.tTeamBased ? els.tTeamBased.checked : false,
          status: statusVal || "open"
        },
        userId,
        username
      );
      if (els.tTitle) els.tTitle.value = "";
      if (els.tDesc) els.tDesc.value = "";
      if (els.tPrize) els.tPrize.value = "";
      showToast("Torneo creado.");
    } catch (e) {
      if (els.tFormError) els.tFormError.textContent = e.message || "Error";
    }
  });
}

if (els.tdSaveStatus) {
  els.tdSaveStatus.addEventListener("click", async () => {
    if (!currentTournamentId || !canManageTournaments(username)) return;
    try {
      await updateTournament(
        currentTournamentId,
        { status: els.tdStatusSelect.value },
        username
      );
      showToast("Estado actualizado.");
    } catch (e) {
      showToast(friendlyError(e, "Error al realizar la acción."));
    }
  });
}

if (els.tdDelete) {
  els.tdDelete.addEventListener("click", async () => {
    if (!currentTournamentId || !canManageTournaments(username)) return;
    if (!confirm("¿Borrar este torneo por completo?")) return;
    try {
      await deleteTournament(currentTournamentId, username);
      showToast("Torneo borrado.");
      showView("tournaments");
    } catch (e) {
      showToast(friendlyError(e, "Error al realizar la acción."));
    }
  });
}

if (els.tdScorePlayer) {
  els.tdScorePlayer.addEventListener("change", () => {
    const opt = els.tdScorePlayer.selectedOptions[0];
    if (!opt) return;
    if (els.tdScorePoints) els.tdScorePoints.value = opt.dataset.points || 0;
    if (els.tdScoreWins) els.tdScoreWins.value = opt.dataset.wins || 0;
    if (els.tdScoreLosses) els.tdScoreLosses.value = opt.dataset.losses || 0;
  });
}

if (els.tdSaveScore) {
  els.tdSaveScore.addEventListener("click", async () => {
    if (!currentTournamentId || !canManageTournaments(username)) return;
    const pid = els.tdScorePlayer ? els.tdScorePlayer.value : "";
    if (!pid) return;
    try {
      await setPlayerScore(
        currentTournamentId,
        pid,
        {
          points: els.tdScorePoints ? els.tdScorePoints.value : 0,
          wins: els.tdScoreWins ? els.tdScoreWins.value : 0,
          losses: els.tdScoreLosses ? els.tdScoreLosses.value : 0
        },
        username
      );
      showToast("Puntuación actualizada.");
    } catch (e) {
      showToast(friendlyError(e, "Error al realizar la acción."));
    }
  });
}


// ——— Novedades ———
function updateNewsBadge() {
  if (!els.newsBadge) return;
  const n = countUnread(newsItems);
  if (n > 0) {
    els.newsBadge.textContent = n > 9 ? "9+" : String(n);
    els.newsBadge.classList.remove("hidden");
  } else {
    els.newsBadge.classList.add("hidden");
  }
}

function formatNewsDate(ts) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return d.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

function renderNewsList() {
  if (!els.newsList) return;
  els.newsList.innerHTML = "";
  if (!newsItems.length) {
    if (els.newsEmpty) els.newsEmpty.classList.remove("hidden");
    return;
  }
  if (els.newsEmpty) els.newsEmpty.classList.add("hidden");

  const admin = canManageNews(username);

  newsItems.forEach((item) => {
    const card = document.createElement("article");
    card.className = "news-card" + (isUnread(item.id) ? " is-new" : "");

    if (isUnread(item.id)) {
      const tag = document.createElement("span");
      tag.className = "news-new-tag";
      tag.textContent = "NUEVO";
      card.appendChild(tag);
    }

    const title = document.createElement("h3");
    title.className = "news-title";
    title.textContent = item.title;
    card.appendChild(title);

    const body = document.createElement("p");
    body.className = "news-body";
    body.textContent = item.body;
    card.appendChild(body);

    const meta = document.createElement("div");
    meta.className = "news-meta";
    const left = document.createElement("span");
    left.textContent = formatNewsDate(item.createdAt) +
      (item.author ? " · " + item.author : "");
    meta.appendChild(left);

    if (admin) {
      const del = document.createElement("button");
      del.className = "news-delete";
      del.textContent = "Borrar";
      del.addEventListener("click", async () => {
        if (!confirm("¿Borrar esta novedad?")) return;
        try {
          await deleteNews(item.id, username);
        } catch (e) {
          showToast("No se pudo borrar.");
        }
      });
      meta.appendChild(del);
    }

    card.appendChild(meta);
    els.newsList.appendChild(card);
  });
}

function startNewsListener() {
  if (unsubscribeNews) return;
  unsubscribeNews = listenNews((items) => {
    newsItems = items;
    updateNewsBadge();
    // If currently on news view, re-render
    if (views.news && !views.news.classList.contains("hidden")) {
      renderNewsList();
    }
  });
}

if (els.btnNews) {
  els.btnNews.addEventListener("click", () => {
    showView("news");
    // Admin form
    if (els.newsAdmin) {
      if (canManageNews(username)) {
        els.newsAdmin.classList.remove("hidden");
      } else {
        els.newsAdmin.classList.add("hidden");
      }
    }
    renderNewsList();
    // Mark all as seen when opening
    markAllSeen(newsItems);
    updateNewsBadge();
    // Re-render to clear NUEVO tags
    renderNewsList();
  });
}

if (els.newsBack) {
  els.newsBack.addEventListener("click", () => showView("menu"));
}

if (els.newsPublish) {
  els.newsPublish.addEventListener("click", async () => {
    if (!canManageNews(username)) return;
    const title = els.newsTitleInput ? els.newsTitleInput.value : "";
    const body = els.newsBodyInput ? els.newsBodyInput.value : "";
    if (els.newsFormError) els.newsFormError.textContent = "";
    try {
      await createNews(title, body, username, userId);
      if (els.newsTitleInput) els.newsTitleInput.value = "";
      if (els.newsBodyInput) els.newsBodyInput.value = "";
      showToast("Novedad publicada.");
    } catch (e) {
      if (els.newsFormError) {
        els.newsFormError.textContent = e.message || "Error al publicar.";
      }
    }
  });
}

els.btnAchievements.addEventListener(
  "click",
  async () => {

    showView("achievements");

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

els.btnStore.addEventListener("click", () => {
  showView("store");
  renderStoreView();
});

els.storeBack.addEventListener("click", () => showView("menu"));

function renderStoreView() {

  els.storeCoins.textContent = "🪙 " + (myStats.coins || 0) + " monedas";

  els.storeRandomPrice.textContent = RANDOM_NAME_COLOR_PRICE + " monedas";
  els.storeRandomBuy.disabled = (myStats.coins || 0) < RANDOM_NAME_COLOR_PRICE;

  els.storeSymbolList.innerHTML = "";

  SYMBOL_COLORS.forEach((item) => {
    els.storeSymbolList.appendChild(buildSymbolBuyRow(item));
  });

}

function buildSymbolBuyRow(item) {

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

  const btn = document.createElement("button");

  if (owned) {

    price.textContent = "Ya lo tienes";
    btn.className = "btn-secondary";
    btn.textContent = "Comprado";
    btn.disabled = true;

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
    showToast("¡Te ha tocado " + picked.label + "! Equípalo desde el Inventario.");
    renderStoreView();
  } catch (e) {
    showToast(e.message || "No se pudo comprar.");
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

els.btnInventory.addEventListener("click", () => {
  showView("inventory");
  renderInventoryView();
});

els.inventoryBack.addEventListener("click", () => showView("menu"));

function renderInventoryView() {

  els.inventoryNameList.innerHTML = "";

  els.inventoryNameList.appendChild(
    buildEquipOnlyRow(
      { key: "", label: "Por defecto (negro)", hex: "#111111" },
      myStats.nameColor,
      (hex) => handleEquipName(hex)
    )
  );

  NAME_COLORS.filter(
    (c) => myStats.unlockedColors && myStats.unlockedColors[c.key]
  ).forEach((c) => {
    els.inventoryNameList.appendChild(
      buildEquipOnlyRow(c, myStats.nameColor, (hex) => handleEquipName(hex))
    );
  });

  els.inventorySymbolList.innerHTML = "";

  els.inventorySymbolList.appendChild(
    buildEquipOnlyRow(
      { key: "", label: "Por defecto (negro)", hex: "#111111" },
      myStats.symbolColor,
      (hex) => handleEquipSymbol(hex)
    )
  );

  SYMBOL_COLORS.filter(
    (c) => myStats.unlockedSymbolColors && myStats.unlockedSymbolColors[c.key]
  ).forEach((c) => {
    els.inventorySymbolList.appendChild(
      buildEquipOnlyRow(c, myStats.symbolColor, (hex) => handleEquipSymbol(hex))
    );
  });

}

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

async function handleEquipName(hex) {
  try {
    await equipNameColor(userId, hex);
    myStats = normalizeStats({ ...myStats, nameColor: hex });
    applyNameStyle(els.userNameLabel, username, myStats.nameColor);
    renderInventoryView();
  } catch (e) {
    showToast(e.message || "No se pudo equipar.");
  }
}

async function handleEquipSymbol(hex) {
  try {
    await equipSymbolColor(userId, hex);
    myStats = normalizeStats({ ...myStats, symbolColor: hex });
    renderInventoryView();
  } catch (e) {
    showToast(e.message || "No se pudo equipar.");
  }
}

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

els.btnCreate.addEventListener(
  "click",
  () => {

    ensureUsername(() => {
      pendingModeAction = "create";
      showView("modeSelect");
    });

  }
);

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

els.btnSearch.addEventListener(
  "click",
  () => {

    ensureUsername(() => {
      pendingModeAction = "search";
      showView("modeSelect");
    });

  }
);

async function startSearch(opts = {}) {
  const fromParty = !!(opts && opts.fromParty);

  els.joinPanel.classList.add("hidden");
  els.aiPanel.classList.add("hidden");

  // Si estás en lobby y eliges 2v2 etc desde el menú, avisa al equipo
  if (currentLobbyId && currentLobby && !fromParty && selectedMode !== "1v1") {
    try {
      await requestLobbyPlay(currentLobbyId, userId, username, selectedMode);
      lastLobbyPlayTs = Date.now();
      partySearchActive = true;
    } catch (e) {
      console.warn(e);
    }
  }

  const modeLabel = selectedMode.replace("v", " vs ");
  if (els.searchingModeLabel) {
    let msg = "Modo " + modeLabel + ". En cuanto haya gente suficiente, os emparejamos.";
    if (currentLobbyId && currentLobby) {
      msg = "Lobby · Modo " + modeLabel + ". Buscando con tu equipo…";
    }
    if (activeTournamentId) {
      msg = "Torneo: buscando rival…";
    }
    els.searchingModeLabel.textContent = msg;
  }

  showView("searching");
  partySearchActive = true;

  try {
    const res = await findMatch(userId, username, selectedMode);

    if (res.status === "matched") {
      currentRoomCode = res.code;
      partySearchActive = false;
      if (currentLobbyId) {
        clearLobbyPlaySignal(currentLobbyId).catch(() => {});
      }
      watchRoom(res.code);
    } else {
      unsubscribeMatch = listenForMatch(userId, async (match) => {
        if (unsubscribeMatch) {
          unsubscribeMatch();
          unsubscribeMatch = null;
        }
        await clearMatchNotification(userId).catch(() => {});
        currentRoomCode = match.code;
        partySearchActive = false;
        if (currentLobbyId) {
          clearLobbyPlaySignal(currentLobbyId).catch(() => {});
        }
        watchRoom(match.code);
      });
    }
  } catch (e) {
    showToast("No se pudo buscar partida.");
    partySearchActive = false;
    showView("menu");
  }
}

async function doCancelSearchLocal() {
  if (unsubscribeMatch) {
    unsubscribeMatch();
    unsubscribeMatch = null;
  }
  await cancelSearch(userId, selectedMode).catch(() => {});
  if (activeTournamentId) {
    await cancelTournamentQueue(activeTournamentId, userId).catch(() => {});
    if (unsubscribeTournamentMatch) {
      unsubscribeTournamentMatch();
      unsubscribeTournamentMatch = null;
    }
    activeTournamentId = null;
  }
  partySearchActive = false;
  showView(currentLobbyId ? "partyLobby" : "menu");
  if (currentLobbyId && currentLobby) {
    openPartyLobby(currentLobbyId);
  }
}

async function startCreateWithMode() {
  els.btnCreate.disabled = true;
  try {
    const code = await createRoom(userId, username, selectedMode);
    currentRoomCode = code;
    els.roomCodeDisplay.textContent = code;
    waitingDisconnectHandle = armRoomAutoCleanup(code);

    if (selectedMode === "1v1") {
      showView("waiting");
    } else {
      renderLobbyTeams({
        teams: {
          blue: [{ id: userId, name: username }],
          red: []
        },
        mode: selectedMode,
        status: "lobby"
      });
      showView("lobby");
    }
    watchRoom(code);
  } catch (e) {
    alert("No se pudo crear la sala: " + e.message);
  } finally {
    els.btnCreate.disabled = false;
  }
}

// Mode selection
if (els.modeGrid) {
  els.modeGrid.addEventListener("click", (e) => {
    const card = e.target.closest(".mode-card");
    if (!card) return;
    selectedMode = card.dataset.mode || "1v1";
    if (pendingModeAction === "search") {
      startSearch();
    } else if (pendingModeAction === "create") {
      startCreateWithMode();
    }
    pendingModeAction = null;
  });
}

if (els.modeBack) {
  els.modeBack.addEventListener("click", () => {
    pendingModeAction = null;
    showView("menu");
  });
}

els.cancelSearch.addEventListener(
  "click",
  async () => {
    // Si hay lobby con más de 1 persona, pedir confirmación al equipo
    if (currentLobbyId && currentLobby) {
      const members = Object.keys(currentLobby.members || {});
      if (members.length > 1 && currentLobby.searching) {
        try {
          await requestLobbyCancel(currentLobbyId, userId, username);
          showToast("Has pedido cancelar. Tu compañero debe aceptar o rechazar.");
        } catch (e) {
          showToast(friendlyError(e, "Error al realizar la acción."));
        }
        return;
      }
      // Solo en la lobby: cancelar para todos
      try {
        await confirmLobbyCancel(currentLobbyId);
      } catch (e) {}
    }
    await doCancelSearchLocal();
  }
);

function renderLobbyTeams(room) {
  const mode = room.mode || "1v1";
  const modeLabel = mode.replace("v", " vs ");
  if (els.lobbyModeLabel) els.lobbyModeLabel.textContent = "Modo " + modeLabel;
  if (els.lobbyTitle) els.lobbyTitle.textContent = "Sala de espera";

  const blue = (room.teams && room.teams.blue) || [];
  const red = (room.teams && room.teams.red) || [];
  const needed = MODE_PLAYERS[mode] || 2;
  const half = needed / 2;
  const total = blue.length + red.length;

  if (els.lobbyStatus) {
    if (room.status === "playing") {
      els.lobbyStatus.textContent = "¡Partida en curso!";
    } else {
      els.lobbyStatus.textContent =
        "Jugadores: " + total + " / " + needed + " · Esperando a que se llene la sala…";
    }
  }

  function fillList(el, players, slots) {
    if (!el) return;
    el.innerHTML = "";
    for (let i = 0; i < slots; i++) {
      const li = document.createElement("li");
      if (players[i]) {
        li.textContent = players[i].name || "Jugador";
        if (players[i].id === userId) li.textContent += " (tú)";
      } else {
        li.className = "empty";
        li.textContent = "— vacío —";
      }
      el.appendChild(li);
    }
  }

  fillList(els.teamBlueList, blue, half);
  fillList(els.teamRedList, red, half);
}

if (els.lobbyCancel) {
  els.lobbyCancel.addEventListener("click", async () => {
    if (currentRoomCode) {
      try {
        await deleteRoom(currentRoomCode);
      } catch (e) {}
      currentRoomCode = null;
    }
    if (unsubscribeRoom) {
      unsubscribeRoom();
      unsubscribeRoom = null;
    }
    showView("menu");
  });
}

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

        if (room.status === "abandoned") {
          if (room.abandonedBy && room.abandonedBy !== userId) {
            showToast("Tu rival abandonó. Se te cuenta la victoria en el torneo.");
          }
          // no forzar salida inmediata
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

        if (room.teams && room.mode && room.mode !== "1v1") {
          const inBlue = (room.teams.blue || []).some(p => p.id === userId);
          const inRed = (room.teams.red || []).some(p => p.id === userId);
          if (inBlue) mySymbol = "X";
          else if (inRed) mySymbol = "O";
        } else if (room.playerX && room.playerX.id === userId) {
          mySymbol = "X";
        } else if (room.playerO && room.playerO.id === userId) {
          mySymbol = "O";
        }

        if (
          room.status === "waiting"
        ) {

          showView("waiting");

          return;

        }

        if (
          room.status === "lobby" ||
          (room.teams && room.status !== "playing" && room.status !== "finished")
        ) {
          renderLobbyTeams(room);
          showView("lobby");

          // Auto-start game when lobby is full (for matchmade rooms)
          if (room.matchmade && room.teams) {
            const needed = MODE_PLAYERS[room.mode] || 2;
            const total =
              (room.teams.blue || []).length +
              (room.teams.red || []).length;
            if (total >= needed && room.status === "lobby") {
              // Only the first blue player triggers the start to avoid races
              if (
                room.teams.blue &&
                room.teams.blue[0] &&
                room.teams.blue[0].id === userId
              ) {
                startLobbyGame(code).catch(() => {});
              }
            }
          }
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

    renderOnlineRoom(room, code);

  } catch (e) {

  }

}

function renderOnlineRoom(
  room,
  code
) {
  window.__lastRoomTournamentId = room && room.tournamentId ? room.tournamentId : null;
  window.__lastRoomSnapshot = room;
  // Ocultar botón salir en torneo
  if (els.leaveBtn) {
    if (room && room.tournamentId) {
      els.leaveBtn.style.display = "none";
    } else {
      els.leaveBtn.style.display = "";
    }
  }


  const mode = room.mode || "1v1";
  const isTeam = mode !== "1v1" && room.teams;
  const currentPlayer = getCurrentTurnPlayer(room);

  // Show team names or classic X/O names
  if (isTeam) {
    const blueNames = (room.teams.blue || []).map(p => p.name).join(", ") || "—";
    const redNames = (room.teams.red || []).map(p => p.name).join(", ") || "—";
    els.nameX.textContent = blueNames;
    els.nameO.textContent = redNames;
    applyNameStyle(els.nameX, "");
    applyNameStyle(els.nameO, "");
  } else {
    els.nameX.textContent = room.playerX ? room.playerX.name : "—";
    applyNameStyle(els.nameX, room.playerX ? room.playerX.name : "");
    setPlayerNameClickable(els.nameX, room.playerX || null);

    els.nameO.textContent = room.playerO ? room.playerO.name : "—";
    applyNameStyle(els.nameO, room.playerO ? room.playerO.name : "");
    setPlayerNameClickable(els.nameO, room.playerO || null);
  }

  // Am I allowed to move right now?
  let canMove = false;
  if (isTeam) {
    canMove = currentPlayer && currentPlayer.id === userId;
    mySymbol = currentPlayer ? currentPlayer.symbol : mySymbol;
  } else {
    canMove = room.turn === mySymbol;
  }

  const finished = !!room.winner;

  const winInfo = finished
    ? checkWinner(room.board, mode)
    : null;

  // Status line: whose turn
  if (!finished && currentPlayer) {
    const you = currentPlayer.id === userId ? " (tú)" : "";
    els.statusLine.textContent =
      "Turno de " + (currentPlayer.name || "?") + you +
      (isTeam ? " · Equipo " + (currentPlayer.team === "blue" ? "Azul" : "Rojo") : "");
  }

  renderBoard(
    room.board,
    winInfo ? winInfo.line : room.winningLine || null,
    finished || !canMove,
    (index) => {
      if (room.winner) return;
      if (isTeam) {
        const cp = getCurrentTurnPlayer(room);
        if (!cp || cp.id !== userId) return;
        makeMove(code, index, cp.symbol, userId);
      } else {
        if (room.turn !== mySymbol) return;
        makeMove(code, index, mySymbol);
      }
    },
    xSymbolColor,
    oSymbolColor,
    mode
  );

  if (finished) {

    hideTimer();

    if (
      statsAppliedLocallyFor !== code
    ) {

      statsAppliedLocallyFor = code;

      let outcome;
      if (room.winner === "draw") {
        outcome = "draw";
      } else if (room.teams && room.mode && room.mode !== "1v1") {
        // Team mode: win if your team symbol matches the winner
        const inBlue = (room.teams.blue || []).some(p => p.id === userId);
        const inRed = (room.teams.red || []).some(p => p.id === userId);
        const myTeamSymbol = inBlue ? "X" : inRed ? "O" : null;
        outcome = myTeamSymbol && room.winner === myTeamSymbol ? "win" : "loss";
      } else {
        outcome = room.winner === mySymbol ? "win" : "loss";
      }

      if (room.tournamentId) {
        // Torneo: solo clasifica del torneo. NO monedas, NO racha, NO wins globales.
        recordMyTournamentResult(room.tournamentId, userId, outcome).catch((e) =>
          console.warn("tournament result", e)
        );
        activeTournamentId = null;
      } else {
      // Partida normal: monedas, racha y estadísticas globales
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

          const newStats =
            normalizeStats(updated);

          const newlyUnlocked =
            getNewlyUnlocked(
              myStats,
              newStats
            );

          myStats =
            newStats;

          myStreak =
            newStats.streak;

          updateMyStreakBadge();

          renderAchievementsView();

          newlyUnlocked.forEach(
            (achievement) => {

              queueAchievementToast(
                achievement
              );

            }
          );

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
      } // fin partida normal (no torneo)

    }

    const mode = room.mode || "1v1";
    let iWon = false;
    if (room.winner === "draw") {
      els.statusLine.textContent = "Empate.";
    } else if (room.teams && mode !== "1v1") {
      const inBlue = (room.teams.blue || []).some(p => p.id === userId);
      const inRed = (room.teams.red || []).some(p => p.id === userId);
      const myTeamSymbol = inBlue ? "X" : inRed ? "O" : null;
      iWon = myTeamSymbol && room.winner === myTeamSymbol;
      els.statusLine.textContent = iWon ? "¡Tu equipo ha ganado!" : "Tu equipo ha perdido.";
    } else {
      iWon = room.winner === mySymbol;
      els.statusLine.textContent = iWon ? "¡Has ganado!" : "Has perdido.";
    }

    openResultModalOnline(room, code);

  } else {

    closeResultModal();

    const mode = room.mode || "1v1";
    const isTeam = mode !== "1v1" && room.teams;
    const currentPlayer = getCurrentTurnPlayer(room);
    const myTurn = isTeam
      ? !!(currentPlayer && currentPlayer.id === userId)
      : room.turn === mySymbol;

    if (isTeam && currentPlayer) {
      const you = currentPlayer.id === userId ? " (tú)" : "";
      els.statusLine.textContent =
        "Turno de " + (currentPlayer.name || "?") + you +
        " · Equipo " + (currentPlayer.team === "blue" ? "Azul" : "Rojo");
    } else {
      els.statusLine.textContent = myTurn ? "Tu turno" : "Turno del rival";
    }

    startTimerFor(
      room.turnStartedAt,
      myTurn,
      () => skipTurn(code, mySymbol, userId)
    );

  }

}

els.leaveBtn.addEventListener(
  "click",
  () => {

    // En torneo no se puede salir de la partida
    if (activeTournamentId || (window.__lastRoomTournamentId)) {
      showToast("En partidas de torneo no puedes salir. Si abandonas (cerrar pestaña), serás vetado 10 min y el rival ganará.");
      return;
    }

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

function renderBoard(
  board,
  winningLine,
  locked,
  onCellClick,
  xColor,
  oColor,
  mode = "1v1"
) {

  els.board.innerHTML = "";

  const cfg = getModeConfig(mode);
  const size = cfg.size;
  els.board.style.gridTemplateColumns = "repeat(" + size + ", 1fr)";
  els.board.dataset.size = String(size);

  // Smaller cells for bigger boards
  if (size >= 7) {
    els.board.classList.add("board-large");
    els.board.classList.remove("board-medium");
  } else if (size >= 5) {
    els.board.classList.add("board-medium");
    els.board.classList.remove("board-large");
  } else {
    els.board.classList.remove("board-medium", "board-large");
  }

  board.forEach(
    (value, index) => {

      const btn =
        document.createElement(
          "button"
        );

      const classes =
        ["cell"];

      if (value) {
        classes.push("filled");
      }

      const isWinCell =
        winningLine &&
        winningLine.includes(index);

      if (isWinCell) {
        classes.push("win");
      }

      btn.className = classes.join(" ");
      btn.textContent = value || "";

      if (!isWinCell) {
        if (value === "X" && xColor) {
          btn.style.color = xColor;
        } else if (value === "O" && oColor) {
          btn.style.color = oColor;
        }
      }

      btn.disabled = !!value || locked;

      btn.addEventListener(
        "click",
        () => onCellClick(index)
      );

      els.board.appendChild(btn);
    }
  );
}
