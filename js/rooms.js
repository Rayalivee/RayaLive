import { db } from "./firebase.js";
import {
  ref,
  set,
  get,
  update,
  onValue,
  off,
  runTransaction,
  remove,
  onDisconnect
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin O/0/I/1

export const TURN_SECONDS = 20;

function randomCode(length = 5) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export async function generateRoomCode() {
  let code;
  for (let attempt = 0; attempt < 10; attempt++) {
    code = randomCode();
    const snap = await get(ref(db, "rooms/" + code));
    if (!snap.exists()) break;
  }
  return code;
}

export const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

// Casillas vacías = "" (nunca null: Firebase elimina los null al guardar).
export function emptyBoard() {
  return Array(9).fill("");
}

export function checkWinner(board) {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: [a, b, c] };
    }
  }
  return null;
}

export async function createRoom(userId, username) {
  const code = await generateRoomCode();
  await set(ref(db, "rooms/" + code), {
    status: "waiting",
    board: emptyBoard(),
    turn: "X",
    playerX: { id: userId, name: username },
    playerO: null,
    winner: "",
    winningLine: null,
    rematchRequestedBy: "",
    createdAt: Date.now(),
    turnStartedAt: Date.now(),
    createdBy: userId
  });
  return code;
}

export async function joinRoom(rawCode, userId, username) {
  const code = rawCode.toUpperCase().trim();
  const roomRef = ref(db, "rooms/" + code);
  const snap = await get(roomRef);
  if (!snap.exists()) throw new Error("Esa sala no existe.");
  const room = snap.val();

  const isX = room.playerX && room.playerX.id === userId;
  const isO = room.playerO && room.playerO.id === userId;

  if (!isX && !isO) {
    if (room.playerO) throw new Error("La sala ya está completa.");
    await update(roomRef, {
      playerO: { id: userId, name: username },
      status: "playing",
      turnStartedAt: Date.now()
    });
  }
  return code;
}

export function listenRoom(code, callback) {
  const roomRef = ref(db, "rooms/" + code);
  onValue(roomRef, (snap) => callback(snap.val()));
  return () => off(roomRef);
}

export async function makeMove(code, index, symbol) {
  const roomRef = ref(db, "rooms/" + code);
  await runTransaction(roomRef, (room) => {
    if (!room) return room;
    if (room.winner) return room;
    if (room.board[index] !== "") return room;
    if (room.turn !== symbol) return room;

    room.board[index] = symbol;
    const result = checkWinner(room.board);
    if (result) {
      room.winner = result.winner;
      room.winningLine = result.line;
      room.status = "finished";
    } else if (!room.board.includes("")) {
      room.winner = "draw";
      room.status = "finished";
    } else {
      room.turn = symbol === "X" ? "O" : "X";
      room.turnStartedAt = Date.now();
    }
    return room;
  });
}

export async function skipTurn(code, symbol) {
  const roomRef = ref(db, "rooms/" + code);
  await runTransaction(roomRef, (room) => {
    if (!room) return room;
    if (room.winner) return room;
    if (room.turn !== symbol) return room;
    room.turn = symbol === "X" ? "O" : "X";
    room.turnStartedAt = Date.now();
    return room;
  });
}

export async function resetRoom(code) {
  await update(ref(db, "rooms/" + code), {
    board: emptyBoard(),
    turn: "X",
    winner: "",
    winningLine: null,
    status: "playing",
    turnStartedAt: Date.now(),
    rematchRequestedBy: "",
    statsApplied: null
  });
}

// El ganador o el perdedor pide revancha: queda anotado en la sala para
// que el rival lo vea (símbolo "X" u "O" de quien la pide).
export async function requestRematch(code, symbol) {
  await update(ref(db, "rooms/" + code), { rematchRequestedBy: symbol });
}

// El rival la rechaza: marcamos la sala como "declined" un instante
// (para que ambos clientes puedan mostrar el aviso) y luego se borra.
export async function declineRematch(code) {
  await update(ref(db, "rooms/" + code), { status: "declined" });
}

// Cuando un jugador que está en esta sala acaba de ser baneado: se
// marca la sala un instante (para que el rival vea el aviso) y luego
// se borra, igual que con una revancha rechazada.
export async function markPlayerBanned(code) {
  await update(ref(db, "rooms/" + code), { status: "player-banned" });
}

export async function deleteRoom(code) {
  await remove(ref(db, "rooms/" + code));
}

// Si el creador de una sala se desconecta mientras sigue en estado
// "waiting" (nadie se ha unido todavía), Firebase borra la sala solo.
// Cuando alguien se une, el que llama debe cancelar este handle
// (handle.cancel()) porque ya hay una partida real en marcha.
export function armRoomAutoCleanup(code) {
  const handle = onDisconnect(ref(db, "rooms/" + code));
  handle.remove();
  return handle;
}
