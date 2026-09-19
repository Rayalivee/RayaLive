import { db } from "./firebase.js";
import {
  ref,
  get,
  onValue,
  off
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

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

export function listenBan(userId, callback) {
  const banRef = ref(db, "bans/" + userId);
  onValue(banRef, (snap) => callback(snap.exists() ? snap.val() : null));
  return () => off(banRef);
}
