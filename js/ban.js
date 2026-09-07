import { db } from "./firebase.js";
import {
  ref,
  get,
  onValue,
  off
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

// IMPORTANTE: los baneos viven en /bans/{uid}, un nodo APARTE de
// /users/{uid} — a propósito. La regla de seguridad bloquea CUALQUIER
// escritura desde el navegador (ver database.rules.json): banear y
// desbanear se hace desde la consola de Firebase o el CLI, que se
// saltan las reglas de seguridad porque entras con tu cuenta de Google
// dueña del proyecto, no con la autenticación anónima de un jugador.
// Este archivo solo LEE el baneo, para que la propia app pueda
// detectar si el usuario que la está usando está baneado.

export function isBanActive(ban) {
  if (!ban) return false;
  if (ban.permanent) return true;
  if (ban.until && ban.until > Date.now()) return true;
  return false;
}

export async function getBan(userId) {
  const snap = await get(ref(db, "bans/" + userId));
  return snap.exists() ? snap.val() : null;
}

// Escucha en tiempo real el baneo de un usuario (para detectarlo
// mientras ya está usando la app, no solo al entrar — incluso a
// mitad de partida).
export function listenBan(userId, callback) {
  const banRef = ref(db, "bans/" + userId);
  onValue(banRef, (snap) => callback(snap.exists() ? snap.val() : null));
  return () => off(banRef);
}
