import { db } from "./firebase.js";
import {
  ref,
  runTransaction,
  get
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

export const COINS_PER_WIN = 2;

export async function recordMyResult(userId, outcome) {

  if (!userId) {
    throw new Error("userId no válido");
  }

  if (!["win", "loss", "draw"].includes(outcome)) {
    throw new Error("Resultado no válido: " + outcome);
  }

  const userRef =
    ref(db, "users/" + userId);

  const result =
    await runTransaction(
      userRef,
      (user) => {

        if (!user) {
          return user;
        }

        user.wins =
          Number(user.wins) || 0;

        user.losses =
          Number(user.losses) || 0;

        user.draws =
          Number(user.draws) || 0;

        user.streak =
          Number(user.streak) || 0;

        user.bestStreak =
          Number(user.bestStreak) || 0;

        user.coins =
          Number(user.coins) || 0;

        if (outcome === "win") {

          user.wins += 1;

          user.streak += 1;

          user.coins += COINS_PER_WIN;

          if (
            user.streak >
            user.bestStreak
          ) {

            user.bestStreak =
              user.streak;

          }

        }

        else if (outcome === "loss") {

          user.losses += 1;

          user.streak = 0;

        }

        else if (outcome === "draw") {

          user.draws += 1;

        }

        return user;

      }
    );

  if (!result.committed) {

    return null;

  }

  const value =
    result.snapshot.val();

  return normalizeStats(value);

}

function normalizeStats(value = {}) {

  return {

    wins:
      Number(value.wins) || 0,

    losses:
      Number(value.losses) || 0,

    draws:
      Number(value.draws) || 0,

    streak:
      Number(value.streak) || 0,

    bestStreak:
      Number(value.bestStreak) || 0,

    coins:
      Number(value.coins) || 0,

    nameColor:
      typeof value.nameColor === "string" ? value.nameColor : "",

    unlockedColors:
      value.unlockedColors && typeof value.unlockedColors === "object"
        ? value.unlockedColors
        : {},

    symbolColor:
      typeof value.symbolColor === "string" ? value.symbolColor : "",

    unlockedSymbolColors:
      value.unlockedSymbolColors && typeof value.unlockedSymbolColors === "object"
        ? value.unlockedSymbolColors
        : {}

  };

}

export async function getStreak(id) {

  if (!id) {
    return 0;
  }

  const snap =
    await get(
      ref(
        db,
        "users/" +
        id +
        "/streak"
      )
    );

  if (!snap.exists()) {
    return 0;
  }

  return Number(
    snap.val()
  ) || 0;

}

export async function resetMyStreak(
  userId
) {

  if (!userId) {
    return;
  }

  const userRef =
    ref(
      db,
      "users/" + userId
    );

  await runTransaction(
    userRef,
    (user) => {

      if (!user) {
        return user;
      }

      user.streak = 0;

      return user;

    }
  );

}

export async function getUserStats(
  id
) {

  if (!id) {

    return normalizeStats();

  }

  const snap =
    await get(
      ref(
        db,
        "users/" + id
      )
    );

  if (!snap.exists()) {

    return normalizeStats();

  }

  return normalizeStats(
    snap.val()
  );

}

export async function getTopStreaks(
  limit = 50
) {

  const snap =
    await get(
      ref(
        db,
        "users"
      )
    );

  if (!snap.exists()) {
    return [];
  }

  const data =
    snap.val();

  const users =
    Object.entries(data)

      .map(
        ([id, user]) => {

          if (
            !user ||
            !user.name
          ) {

            return null;

          }

          return {

            id,

            name:
              user.name,

            wins:
              Number(user.wins) || 0,

            losses:
              Number(user.losses) || 0,

            draws:
              Number(user.draws) || 0,

            streak:
              Number(user.streak) || 0,

            bestStreak:
              Number(user.bestStreak) || 0,

            nameColor:
              typeof user.nameColor === "string" ? user.nameColor : ""

          };

        }
      )

      .filter(Boolean);

  users.sort(
    (a, b) => {

      const winsDifference =
        b.wins -
        a.wins;

      if (
        winsDifference !== 0
      ) {

        return winsDifference;

      }

      const streakDifference =
        b.streak -
        a.streak;

      if (
        streakDifference !== 0
      ) {

        return streakDifference;

      }

      return (
        b.bestStreak -
        a.bestStreak
      );

    }
  );

  return users.slice(
    0,
    limit
  );

}
