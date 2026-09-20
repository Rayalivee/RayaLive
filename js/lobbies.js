import { db } from "./firebase.js";
import {
  ref,
  set,
  update,
  remove,
  onValue,
  off,
  get,
  push,
  onDisconnect
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

/** Party sizes */
export const PARTY_MODES = {
  SOLO: { size: 1, label: "SOLO" },
  DUO: { size: 2, label: "DUO" },
  TRIO: { size: 3, label: "TRIO" },
  SQUAD: { size: 4, label: "SQUAD" }
};

/**
 * lobbies/{id} = {
 *   hostId, hostName, mode, maxSize, members: { uid: { name, joinedAt } },
 *   status: "open" | "closed", createdAt
 * }
 * lobbyInvites/{toUid}/{inviteId} = {
 *   lobbyId, fromId, fromName, mode, ts
 * }
 */

export function listenLobby(lobbyId, callback) {
  const r = ref(db, "lobbies/" + lobbyId);
  onValue(r, (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    const v = snap.val();
    callback({
      id: lobbyId,
      hostId: v.hostId,
      hostName: v.hostName || "",
      mode: v.mode || "DUO",
      maxSize: Number(v.maxSize) || 2,
      members: v.members || {},
      status: v.status || "open",
      createdAt: v.createdAt || 0,
      playSignal: v.playSignal || null,
      cancelSignal: v.cancelSignal || null,
      searching: !!v.searching
    });
  });
  return () => off(r);
}

export function listenLobbyInvites(userId, callback) {
  const r = ref(db, "lobbyInvites/" + userId);
  onValue(r, (snap) => {
    const list = [];
    if (snap.exists()) {
      snap.forEach((c) => {
        const v = c.val() || {};
        list.push({
          id: c.key,
          lobbyId: v.lobbyId,
          fromId: v.fromId,
          fromName: v.fromName || "Jugador",
          mode: v.mode || "DUO",
          ts: v.ts || 0
        });
      });
    }
    list.sort((a, b) => b.ts - a.ts);
    callback(list);
  });
  return () => off(r);
}

export async function createLobby(userId, username, mode = "DUO") {
  const cfg = PARTY_MODES[mode] || PARTY_MODES.DUO;
  const lobbyRef = push(ref(db, "lobbies"));
  const id = lobbyRef.key;
  const data = {
    hostId: userId,
    hostName: username || "Jugador",
    mode,
    maxSize: cfg.size,
    members: {
      [userId]: { name: username || "Jugador", joinedAt: Date.now() }
    },
    status: "open",
    createdAt: Date.now()
  };
  await set(lobbyRef, data);
  return id;
}

export async function inviteToLobby(lobbyId, fromId, fromName, toId, mode) {
  if (!lobbyId || !fromId || !toId) throw new Error("Datos incompletos.");
  if (fromId === toId) throw new Error("No puedes invitarte a ti mismo.");

  const lobbySnap = await get(ref(db, "lobbies/" + lobbyId));
  if (!lobbySnap.exists()) throw new Error("La lobby ya no existe.");
  const lobby = lobbySnap.val();
  if (lobby.hostId !== fromId) throw new Error("Solo el anfitrión puede invitar.");
  const members = lobby.members || {};
  if (members[toId]) throw new Error("Esa persona ya está en la lobby.");
  if (Object.keys(members).length >= (lobby.maxSize || 2)) {
    throw new Error("La lobby está llena.");
  }

  const invRef = push(ref(db, "lobbyInvites/" + toId));
  await set(invRef, {
    lobbyId,
    fromId,
    fromName: fromName || "Jugador",
    mode: mode || lobby.mode || "DUO",
    ts: Date.now()
  });
  return invRef.key;
}

export async function acceptLobbyInvite(userId, username, inviteId, lobbyId) {
  // Remove invite
  await remove(ref(db, "lobbyInvites/" + userId + "/" + inviteId));

  const lobbySnap = await get(ref(db, "lobbies/" + lobbyId));
  if (!lobbySnap.exists()) throw new Error("La lobby ya no existe.");
  const lobby = lobbySnap.val();
  if (lobby.status !== "open") throw new Error("La lobby está cerrada.");
  const members = lobby.members || {};
  if (members[userId]) return lobbyId;
  if (Object.keys(members).length >= (lobby.maxSize || 2)) {
    throw new Error("La lobby está llena.");
  }

  await set(ref(db, "lobbies/" + lobbyId + "/members/" + userId), {
    name: username || "Jugador",
    joinedAt: Date.now()
  });
  return lobbyId;
}

export async function declineLobbyInvite(userId, inviteId) {
  await remove(ref(db, "lobbyInvites/" + userId + "/" + inviteId));
}

export async function leaveLobby(lobbyId, userId) {
  const snap = await get(ref(db, "lobbies/" + lobbyId));
  if (!snap.exists()) return;
  const lobby = snap.val();
  if (lobby.hostId === userId) {
    // Host leaves → dissolve lobby
    await remove(ref(db, "lobbies/" + lobbyId));
  } else {
    await remove(ref(db, "lobbies/" + lobbyId + "/members/" + userId));
  }
}

export async function setLobbyMode(lobbyId, hostId, mode) {
  const cfg = PARTY_MODES[mode];
  if (!cfg) throw new Error("Modo no válido.");
  const snap = await get(ref(db, "lobbies/" + lobbyId));
  if (!snap.exists()) throw new Error("Lobby no encontrada.");
  if (snap.val().hostId !== hostId) throw new Error("Solo el anfitrión.");
  await update(ref(db, "lobbies/" + lobbyId), {
    mode,
    maxSize: cfg.size
  });
}

export function memberList(lobby) {
  if (!lobby || !lobby.members) return [];
  return Object.entries(lobby.members).map(([id, m]) => ({
    id,
    name: m.name || "Jugador",
    joinedAt: m.joinedAt || 0,
    isHost: id === lobby.hostId
  }));
}


export async function requestLobbyPlay(lobbyId, byId, byName, gameMode) {
  const snap = await get(ref(db, "lobbies/" + lobbyId));
  if (!snap.exists()) throw new Error("Lobby no encontrada.");
  const lobby = snap.val();
  if (!lobby.members || !lobby.members[byId]) {
    throw new Error("No estás en esta lobby.");
  }
  // Escribir cada campo en su ruta (las reglas permiten a cualquier miembro)
  const base = "lobbies/" + lobbyId;
  await update(ref(db), {
    [base + "/searching"]: true,
    [base + "/playSignal"]: {
      gameMode: gameMode || "1v1",
      ts: Date.now(),
      by: byId,
      byName: byName || "Jugador"
    },
    [base + "/cancelSignal"]: null
  });
}

export async function clearLobbyPlaySignal(lobbyId) {
  const base = "lobbies/" + lobbyId;
  await update(ref(db), {
    [base + "/searching"]: false,
    [base + "/playSignal"]: null,
    [base + "/cancelSignal"]: null
  });
}

/** Pide cancelar el emparejamiento a toda la lobby (cualquier miembro) */
export async function requestLobbyCancel(lobbyId, byId, byName) {
  await set(ref(db, "lobbies/" + lobbyId + "/cancelSignal"), {
    by: byId,
    byName: byName || "Jugador",
    ts: Date.now()
  });
}

/** Confirma cancelación: todos salen de la búsqueda */
export async function confirmLobbyCancel(lobbyId) {
  const base = "lobbies/" + lobbyId;
  await update(ref(db), {
    [base + "/searching"]: false,
    [base + "/playSignal"]: null,
    [base + "/cancelSignal"]: null
  });
}

/** Rechaza la petición de cancelar (sigue buscando) */
export async function rejectLobbyCancel(lobbyId) {
  await set(ref(db, "lobbies/" + lobbyId + "/cancelSignal"), null);
}
