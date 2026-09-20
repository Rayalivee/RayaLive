import { db } from "./firebase.js";
import {
  ref,
  push,
  set,
  update,
  remove,
  onValue,
  off,
  get,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";
import { CREATOR_NAME, VIP_NAME } from "./firebase-config.js";
import {
  generateRoomCode,
  emptyBoard,
  getModeConfig,
  buildTurnOrder
} from "./rooms.js";

function normalize(name) {
  return (name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function canManageTournaments(username) {
  const n = normalize(username);
  if (!n) return false;
  const creators = [CREATOR_NAME, VIP_NAME].filter(Boolean).map(normalize);
  return creators.includes(n);
}

export const TOURNAMENT_STATUSES = {
  upcoming: "Próximamente",
  open: "Inscripciones abiertas",
  live: "En curso",
  finished: "Finalizado",
  cancelled: "Cancelado"
};

export const TOURNAMENT_ABANDON_BAN_MS = 10 * 60 * 1000;
export const TOURNAMENT_ABANDON_WIN_POINTS = 3;

/** endAt válido solo si es timestamp en ms razonable (> año 2020) */
export function isValidEndAt(endAt) {
  const n = Number(endAt) || 0;
  return n > 1577836800000;
}

const MODE_TEAM_SIZE = {
  SOLO: 1,
  "1v1": 1,
  DUO: 2,
  "2v2": 2,
  TRIO: 3,
  "3v3": 3,
  SQUAD: 4,
  "4v4": 4
};

export function listenTournaments(callback) {
  const tRef = ref(db, "tournaments");
  const handler = (snap) => {
    const list = [];
    if (snap.exists()) {
      snap.forEach((child) => {
        const v = child.val() || {};
        // Ignorar nodos basura sin título (bug de escrituras incompletas)
        if (!(v.title && String(v.title).trim())) return;
        list.push(normalizeTournament(child.key, v));
      });
    }
    list.sort((a, b) => (a.startAt || 0) - (b.startAt || 0));
    callback(list);
  };
  onValue(tRef, handler);
  return () => off(tRef);
}

export async function getTournament(id) {
  if (!id) return null;
  const snap = await get(ref(db, "tournaments/" + id));
  if (!snap.exists()) return null;
  return normalizeTournament(id, snap.val());
}

export function listenTournament(id, callback) {
  const tRef = ref(db, "tournaments/" + id);
  const handler = (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    callback(normalizeTournament(snap.key, snap.val()));
  };
  onValue(tRef, handler);
  return () => off(tRef);
}

function normalizeTournament(id, v) {
  return {
    id,
    title: v.title || "",
    description: v.description || "",
    prize: v.prize || "",
    startAt: Number(v.startAt) || 0,
    endAt: Number(v.endAt) || 0,
    status: v.status || "upcoming",
    minWins: Number(v.minWins) || 0,
    minStreak: Number(v.minStreak) || 0,
    maxPlayers: Number(v.maxPlayers) || 32,
    mode: v.mode || "SOLO",
    teamBased: !!v.teamBased,
    scheduleStart: v.scheduleStart !== false,
    maxGames: Number(v.maxGames) || 0,
    inviteOnly: !!v.inviteOnly,
    invited: v.invited || {},
    createdBy: v.createdBy || "",
    createdAt: Number(v.createdAt) || 0,
    players: v.players || {},
    penalties: v.penalties || {}
  };
}

export function getLeaderboard(tournament) {
  if (!tournament || !tournament.players) return [];
  return Object.entries(tournament.players)
    .map(([uid, p]) => ({
      id: uid,
      name: p.name || "Jugador",
      wins: Number(p.wins) || 0,
      losses: Number(p.losses) || 0,
      draws: Number(p.draws) || 0,
      points: Number(p.points) || 0,
      gamesPlayed: Number(p.gamesPlayed) || 0,
      joinedAt: Number(p.joinedAt) || 0
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.joinedAt - b.joinedAt;
    });
}

export function playerCount(tournament) {
  if (!tournament || !tournament.players) return 0;
  return Object.keys(tournament.players).length;
}

export function isJoined(tournament, userId) {
  if (!tournament || !tournament.players || !userId) return false;
  const p = tournament.players[userId];
  // null / undefined = no inscrito (tras desinscribirse)
  return !!(p && typeof p === "object");
}

export function isInvitedToTournament(tournament, userId) {
  if (!tournament || !tournament.inviteOnly) return true;
  return !!(tournament.invited && tournament.invited[userId]);
}

export function canJoin(tournament, userId, stats) {
  if (!tournament || !userId) return { ok: false, reason: "No autenticado." };
  if (tournament.status === "finished" || tournament.status === "cancelled") {
    return { ok: false, reason: "El torneo ha terminado. No te puedes inscribir." };
  }
  // Se puede inscribir en open, upcoming y live (no en finished/cancelled)
  if (
    tournament.status !== "open" &&
    tournament.status !== "upcoming" &&
    tournament.status !== "live"
  ) {
    return { ok: false, reason: "Las inscripciones no están abiertas." };
  }
  if (isValidEndAt(tournament.endAt) && Date.now() >= Number(tournament.endAt)) {
    return { ok: false, reason: "El torneo ya ha finalizado (hora de fin alcanzada)." };
  }
  if (isJoined(tournament, userId)) {
    return { ok: false, reason: "Ya estás inscrito." };
  }
  if (tournament.inviteOnly) {
    const invited = tournament.invited || {};
    if (!invited[userId]) {
      return {
        ok: false,
        reason: "No estás en la lista de invitados de este torneo. No puedes entrar."
      };
    }
  }
  const count = playerCount(tournament);
  if (count >= (tournament.maxPlayers || 32)) {
    return { ok: false, reason: "El torneo está completo." };
  }
  const wins = Number(stats && stats.wins) || 0;
  const streak = Number(stats && stats.streak) || 0;
  if (wins < (tournament.minWins || 0)) {
    return {
      ok: false,
      reason: "Necesitas al menos " + tournament.minWins + " victorias (tienes " + wins + ")."
    };
  }
  if (streak < (tournament.minStreak || 0)) {
    return {
      ok: false,
      reason: "Necesitas una racha de al menos " + tournament.minStreak + " (tienes " + streak + ")."
    };
  }
  return { ok: true };
}

export async function createTournament(data, userId, username) {
  if (!canManageTournaments(username)) {
    throw new Error("No tienes permiso para crear torneos.");
  }
  if (!userId) throw new Error("No autenticado.");

  const title = (data.title || "").trim();
  if (!title || title.length < 2) throw new Error("El título es obligatorio (mín. 2 caracteres).");
  if (title.length > 80) throw new Error("Título demasiado largo.");

  const startAt = Number(data.startAt);
  if (!startAt || isNaN(startAt)) throw new Error("Fecha/hora de inicio no válida.");

  let status =
    data.status === "finished" || data.status === "cancelled"
      ? "open"
      : data.status || "open";

  const scheduleStart = data.scheduleStart !== false;
  // Si está programado y aún no es la hora → solo inscripciones
  if (scheduleStart && startAt > Date.now()) {
    status = "upcoming";
  }

  const payload = {
    title,
    description: (data.description || "").trim().slice(0, 500),
    prize: (data.prize || "").trim().slice(0, 200),
    startAt,
    endAt: isValidEndAt(data.endAt) ? Number(data.endAt) : 0,
    status,
    minWins: Math.max(0, Number(data.minWins) || 0),
    minStreak: Math.max(0, Number(data.minStreak) || 0),
    maxPlayers: Math.min(128, Math.max(2, Number(data.maxPlayers) || 32)),
    mode: data.mode || "SOLO",
    teamBased: !!data.teamBased,
    scheduleStart,
    maxGames: data.limitGames
      ? Math.max(1, Math.min(500, Number(data.maxGames) || 20))
      : 0,
    inviteOnly: !!data.inviteOnly,
    invited: data.inviteOnly && data.invited ? data.invited : {},
    createdBy: userId,
    createdAt: Date.now(),
    players: {}
  };

  const tRef = push(ref(db, "tournaments"));
  await set(tRef, payload);
  return tRef.key;
}

export async function updateTournament(id, updates, username) {
  if (!canManageTournaments(username)) {
    throw new Error("No tienes permiso para editar torneos.");
  }
  if (!id) throw new Error("ID no válido.");

  const allowed = {};
  if (updates.title != null) allowed.title = String(updates.title).trim().slice(0, 80);
  if (updates.description != null) {
    allowed.description = String(updates.description).trim().slice(0, 500);
  }
  if (updates.prize != null) allowed.prize = String(updates.prize).trim().slice(0, 200);
  if (updates.startAt != null) allowed.startAt = Number(updates.startAt) || 0;
  if (updates.endAt != null) allowed.endAt = Number(updates.endAt) || 0;
  if (updates.status != null) allowed.status = updates.status;
  if (updates.minWins != null) allowed.minWins = Math.max(0, Number(updates.minWins) || 0);
  if (updates.minStreak != null) {
    allowed.minStreak = Math.max(0, Number(updates.minStreak) || 0);
  }
  if (updates.maxPlayers != null) {
    allowed.maxPlayers = Math.min(128, Math.max(2, Number(updates.maxPlayers) || 32));
  }
  if (updates.mode != null) allowed.mode = updates.mode;
  if (updates.teamBased != null) allowed.teamBased = !!updates.teamBased;
  if (updates.scheduleStart != null) allowed.scheduleStart = !!updates.scheduleStart;
  if (updates.maxGames != null) allowed.maxGames = Math.max(0, Number(updates.maxGames) || 0);
  if (updates.inviteOnly != null) allowed.inviteOnly = !!updates.inviteOnly;
  if (updates.invited != null) allowed.invited = updates.invited || {};

  await update(ref(db, "tournaments/" + id), allowed);
}

export async function deleteTournament(id, username) {
  if (!canManageTournaments(username)) {
    throw new Error("No tienes permiso para borrar torneos.");
  }
  if (!id) return;
  await remove(ref(db, "tournaments/" + id));
}

export async function joinTournament(id, userId, username, stats) {
  if (!id || !userId) throw new Error("Datos incompletos.");

  const snap = await get(ref(db, "tournaments/" + id));
  if (!snap.exists()) throw new Error("Ese torneo no existe.");
  const t = normalizeTournament(id, snap.val());

  if (isTournamentClosed(t)) {
    throw new Error("El torneo ha terminado. No te puedes inscribir.");
  }
  const check = canJoin(t, userId, stats);
  if (!check.ok) throw new Error(check.reason);

  await set(ref(db, "tournaments/" + id + "/players/" + userId), {
    name: username || "Jugador",
    joinedAt: Date.now(),
    wins: 0,
    losses: 0,
    draws: 0,
    points: 0,
    gamesPlayed: 0
  });
}

export async function leaveTournament(id, userId) {
  if (!id || !userId) return;
  const snap = await get(ref(db, "tournaments/" + id));
  if (!snap.exists()) return;
  const t = snap.val();
  if (t.status === "finished" || t.status === "cancelled") {
    throw new Error("El torneo ha terminado. No puedes desinscribirte.");
  }
  if (isValidEndAt(t.endAt) && Date.now() >= Number(t.endAt)) {
    throw new Error("El torneo ha terminado. No puedes desinscribirte.");
  }
  await remove(ref(db, "tournaments/" + id + "/players/" + userId));
  // Asegurar que no quede residuo
  await set(ref(db, "tournaments/" + id + "/players/" + userId), null).catch(() => {});
}

export async function maybeAutoFinishTournament(tournament, username) {
  if (!tournament || !tournament.id) return false;
  if (tournament.status === "finished" || tournament.status === "cancelled") return false;
  if (!isValidEndAt(tournament.endAt)) return false;
  const endAt = Number(tournament.endAt);
  if (Date.now() < endAt) return false;
  try {
    await set(ref(db, "tournaments/" + tournament.id + "/status"), "finished");
    return true;
  } catch (e) {
    console.warn("auto-finish", e);
    return false;
  }
}

/** Inicia el torneo cuando llega startAt (si scheduleStart está activo).
 *  Cualquier usuario logueado puede disparar el cambio (reglas Firebase lo permiten).
 */
export async function maybeAutoStartTournament(tournament, username) {
  if (!tournament || !tournament.id) return false;
  if (tournament.status === "finished" || tournament.status === "cancelled") return false;
  if (tournament.status === "live") return false;

  const schedule = tournament.scheduleStart !== false;
  if (!schedule) return false;

  const startAt = Number(tournament.startAt) || 0;
  if (!startAt) return false;

  // Aún no es la hora → solo el admin fuerza "upcoming"
  if (Date.now() < startAt) {
    if (tournament.status !== "upcoming" && canManageTournaments(username)) {
      try {
        await set(ref(db, "tournaments/" + tournament.id + "/status"), "upcoming");
      } catch (e) {}
    }
    return false;
  }

  // Llegó la hora → pasar a live (cualquier cliente autenticado)
  if (tournament.status === "upcoming" || tournament.status === "open") {
    try {
      await set(ref(db, "tournaments/" + tournament.id + "/status"), "live");
      return true;
    } catch (e) {
      console.warn("auto-start", e);
      return false;
    }
  }
  return false;
}

export function isTournamentClosed(tournament) {
  if (!tournament) return true;
  if (tournament.status === "finished" || tournament.status === "cancelled") return true;
  if (isValidEndAt(tournament.endAt) && Date.now() >= Number(tournament.endAt)) return true;
  return false;
}

/** ¿Se puede jugar ahora? (no solo inscribirse) */
export function canPlayInTournament(tournament) {
  if (!tournament) return { ok: false, reason: "Torneo no encontrado." };
  if (isTournamentClosed(tournament)) {
    return { ok: false, reason: "El torneo ha finalizado." };
  }
  const schedule = tournament.scheduleStart !== false;
  const startAt = Number(tournament.startAt) || 0;
  if (schedule && startAt && Date.now() < startAt) {
    return {
      ok: false,
      reason:
        "El torneo aún no ha empezado. Solo inscripciones hasta " +
        new Date(startAt).toLocaleString("es-ES") +
        "."
    };
  }
  if (tournament.status === "upcoming") {
    return {
      ok: false,
      reason: "El torneo está en Próximamente. Espera a la hora de inicio."
    };
  }
  if (tournament.status !== "live" && tournament.status !== "open") {
    return { ok: false, reason: "El torneo no está en curso." };
  }
  return { ok: true };
}

export function playerGamesPlayed(tournament, userId) {
  if (!tournament || !tournament.players || !tournament.players[userId]) return 0;
  return Number(tournament.players[userId].gamesPlayed) || 0;
}

export function canPlayMoreGames(tournament, userId) {
  const max = Number(tournament && tournament.maxGames) || 0;
  if (!max) return { ok: true };
  const played = playerGamesPlayed(tournament, userId);
  if (played >= max) {
    return {
      ok: false,
      reason:
        "Has alcanzado el límite de " +
        max +
        " partidas en este torneo (" +
        played +
        "/" +
        max +
        ")."
    };
  }
  return { ok: true, played, max };
}

export async function setPlayerScore(tournamentId, playerId, score, username) {
  if (!canManageTournaments(username)) {
    throw new Error("No tienes permiso.");
  }
  const updates = {};
  if (score.wins != null) updates["players/" + playerId + "/wins"] = Number(score.wins) || 0;
  if (score.losses != null) {
    updates["players/" + playerId + "/losses"] = Number(score.losses) || 0;
  }
  if (score.draws != null) updates["players/" + playerId + "/draws"] = Number(score.draws) || 0;
  if (score.points != null) {
    updates["players/" + playerId + "/points"] = Number(score.points) || 0;
  }
  if (score.gamesPlayed != null) {
    updates["players/" + playerId + "/gamesPlayed"] = Number(score.gamesPlayed) || 0;
  }
  await update(ref(db, "tournaments/" + tournamentId), updates);
}

export function formatTournamentDate(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString("es-ES", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "—";
  }
}

export async function assertNotPenalized(tournamentId, userId) {
  const snap = await get(ref(db, "tournaments/" + tournamentId + "/penalties/" + userId));
  if (!snap.exists()) return;
  const p = snap.val() || {};
  const until = Number(p.until) || 0;
  if (until > Date.now()) {
    const mins = Math.ceil((until - Date.now()) / 60000);
    throw new Error(
      "Estás vetado de este torneo por abandonar una partida. Vuelve en " + mins + " min."
    );
  }
}

export async function getPenalty(tournamentId, userId) {
  const snap = await get(ref(db, "tournaments/" + tournamentId + "/penalties/" + userId));
  if (!snap.exists()) return null;
  const p = snap.val() || {};
  const until = Number(p.until) || 0;
  if (until <= Date.now()) return null;
  return {
    until,
    reason: p.reason || "abandon",
    minutesLeft: Math.ceil((until - Date.now()) / 60000)
  };
}

export async function findTournamentMatch(tournamentId, userId, username) {
  if (!tournamentId || !userId) throw new Error("Datos incompletos.");

  const tSnap = await get(ref(db, "tournaments/" + tournamentId));
  if (!tSnap.exists()) throw new Error("Torneo no encontrado.");
  const t = tSnap.val();
  if (t.status === "finished" || t.status === "cancelled") {
    throw new Error("El torneo ha finalizado.");
  }
  if (isValidEndAt(t.endAt) && Date.now() >= Number(t.endAt)) {
    throw new Error("El torneo ha finalizado (hora de fin alcanzada).");
  }
  if (!t.players || !t.players[userId]) {
    throw new Error("Debes estar inscrito en el torneo.");
  }
  await assertNotPenalized(tournamentId, userId);

  const tNorm = normalizeTournament(tournamentId, t);
  const playCheck = canPlayInTournament(tNorm);
  if (!playCheck.ok) throw new Error(playCheck.reason);
  const gamesCheck = canPlayMoreGames(tNorm, userId);
  if (!gamesCheck.ok) throw new Error(gamesCheck.reason);

  const mode = t.mode || "SOLO";
  const teamSize = MODE_TEAM_SIZE[mode] || 1;

  if (teamSize === 1) {
    return findSoloMatch(tournamentId, userId, username);
  }
  return findTeamMatch(tournamentId, userId, username, teamSize);
}

async function findSoloMatch(tournamentId, userId, username) {
  const queueRef = ref(db, "tournaments/" + tournamentId + "/queue");
  // Último rival: preferir otro si hay
  let lastOpp = null;
  try {
    const lastSnap = await get(
      ref(db, "tournaments/" + tournamentId + "/lastOpponent/" + userId)
    );
    if (lastSnap.exists()) lastOpp = lastSnap.val();
  } catch (e) {}

  let matchedWith = null;

  await runTransaction(queueRef, (queue) => {
    if (!queue) {
      matchedWith = null;
      return { [userId]: { name: username, ts: Date.now() } };
    }
    const others = Object.entries(queue).filter(([id]) => id !== userId);
    if (others.length === 0) {
      matchedWith = null;
      return { ...queue, [userId]: { name: username, ts: Date.now() } };
    }
    // Preferir alguien que no sea el último rival
    let pick = others.find(([id]) => id !== lastOpp);
    if (!pick) pick = others[0];
    const [oid, oval] = pick;
    matchedWith = { id: oid, name: (oval && oval.name) || "Jugador" };
    const next = { ...queue };
    delete next[oid];
    delete next[userId];
    return Object.keys(next).length ? next : null;
  });

  if (matchedWith) {
    const code = await createTournamentRoom(
      tournamentId,
      "1v1",
      [{ id: matchedWith.id, name: matchedWith.name }],
      [{ id: userId, name: username }]
    );
    await notifyPlayers(tournamentId, [matchedWith.id], code);
    // Guardar último rival (ambos)
    try {
      await set(
        ref(db, "tournaments/" + tournamentId + "/lastOpponent/" + userId),
        matchedWith.id
      );
      await set(
        ref(db, "tournaments/" + tournamentId + "/lastOpponent/" + matchedWith.id),
        userId
      );
    } catch (e) {}
    return { status: "matched", code, phase: "game" };
  }
  return { status: "waiting", phase: "solo" };
}

async function findTeamMatch(tournamentId, userId, username, teamSize) {
  const queueRef = ref(db, "tournaments/" + tournamentId + "/queue");
  const needed = teamSize * 2;
  let formed = null;

  await runTransaction(queueRef, (queue) => {
    if (!queue) {
      return { [userId]: { name: username, ts: Date.now() } };
    }
    const next = { ...queue, [userId]: { name: username, ts: Date.now() } };
    const players = Object.entries(next)
      .map(([id, p]) => ({
        id,
        name: (p && p.name) || "Jugador",
        ts: (p && p.ts) || 0
      }))
      .sort((a, b) => a.ts - b.ts);

    if (players.length < needed) {
      return next;
    }

    const selected = players.slice(0, needed);
    const remaining = { ...next };
    selected.forEach((p) => {
      delete remaining[p.id];
    });
    formed = {
      blue: selected.slice(0, teamSize),
      red: selected.slice(teamSize, needed)
    };
    return Object.keys(remaining).length ? remaining : null;
  });

  if (formed) {
    const gameMode =
      teamSize === 2 ? "2v2" : teamSize === 3 ? "3v3" : teamSize === 4 ? "4v4" : "2v2";
    const code = await createTournamentRoom(
      tournamentId,
      gameMode,
      formed.blue,
      formed.red
    );
    const allIds = [...formed.blue, ...formed.red]
      .map((p) => p.id)
      .filter((id) => id !== userId);
    await notifyPlayers(tournamentId, allIds, code);
    return { status: "matched", code, phase: "game" };
  }

  const snap = await get(queueRef);
  const count = snap.exists() ? Object.keys(snap.val()).length : 1;
  const phase = count < teamSize ? "partner" : "opponent";
  return { status: "waiting", phase, queueCount: count, teamSize, needed };
}

async function createTournamentRoom(tournamentId, mode, blue, red) {
  const code = await generateRoomCode();
  const boardMode = mode === "1v1" ? "1v1" : mode;
  const validModes = { "1v1": 1, "2v2": 1, "3v3": 1, "4v4": 1 };
  const useMode = validModes[boardMode] ? boardMode : "2v2";
  const boardCfg = getModeConfig(useMode);

  const room = {
    status: "playing",
    board: emptyBoard(useMode),
    turn: "X",
    turnIndex: 0,
    playerX: { id: blue[0].id, name: blue[0].name },
    playerO: { id: red[0].id, name: red[0].name },
    teams: {
      blue: blue.map((p) => ({ id: p.id, name: p.name })),
      red: red.map((p) => ({ id: p.id, name: p.name }))
    },
    winner: "",
    winningLine: null,
    rematchRequestedBy: "",
    createdAt: Date.now(),
    turnStartedAt: Date.now(),
    matchmade: true,
    mode: useMode,
    boardSize: boardCfg.size,
    winLength: boardCfg.winLength,
    tournamentId,
    noLeave: true
  };

  if (useMode !== "1v1") {
    room.turnOrder = buildTurnOrder(room.teams.blue, room.teams.red);
  }

  await set(ref(db, "rooms/" + code), room);
  return code;
}

async function notifyPlayers(tournamentId, ids, code) {
  for (const id of ids) {
    await set(ref(db, "tournaments/" + tournamentId + "/matches/" + id), {
      code,
      ts: Date.now()
    });
  }
}

export function listenTournamentMatch(tournamentId, userId, callback) {
  const r = ref(db, "tournaments/" + tournamentId + "/matches/" + userId);
  onValue(r, (snap) => {
    if (snap.exists()) callback(snap.val());
  });
  return () => off(r);
}

export async function clearTournamentMatch(tournamentId, userId) {
  await remove(ref(db, "tournaments/" + tournamentId + "/matches/" + userId));
}

export async function cancelTournamentQueue(tournamentId, userId) {
  await remove(ref(db, "tournaments/" + tournamentId + "/queue/" + userId));
  await clearTournamentMatch(tournamentId, userId).catch(() => {});
}

export async function recordMyTournamentResult(tournamentId, userId, outcome) {
  if (!tournamentId || !userId) return;
  if (!["win", "loss", "draw"].includes(outcome)) return;
  const pRef = ref(db, "tournaments/" + tournamentId + "/players/" + userId);
  await runTransaction(pRef, (p) => {
    if (!p) return p;
    p.wins = Number(p.wins) || 0;
    p.losses = Number(p.losses) || 0;
    p.draws = Number(p.draws) || 0;
    p.points = Number(p.points) || 0;
    p.gamesPlayed = Number(p.gamesPlayed) || 0;
    p.gamesPlayed += 1;
    if (outcome === "win") {
      p.wins += 1;
      p.points += TOURNAMENT_ABANDON_WIN_POINTS;
    } else if (outcome === "loss") {
      p.losses += 1;
    } else {
      p.draws += 1;
      p.points += 1;
    }
    return p;
  });
}

export async function penalizeTournamentAbandon(tournamentId, leaverId, room) {
  if (!tournamentId || !leaverId) return;
  const until = Date.now() + TOURNAMENT_ABANDON_BAN_MS;
  await set(ref(db, "tournaments/" + tournamentId + "/penalties/" + leaverId), {
    until,
    reason: "abandon",
    ts: Date.now()
  });
  await recordMyTournamentResult(tournamentId, leaverId, "loss").catch(() => {});

  if (room && room.teams) {
    const blue = room.teams.blue || [];
    const red = room.teams.red || [];
    const inBlue = blue.some((p) => p.id === leaverId);
    const winners = inBlue ? red : blue;
    for (const w of winners) {
      if (w && w.id && w.id !== leaverId) {
        await recordMyTournamentResult(tournamentId, w.id, "win").catch(() => {});
      }
    }
  } else if (room) {
    const other =
      room.playerX && room.playerX.id === leaverId ? room.playerO : room.playerX;
    if (other && other.id) {
      await recordMyTournamentResult(tournamentId, other.id, "win").catch(() => {});
    }
  }
}

export async function markRoomAbandoned(code, leaverId) {
  await update(ref(db, "rooms/" + code), {
    status: "abandoned",
    abandonedBy: leaverId,
    winner: "forfeit"
  });
}

export async function recordTournamentResult(tournamentId, winnerId, loserId) {
  if (winnerId) await recordMyTournamentResult(tournamentId, winnerId, "win");
  if (loserId) await recordMyTournamentResult(tournamentId, loserId, "loss");
}


/** Guarda el tablero final de una partida de torneo para el historial */
export async function saveTournamentMatchHistory(tournamentId, room, code) {
  if (!tournamentId || !room) return;
  const winner = room.winner || "";
  if (!winner || winner === "draw") return;

  const blue = (room.teams && room.teams.blue) || (room.playerX ? [room.playerX] : []);
  const red = (room.teams && room.teams.red) || (room.playerO ? [room.playerO] : []);
  const winnerSide =
    winner === "X" ? "blue" : winner === "O" ? "red" : winner;

  const entry = {
    code: code || "",
    board: Array.isArray(room.board) ? room.board.slice() : [],
    boardSize: Number(room.boardSize) || 3,
    mode: room.mode || "1v1",
    blue: blue.map((p) => ({ id: p.id, name: p.name || "?" })),
    red: red.map((p) => ({ id: p.id, name: p.name || "?" })),
    winner: winner,
    winnerSide: winnerSide,
    finishedAt: Date.now()
  };

  const hRef = push(ref(db, "tournaments/" + tournamentId + "/history"));
  await set(hRef, entry);
  return hRef.key;
}

export async function getPlayerTournamentHistory(tournamentId, playerId) {
  const snap = await get(ref(db, "tournaments/" + tournamentId + "/history"));
  if (!snap.exists()) return [];
  const list = [];
  snap.forEach((child) => {
    const v = child.val() || {};
    const inBlue = (v.blue || []).some((p) => p.id === playerId);
    const inRed = (v.red || []).some((p) => p.id === playerId);
    if (!inBlue && !inRed) return;
    const iWon =
      (inBlue && (v.winner === "X" || v.winnerSide === "blue")) ||
      (inRed && (v.winner === "O" || v.winnerSide === "red"));
    list.push({
      id: child.key,
      ...v,
      mySide: inBlue ? "blue" : "red",
      iWon
    });
  });
  list.sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0));
  return list;
}
