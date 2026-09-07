import { db } from "./firebase.js";
import {
  ref,
  runTransaction,
  set,
  remove,
  onValue,
  off,
  onDisconnect
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";
import { generateRoomCode, emptyBoard } from "./rooms.js";

const waitingRef = ref(db, "matchmaking/waiting");

// Intenta emparejar a este usuario:
// - Si había alguien más esperando, se crea la sala directamente con
//   los dos jugadores y se devuelve { status: "matched", code }.
// - Si no había nadie, este usuario se queda anotado como el que espera
//   y se devuelve { status: "waiting" }; hay que escuchar con
//   listenForMatch() para saber cuándo lo emparejan.
export async function findMatch(userId, username) {
  let matchedWith = null;

  await runTransaction(waitingRef, (current) => {
    if (!current || current.id === userId) {
      matchedWith = null;
      return { id: userId, name: username, ts: Date.now() };
    }
    matchedWith = current;
    return null; // libero el hueco: lo voy a emparejar yo mismo
  });

  if (matchedWith) {
    const code = await createMatchedRoom(matchedWith, { id: userId, name: username });
    await set(ref(db, "matchmaking/matches/" + matchedWith.id), { code, ts: Date.now() });
    return { status: "matched", code };
  }

  // Si me quedo esperando y cierro la pestaña, que no quede "fantasma".
  onDisconnect(waitingRef).remove();
  return { status: "waiting" };
}

async function createMatchedRoom(playerXInfo, playerOInfo) {
  const code = await generateRoomCode();
  await set(ref(db, "rooms/" + code), {
    status: "playing",
    board: emptyBoard(),
    turn: "X",
    playerX: { id: playerXInfo.id, name: playerXInfo.name },
    playerO: { id: playerOInfo.id, name: playerOInfo.name },
    winner: "",
    winningLine: null,
    rematchRequestedBy: "",
    createdAt: Date.now(),
    turnStartedAt: Date.now(),
    matchmade: true
  });
  return code;
}

export function listenForMatch(userId, callback) {
  const matchRef = ref(db, "matchmaking/matches/" + userId);
  onValue(matchRef, (snap) => {
    if (snap.exists()) callback(snap.val());
  });
  return () => off(matchRef);
}

export async function clearMatchNotification(userId) {
  await remove(ref(db, "matchmaking/matches/" + userId));
}

export async function cancelSearch(userId) {
  await runTransaction(waitingRef, (current) => {
    if (current && current.id === userId) return null;
    return current;
  });
}
