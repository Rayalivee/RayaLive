import { VIP_NAME } from "./firebase-config.js";
import { normalizeName } from "./user.js";

const vipKey = VIP_NAME ? normalizeName(VIP_NAME) : "";

const SPECIAL_NAMES = [
  { key: normalizeName("Valeria"), hex: "#FF1493" }
];

export function isVipName(name) {
  if (!vipKey || !name) return false;
  return normalizeName(name) === vipKey;
}

export function getSpecialColor(name) {
  if (!name) return "";
  const key = normalizeName(name);
  const found = SPECIAL_NAMES.find((s) => s.key === key);
  return found ? found.hex : "";
}

export function applyNameStyle(el, name, customColor) {
  if (!el) return;
  const vip = isVipName(name);
  el.classList.toggle("vip-name", vip);

  if (vip) {
    el.style.color = "";
    return;
  }

  const special = getSpecialColor(name);
  el.style.color = special || customColor || "";
}
