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

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const TURN_SECONDS = 20;

/** Board size and win length per mode */
export const MODE_CONFIG = {
  "1v1": { size: 3, winLength: 3, players: 2 },
  "2v2": { size: 5, winLength: 4, players: 4 },
  "3v3": { size: 7, winLength: 5, players: 6 },
  "4v4": { size: 9, winLength: 5, players: 8 }
};

export function getModeConfig(mode) {
  return MODE_CONFIG[mode] || MODE_CONFIG["1v1"];
}

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

/** Classic 3x3 lines kept for AI / fallback */
export const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

export function emptyBoard(mode = "1v1") {
  const { size } = getModeConfig(mode);
  return Array(size * size).fill("");
}

/**
 * Check winner on a square board of any size.
 * Returns { winner, line } or null.
 */
export function checkWinner(board, mode = "1v1") {
  const { size, winLength } = getModeConfig(mode);
  if (!board || board.length !== size * size) {
    // fallback classic 3x3
    for (const [a, b, c] of LINES) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return { winner: board[a], line: [a, b, c] };
      }
    }
    return null;
  }

  const directions = [
    [0, 1],   // horizontal
    [1, 0],   // vertical
    [1, 1],   // diagonal \
    [1, -1]   // diagonal /
  ];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const start = board[r * size + c];
      if (!start) continue;

      for (const [dr, dc] of directions) {
        const line = [r * size + c];
        let ok = true;
        for (let k = 1; k < winLength; k++) {
          const nr = r + dr * k;
          const nc = c + dc * k;
          if (nr < 0 || nr >= size || nc < 0 || nc >= size) {
            ok = false;
            break;
          }
          const idx = nr * size + nc;
          if (board[idx] !== start) {
            ok = false;
            break;
          }
          line.push(idx);
        }
        if (ok) return { winner: start, line };
      }
    }
  }
  return null;
}

/**
 * Build ordered turn list alternating teams:
 * blue[0], red[0], blue[1], red[1], ...
 */
export function buildTurnOrder(blue, red) {
  const order = [];
  const max = Math.max(blue.length, red.length);
  for (let i = 0; i < max; i++) {
    if (blue[i]) order.push({ ...blue[i], team: "blue", symbol: "X" });
    if (red[i]) order.push({ ...red[i], team: "red", symbol: "O" });
  }
  return order;
}

export function getCurrentTurnPlayer(room) {
  if (!room) return null;
  // Classic 1v1 without teams
  if (!room.teams || room.mode === "1v1") {
    if (room.turn === "X") return room.playerX ? { ...room.playerX, symbol: "X", team: "blue" } : null;
    return room.playerO ? { ...room.playerO, symbol: "O", team: "red" } : null;
  }
  const order = room.turnOrder || buildTurnOrder(room.teams.blue || [], room.teams.red || []);
  if (!order.length) return null;
  const idx = typeof room.turnIndex === "number" ? room.turnIndex % order.length : 0;
  return order[idx];
}

export async function createRoom(userId, username, mode = "1v1") {
  const code = await generateRoomCode();
  const cfg = getModeConfig(mode);
  const room = {
    status: "waiting",
    board: emptyBoard(mode),
    turn: "X",
    playerX: { id: userId, name: username },
    playerO: null,
    winner: "",
    winningLine: null,
    rematchRequestedBy: "",
    createdAt: Date.now(),
    turnStartedAt: Date.now(),
    createdBy: userId,
    mode,
    boardSize: cfg.size,
    winLength: cfg.winLength
  };
  if (mode !== "1v1") {
    room.teams = {
      blue: [{ id: userId, name: username }],
      red: []
    };
    room.turnOrder = buildTurnOrder(room.teams.blue, room.teams.red);
    room.turnIndex = 0;
    room.status = "lobby";
  }
  await set(ref(db, "rooms/" + code), room);
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

  // Already in the room
  if (isX || isO) return code;

  // Team modes: add to the team with fewer players
  if (room.mode && room.mode !== "1v1" && room.teams) {
    const blue = room.teams.blue || [];
    const red = room.teams.red || [];
    const needed = getModeConfig(room.mode).players;
    if (blue.length + red.length >= needed) {
      throw new Error("La sala ya está completa.");
    }
    // Check not already listed
    if ([...blue, ...red].some((p) => p.id === userId)) return code;

    const addToBlue = blue.length <= red.length;
    const newBlue = addToBlue ? [...blue, { id: userId, name: username }] : blue;
    const newRed = addToBlue ? red : [...red, { id: userId, name: username }];
    const turnOrder = buildTurnOrder(newBlue, newRed);
    const total = newBlue.length + newRed.length;
    const updates = {
      teams: { blue: newBlue, red: newRed },
      turnOrder,
      // Keep first of each team as playerX / playerO for compatibility
      playerX: newBlue[0] || room.playerX,
      playerO: newRed[0] || null
    };
    if (total >= needed) {
      updates.status = "playing";
      updates.turnIndex = 0;
      updates.turn = "X";
      updates.turnStartedAt = Date.now();
    }
    await update(roomRef, updates);
    return code;
  }

  // Classic 1v1
  if (room.playerO) throw new Error("La sala ya está completa.");
  await update(roomRef, {
    playerO: { id: userId, name: username },
    status: "playing",
    turnStartedAt: Date.now()
  });
  return code;
}

export function listenRoom(code, callback) {
  const roomRef = ref(db, "rooms/" + code);
  onValue(roomRef, (snap) => callback(snap.val()));
  return () => off(roomRef);
}

/**
 * Make a move. For team modes, `playerId` is required so we verify
 * it's that player's turn. Symbol is still X/O by team.
 */
export async function makeMove(code, index, symbol, playerId = null) {
  const roomRef = ref(db, "rooms/" + code);
  await runTransaction(roomRef, (room) => {
    if (!room) return room;
    if (room.winner) return room;
    if (!room.board || room.board[index] !== "") return room;

    const mode = room.mode || "1v1";
    const isTeam = mode !== "1v1" && room.teams;

    if (isTeam) {
      const order = room.turnOrder || buildTurnOrder(room.teams.blue || [], room.teams.red || []);
      if (!order.length) return room;
      const idx = typeof room.turnIndex === "number" ? room.turnIndex % order.length : 0;
      const current = order[idx];
      if (!current) return room;
      if (playerId && current.id !== playerId) return room;
      // Use the current player's team symbol
      symbol = current.symbol;
    } else {
      if (room.turn !== symbol) return room;
    }

    room.board[index] = symbol;
    const result = checkWinner(room.board, mode);
    if (result) {
      room.winner = result.winner;
      room.winningLine = result.line;
      room.status = "finished";
    } else if (!room.board.includes("")) {
      // Torneo: no empates → muerte súbita (tablero nuevo, sigue la partida)
      if (room.tournamentId) {
        room.board = emptyBoard(mode);
        room.winner = "";
        room.winningLine = null;
        room.status = "playing";
        if (isTeam) {
          const order = room.turnOrder || buildTurnOrder(room.teams.blue || [], room.teams.red || []);
          room.turnIndex = ((typeof room.turnIndex === "number" ? room.turnIndex : 0) + 1) % (order.length || 1);
          const next = order[room.turnIndex];
          room.turn = next ? next.symbol : (symbol === "X" ? "O" : "X");
        } else {
          room.turn = symbol === "X" ? "O" : "X";
        }
        room.turnStartedAt = Date.now();
        room.suddenDeath = true;
      } else {
        room.winner = "draw";
        room.status = "finished";
      }
    } else {
      if (isTeam) {
        const order = room.turnOrder || buildTurnOrder(room.teams.blue || [], room.teams.red || []);
        room.turnIndex = ((typeof room.turnIndex === "number" ? room.turnIndex : 0) + 1) % order.length;
        const next = order[room.turnIndex];
        room.turn = next ? next.symbol : (symbol === "X" ? "O" : "X");
      } else {
        room.turn = symbol === "X" ? "O" : "X";
      }
      room.turnStartedAt = Date.now();
    }
    return room;
  });
}

export async function skipTurn(code, symbol, playerId = null) {
  const roomRef = ref(db, "rooms/" + code);
  await runTransaction(roomRef, (room) => {
    if (!room) return room;
    if (room.winner) return room;

    const mode = room.mode || "1v1";
    const isTeam = mode !== "1v1" && room.teams;

    if (isTeam) {
      const order = room.turnOrder || buildTurnOrder(room.teams.blue || [], room.teams.red || []);
      if (!order.length) return room;
      const idx = typeof room.turnIndex === "number" ? room.turnIndex % order.length : 0;
      const current = order[idx];
      if (playerId && current && current.id !== playerId) return room;
      room.turnIndex = (idx + 1) % order.length;
      const next = order[room.turnIndex];
      room.turn = next ? next.symbol : (symbol === "X" ? "O" : "X");
    } else {
      if (room.turn !== symbol) return room;
      room.turn = symbol === "X" ? "O" : "X";
    }
    room.turnStartedAt = Date.now();
    return room;
  });
}

export async function resetRoom(code, mode = "1v1") {
  const roomSnap = await get(ref(db, "rooms/" + code));
  const existing = roomSnap.exists() ? roomSnap.val() : null;
  const m = (existing && existing.mode) || mode;
  const updates = {
    board: emptyBoard(m),
    turn: "X",
    turnIndex: 0,
    winner: "",
    winningLine: null,
    status: "playing",
    turnStartedAt: Date.now(),
    rematchRequestedBy: "",
    statsApplied: null
  };
  if (existing && existing.teams) {
    updates.turnOrder = buildTurnOrder(
      existing.teams.blue || [],
      existing.teams.red || []
    );
  }
  await update(ref(db, "rooms/" + code), updates);
}

export async function requestRematch(code, symbol) {
  await update(ref(db, "rooms/" + code), { rematchRequestedBy: symbol });
}

export async function declineRematch(code) {
  await update(ref(db, "rooms/" + code), { status: "declined" });
}

export async function markPlayerBanned(code) {
  await update(ref(db, "rooms/" + code), { status: "player-banned" });
}

export async function deleteRoom(code) {
  await remove(ref(db, "rooms/" + code));
}

export function armRoomAutoCleanup(code) {
  const handle = onDisconnect(ref(db, "rooms/" + code));
  handle.remove();
  return handle;
}
