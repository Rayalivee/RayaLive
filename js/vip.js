import { VIP_NAME } from "./firebase-config.js";
import { normalizeName } from "./user.js";

const vipKey = VIP_NAME ? normalizeName(VIP_NAME) : "";

// Compara sin distinguir mayúsculas/acentos, igual que la unicidad de
// nombres: así "TuNombre" y "tunombre" cuentan como el mismo.
export function isVipName(name) {
  if (!vipKey || !name) return false;
  return normalizeName(name) === vipKey;
}

// Aplica (o quita) la clase que pinta el nombre en rojo sobre
// cualquier elemento que muestre un nombre de jugador. Si no es el
// nombre VIP y se pasa un color de la tienda, se aplica ese color en
// su lugar (el rojo del VIP siempre tiene prioridad).
export function applyNameStyle(el, name, customColor) {
  if (!el) return;
  const vip = isVipName(name);
  el.classList.toggle("vip-name", vip);
  el.style.color = !vip && customColor ? customColor : "";
}
