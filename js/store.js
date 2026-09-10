
import { db } from "./firebase.js";
import { ref, runTransaction } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

export const NAME_COLORS = [
  { key: "azul", label: "Azul", hex: "#2E7DD6" },
  { key: "verde", label: "Verde", hex: "#1FA774" },
  { key: "morado", label: "Morado", hex: "#8B5CF6" },
  { key: "naranja", label: "Naranja", hex: "#F2994A" },
  { key: "cian", label: "Cian", hex: "#17A2B8" },
  { key: "dorado", label: "Dorado", hex: "#C9A227" },
  { key: "rosa-hello-kitty", label: "Rosa Hello Kitty", hex: "#FF69B4" }
];

export const RANDOM_NAME_COLOR_PRICE = 12;

export const SYMBOL_COLORS = [
  { key: "sym-azul", label: "Azul", hex: "#2E7DD6", price: 8 },
  { key: "sym-verde", label: "Verde", hex: "#1FA774", price: 8 },
  { key: "sym-morado", label: "Morado", hex: "#8B5CF6", price: 12 },
  { key: "sym-naranja", label: "Naranja", hex: "#F2994A", price: 12 },
  { key: "sym-cian", label: "Cian", hex: "#17A2B8", price: 16 },
  { key: "sym-dorado", label: "Dorado", hex: "#C9A227", price: 20 }
];

export async function purchaseRandomNameColor(userId) {
  const userRef = ref(db, "users/" + userId);
  let picked = null;

  const result = await runTransaction(userRef, (user) => {
    if (!user) return user;

    user.coins = Number(user.coins) || 0;
    user.unlockedColors = user.unlockedColors || {};

    if (user.coins < RANDOM_NAME_COLOR_PRICE) return;

    const notOwned = NAME_COLORS.filter(
      (c) => !user.unlockedColors[c.key]
    );

    const pool = notOwned.length > 0 ? notOwned : NAME_COLORS;

    picked = pool[Math.floor(Math.random() * pool.length)];

    user.coins -= RANDOM_NAME_COLOR_PRICE;
    user.unlockedColors[picked.key] = true;
    user.nameColor = picked.hex;

    return user;
  });

  if (!result.committed) {
    throw new Error("No te llegan las monedas.");
  }

  return picked;
}

export async function equipNameColor(userId, hexOrEmpty) {
  const userRef = ref(db, "users/" + userId);

  await runTransaction(userRef, (user) => {
    if (!user) return user;

    const unlocked = user.unlockedColors || {};

    const owns =
      hexOrEmpty === "" ||
      Object.keys(unlocked).some(
        (key) =>
          NAME_COLORS.find((c) => c.key === key)?.hex === hexOrEmpty
      );

    if (!owns) return;

    user.nameColor = hexOrEmpty;

    return user;
  });
}

export async function purchaseSymbolColor(userId, colorKey) {
  const item = SYMBOL_COLORS.find((c) => c.key === colorKey);

  if (!item) {
    throw new Error("Ese color no existe.");
  }

  const userRef = ref(db, "users/" + userId);

  const result = await runTransaction(userRef, (user) => {
    if (!user) return user;

    user.coins = Number(user.coins) || 0;
    user.unlockedSymbolColors = user.unlockedSymbolColors || {};

    if (!user.unlockedSymbolColors[colorKey]) {
      if (user.coins < item.price) return;

      user.coins -= item.price;
      user.unlockedSymbolColors[colorKey] = true;
    }

    user.symbolColor = item.hex;

    return user;
  });

  if (!result.committed) {
    throw new Error("No te llegan las monedas.");
  }
}

export async function equipSymbolColor(userId, hexOrEmpty) {
  const userRef = ref(db, "users/" + userId);

  await runTransaction(userRef, (user) => {
    if (!user) return user;

    const unlocked = user.unlockedSymbolColors || {};

    const owns =
      hexOrEmpty === "" ||
      Object.keys(unlocked).some(
        (key) =>
          SYMBOL_COLORS.find((c) => c.key === key)?.hex === hexOrEmpty
      );

    if (!owns) return;

    user.symbolColor = hexOrEmpty;

    return user;
  });
}
