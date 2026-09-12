import { db, auth } from "./firebase.js";
import {
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  ref,
  update,
  remove,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

const NAME_KEY = "rayalive_username";
const NAME_KEY_NORMALIZED = "rayalive_username_key";

let authReadyPromise = null;

export function ensureAuth() {
  if (!authReadyPromise) {
    authReadyPromise = new Promise((resolve, reject) => {
      const unsubscribe = onAuthStateChanged(
        auth,
        (user) => {
          if (user) {
            unsubscribe();
            resolve(user.uid);
          } else {
            signInAnonymously(auth).catch((err) => {
              unsubscribe();
              reject(err);
            });
          }
        },
        (err) => reject(err)
      );
    });
  }
  return authReadyPromise;
}

export function getUsername() {
  return localStorage.getItem(NAME_KEY) || "";
}

export function normalizeName(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export async function claimUsername(userId, rawName) {
  const name = (rawName || "").trim().slice(0, 20);
  if (!name) throw new Error("Escribe un nombre.");
  const key = normalizeName(name);
  if (!key) throw new Error("Escribe un nombre válido.");

  const claimRef = ref(db, "usernames/" + key);
  const result = await runTransaction(claimRef, (current) => {
    if (current === null) return userId;
    if (current === userId) return current;
    return;
  });

  if (!result.committed) {
    throw new Error("Ese nombre ya lo está usando otra persona.");
  }

  const prevKey = localStorage.getItem(NAME_KEY_NORMALIZED);
  if (prevKey && prevKey !== key) {
    remove(ref(db, "usernames/" + prevKey)).catch(() => {});
  }

  localStorage.setItem(NAME_KEY, name);
  localStorage.setItem(NAME_KEY_NORMALIZED, key);
  return name;
}

export async function fetchIP() {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const data = await res.json();
    return data.ip || "desconocida";
  } catch (e) {
    return "desconocida";
  }
}

export async function registerUser(userId) {
  const name = getUsername() || "Jugador";
  const ip = await fetchIP();
  await update(ref(db, "users/" + userId), {
    id: userId,
    name,
    ip,
    lastSeen: serverTimestamp()
  });
  return { id: userId, name, ip };
}
