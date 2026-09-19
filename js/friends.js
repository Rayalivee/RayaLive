import { db } from "./firebase.js";
import {
  ref,
  set,
  remove,
  onValue,
  off,
  get,
  update
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

/**
 * Structure:
 * friendRequests/{toUid}/{fromUid} = { fromName, ts }
 * friends/{uid}/{friendUid} = { name, since }
 */

export function listenFriendRequests(userId, callback) {
  const r = ref(db, "friendRequests/" + userId);
  onValue(r, (snap) => {
    const list = [];
    if (snap.exists()) {
      snap.forEach((c) => {
        const v = c.val() || {};
        list.push({
          fromId: c.key,
          fromName: v.fromName || "Jugador",
          ts: v.ts || 0
        });
      });
    }
    list.sort((a, b) => b.ts - a.ts);
    callback(list);
  });
  return () => off(r);
}

export function listenFriends(userId, callback) {
  const r = ref(db, "friends/" + userId);
  onValue(r, (snap) => {
    const list = [];
    if (snap.exists()) {
      snap.forEach((c) => {
        const v = c.val() || {};
        list.push({
          id: c.key,
          name: v.name || "Jugador",
          since: v.since || 0
        });
      });
    }
    list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    callback(list);
  });
  return () => off(r);
}

export async function sendFriendRequest(fromId, fromName, toId) {
  if (!fromId || !toId) throw new Error("Datos incompletos.");
  if (fromId === toId) throw new Error("No puedes agregarte a ti mismo.");

  // Already friends? (solo leemos TU lista — permitido por las reglas)
  const existing = await get(ref(db, "friends/" + fromId + "/" + toId));
  if (existing.exists()) throw new Error("Ya sois amigos.");

  // No leemos friendRequests del otro (eso da permission_denied).
  // Escribimos la solicitud; si ya existía, se sobrescribe con la misma info.
  await set(ref(db, "friendRequests/" + toId + "/" + fromId), {
    fromName: fromName || "Jugador",
    fromId: fromId,
    ts: Date.now()
  });
}

/** Find user by exact name via usernames index */
export async function findUserIdByName(rawName) {
  const key = (rawName || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (!key) throw new Error("Escribe un nombre.");
  const snap = await get(ref(db, "usernames/" + key));
  if (!snap.exists()) throw new Error("No hay nadie con ese nombre.");
  return snap.val();
}

export async function acceptFriendRequest(myId, myName, fromId, fromName) {
  if (!myId || !fromId) return;
  const since = Date.now();
  await update(ref(db), {
    ["friends/" + myId + "/" + fromId]: { name: fromName || "Jugador", since },
    ["friends/" + fromId + "/" + myId]: { name: myName || "Jugador", since },
    ["friendRequests/" + myId + "/" + fromId]: null
  });
}

export async function declineFriendRequest(myId, fromId) {
  if (!myId || !fromId) return;
  await remove(ref(db, "friendRequests/" + myId + "/" + fromId));
}

export async function removeFriend(myId, friendId) {
  if (!myId || !friendId) return;
  await update(ref(db), {
    ["friends/" + myId + "/" + friendId]: null,
    ["friends/" + friendId + "/" + myId]: null
  });
}
