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

// Inicia sesión anónima con Firebase Auth. El usuario no ve ni escribe
// nada (no hay formulario de login), pero a partir de aquí su ID es un
// UID real emitido y verificado por Firebase (auth.uid), no un simple
// string inventado en el navegador. Esto es lo que permite que las
// reglas de seguridad puedan comprobar de verdad "quién eres".
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

// Normaliza un nombre para comparar sin distinguir mayúsculas, acentos
// ni espacios repetidos: "Pedro", "pedro" y "PEDRO " cuentan como el
// mismo nombre a efectos de unicidad (aunque se muestre con su
// mayúscula/minúscula original).
export function normalizeName(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Reserva un nombre en exclusiva para este usuario usando /usernames/{clave}
// como índice de unicidad, protegido por la regla de seguridad (nadie
// puede escribir en la clave de otra persona). Si ya lo tiene otra
// persona, lanza un error legible para mostrar en el formulario.
export async function claimUsername(userId, rawName) {
  const name = (rawName || "").trim().slice(0, 20);
  if (!name) throw new Error("Escribe un nombre.");
  const key = normalizeName(name);
  if (!key) throw new Error("Escribe un nombre válido.");

  const claimRef = ref(db, "usernames/" + key);
  const result = await runTransaction(claimRef, (current) => {
    if (current === null) return userId; // libre: lo reclamo
    if (current === userId) return current; // ya era mío: sin cambios
    return; // ocupado por otra persona: abortar la transacción
  });

  if (!result.committed) {
    throw new Error("Ese nombre ya lo está usando otra persona.");
  }

  // Si venía de cambiar de nombre, libero la clave anterior.
  const prevKey = localStorage.getItem(NAME_KEY_NORMALIZED);
  if (prevKey && prevKey !== key) {
    remove(ref(db, "usernames/" + prevKey)).catch(() => {});
  }

  localStorage.setItem(NAME_KEY, name);
  localStorage.setItem(NAME_KEY_NORMALIZED, key);
  return name;
}

// IP pública informativa (ver limitaciones en el README). Solo se usa
// para mostrarla en el panel de admin, nunca como identificador único.
export async function fetchIP() {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const data = await res.json();
    return data.ip || "desconocida";
  } catch (e) {
    return "desconocida";
  }
}

// update() solo toca los campos indicados: no borra streak/wins/losses
// que ya existan en users/{uid}.
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
