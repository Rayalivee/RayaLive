import { db } from "./firebase.js";
import {
  ref,
  push,
  set,
  remove,
  onValue,
  off,
  query,
  orderByChild,
  limitToLast
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";
import { CREATOR_NAME, VIP_NAME } from "./firebase-config.js";

const SEEN_KEY = "rayalive_news_seen";

function normalize(name) {
  return (name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function canManageNews(username) {
  const n = normalize(username);
  if (!n) return false;
  const creators = [CREATOR_NAME, VIP_NAME].filter(Boolean).map(normalize);
  return creators.includes(n);
}

function loadSeenIds() {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveSeenIds(set) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...set]));
  } catch {}
}

export function getSeenIds() {
  return loadSeenIds();
}

export function markNewsSeen(ids) {
  const seen = loadSeenIds();
  ids.forEach((id) => seen.add(id));
  saveSeenIds(seen);
  return seen;
}

export function markAllSeen(items) {
  return markNewsSeen(items.map((i) => i.id));
}

export function countUnread(items) {
  const seen = loadSeenIds();
  return items.filter((i) => !seen.has(i.id)).length;
}

export function isUnread(id) {
  return !loadSeenIds().has(id);
}

/**
 * Listen to news in real time (newest first).
 * callback(items: Array<{id, title, body, createdAt, author}>)
 */
export function listenNews(callback, limit = 50) {
  const newsRef = query(ref(db, "news"), orderByChild("createdAt"), limitToLast(limit));
  const handler = (snap) => {
    const items = [];
    if (snap.exists()) {
      snap.forEach((child) => {
        const v = child.val() || {};
        items.push({
          id: child.key,
          title: v.title || "",
          body: v.body || "",
          createdAt: v.createdAt || 0,
          author: v.author || ""
        });
      });
    }
    // newest first
    items.sort((a, b) => b.createdAt - a.createdAt);
    callback(items);
  };
  onValue(newsRef, handler);
  return () => off(newsRef);
}

export async function createNews(title, body, author, userId) {
  if (!userId) throw new Error("No autenticado.");
  if (!canManageNews(author)) {
    throw new Error("No tienes permiso para publicar novedades.");
  }
  const t = (title || "").trim();
  const b = (body || "").trim();
  if (!t) throw new Error("El título no puede estar vacío.");
  if (!b) throw new Error("El mensaje no puede estar vacío.");
  if (t.length > 80) throw new Error("El título es demasiado largo (máx. 80).");
  if (b.length > 2000) throw new Error("El mensaje es demasiado largo (máx. 2000).");

  const newsRef = push(ref(db, "news"));
  await set(newsRef, {
    title: t,
    body: b,
    author: author || "",
    authorId: userId,
    createdAt: Date.now()
  });
  return newsRef.key;
}


export async function deleteNews(id, username) {
  if (!canManageNews(username)) {
    throw new Error("No tienes permiso para borrar novedades.");
  }
  if (!id) return;
  await remove(ref(db, "news/" + id));
}
