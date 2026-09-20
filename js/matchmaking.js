import { db } from "./firebase.js";
import {
  ref,
  runTransaction,
  set,
  remove,
  onValue,
  off,
  onDisconnect,
  get,
  update,
  push
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";
import {
  generateRoomCode,
  emptyBoard,
  buildTurnOrder,
  getModeConfig
} from "./rooms.js";

export const MODE_PLAYERS = {
  "1v1": 2,
  "2v2": 4,
  "3v3": 6,
  "4v4": 8
};

function waitingRefForMode(mode) {
  return ref(db, "matchmaking/waiting/" + mode);
}

export async function findMatch(userId, username, mode = "1v1") {
  const needed = MODE_PLAYERS[mode] || 2;
  const waitingRef = waitingRefForMode(mode);

  if (mode === "1v1") {
    let matchedWith = null;

    await runTransaction(waitingRef, (current) => {
      if (!current || current.id === userId) {
        matchedWith = null;
        return { id: userId, name: username, ts: Date.now() };
      }
      matchedWith = current;
      return null;
    });

    if (matchedWith) {
      const code = await createMatchedRoom(
        matchedWith,
        { id: userId, name: username },
        mode
      );
      await set(ref(db, "matchmaking/matches/" + matchedWith.id), {
        code,
        mode,
        ts: Date.now()
      });
      return { status: "matched", code, mode };
    }

    onDisconnect(waitingRef).remove();
    return { status: "waiting", mode };
  }

  const queueRef = ref(db, "matchmaking/queues/" + mode);
  const playerEntry = {
    id: userId,
    name: username,
    ts: Date.now()
  };

  const myPushRef = push(queueRef);
  await set(myPushRef, playerEntry);
  onDisconnect(myPushRef).remove();

  const code = await tryFormLobby(mode, needed);
  if (code) {
    return { status: "matched", code, mode };
  }

  return { status: "waiting", mode, queueKey: myPushRef.key };
}

async function tryFormLobby(mode, needed) {
  const queueRef = ref(db, "matchmaking/queues/" + mode);

  let formed = null;

  await runTransaction(queueRef, (queue) => {
    if (!queue) return queue;
    const players = Object.entries(queue)
      .map(([key, p]) => ({ key, ...p }))
      .filter((p) => p && p.id)
      .sort((a, b) => (a.ts || 0) - (b.ts || 0));

    if (players.length < needed) return queue;

    const selected = players.slice(0, needed);
    const next = { ...queue };
    selected.forEach((p) => {
      delete next[p.key];
    });

    formed = { players: selected.map(({ id, name }) => ({ id, name })) };
    return Object.keys(next).length ? next : null;
  });

  if (formed && formed.players) {
    const code = await createTeamRoom(formed.players, mode);
    for (const p of formed.players) {
      await set(ref(db, "matchmaking/matches/" + p.id), {
        code,
        mode,
        ts: Date.now()
      });
    }
    return code;
  }
  return null;
}

async function createMatchedRoom(playerXInfo, playerOInfo, mode = "1v1") {
  const code = await generateRoomCode();
  const cfg = getModeConfig(mode);
  await set(ref(db, "rooms/" + code), {
    status: "playing",
    board: emptyBoard(mode),
    turn: "X",
    playerX: { id: playerXInfo.id, name: playerXInfo.name },
    playerO: { id: playerOInfo.id, name: playerOInfo.name },
    winner: "",
    winningLine: null,
    rematchRequestedBy: "",
    createdAt: Date.now(),
    turnStartedAt: Date.now(),
    matchmade: true,
    mode,
    boardSize: cfg.size,
    winLength: cfg.winLength
  });
  return code;
}

async function createTeamRoom(players, mode) {
  const code = await generateRoomCode();
  const cfg = getModeConfig(mode);
  const half = players.length / 2;
  const blue = players.slice(0, half);
  const red = players.slice(half);
  const turnOrder = buildTurnOrder(blue, red);

  await set(ref(db, "rooms/" + code), {
    status: "lobby",
    board: emptyBoard(mode),
    turn: "X",
    turnIndex: 0,
    turnOrder,
    playerX: { id: blue[0].id, name: blue[0].name },
    playerO: { id: red[0].id, name: red[0].name },
    teams: {
      blue: blue.map((p) => ({ id: p.id, name: p.name })),
      red: red.map((p) => ({ id: p.id, name: p.name }))
    },
    mode,
    boardSize: cfg.size,
    winLength: cfg.winLength,
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

export async function cancelSearch(userId, mode = "1v1") {
  if (mode === "1v1") {
    const waitingRef = waitingRefForMode(mode);
    await runTransaction(waitingRef, (current) => {
      if (current && current.id === userId) return null;
      return current;
    });
  } else {
    const queueRef = ref(db, "matchmaking/queues/" + mode);
    const snap = await get(queueRef);
    if (snap.exists()) {
      const queue = snap.val();
      for (const [key, p] of Object.entries(queue)) {
        if (p && p.id === userId) {
          await remove(ref(db, "matchmaking/queues/" + mode + "/" + key));
          break;
        }
      }
    }
  }
  await clearMatchNotification(userId).catch(() => {});
}

export async function startLobbyGame(code) {
  await update(ref(db, "rooms/" + code), {
    status: "playing",
    turnIndex: 0,
    turn: "X",
    turnStartedAt: Date.now()
  });
}
