
// ============================================================
// SISTEMA DE LOGROS
// ============================================================
// Los logros se calculan automáticamente usando las estadísticas
// que ya se guardan del jugador.
//
// Para añadir un nuevo logro solo hay que añadir un objeto dentro
// de ACHIEVEMENTS. No hace falta modificar Firebase ni las reglas.
// ============================================================

const ACHIEVEMENTS = [

  // ----------------------------------------------------------
  // VICTORIAS
  // ----------------------------------------------------------

  {
    id: "primera-victoria",
    icon: "🏆",
    title: "Primera victoria",
    description: "Gana tu primera partida online.",
    check: (v) => v.wins >= 1
  },

  {
    id: "cinco-victorias",
    icon: "⭐",
    title: "Imparable",
    description: "Gana 5 partidas online.",
    check: (v) => v.wins >= 5
  },

  {
    id: "diez-victorias",
    icon: "🌟",
    title: "Veterano",
    description: "Gana 10 partidas online.",
    check: (v) => v.wins >= 10
  },

  {
    id: "veinte-victorias",
    icon: "⚡",
    title: "Máquina de ganar",
    description: "Gana 20 partidas online.",
    check: (v) => v.wins >= 20
  },

  {
    id: "cincuenta-victorias",
    icon: "💎",
    title: "Leyenda",
    description: "Gana 50 partidas online.",
    check: (v) => v.wins >= 50
  },

  {
    id: "cien-victorias",
    icon: "👑",
    title: "Campeón absoluto",
    description: "Gana 100 partidas online.",
    check: (v) => v.wins >= 100
  },


  // ----------------------------------------------------------
  // RACHA DE VICTORIAS
  // ----------------------------------------------------------

  {
    id: "racha-tres",
    icon: "🔥",
    title: "En racha",
    description: "Consigue 3 victorias seguidas.",
    check: (v) => v.bestStreak >= 3
  },

  {
    id: "racha-cinco",
    icon: "🔥",
    title: "Dominador",
    description: "Consigue 5 victorias seguidas.",
    check: (v) => v.bestStreak >= 5
  },

  {
    id: "racha-diez",
    icon: "☠️",
    title: "Invencible",
    description: "Consigue 10 victorias seguidas.",
    check: (v) => v.bestStreak >= 10
  },

  {
    id: "racha-veinte",
    icon: "👹",
    title: "Imparable",
    description: "Consigue 20 victorias seguidas.",
    check: (v) => v.bestStreak >= 20
  },


  // ----------------------------------------------------------
  // PARTIDAS JUGADAS
  // ----------------------------------------------------------

  {
    id: "jugador-dedicado",
    icon: "🎮",
    title: "Jugador dedicado",
    description: "Juega 10 partidas online.",
    check: (v) => v.gamesPlayed >= 10
  },

  {
    id: "veinticinco-partidas",
    icon: "🎯",
    title: "Jugador habitual",
    description: "Juega 25 partidas online.",
    check: (v) => v.gamesPlayed >= 25
  },

  {
    id: "cincuenta-partidas",
    icon: "🏅",
    title: "Veterano de batalla",
    description: "Juega 50 partidas online.",
    check: (v) => v.gamesPlayed >= 50
  },

  {
    id: "cien-partidas",
    icon: "💯",
    title: "Centenario",
    description: "Juega 100 partidas online.",
    check: (v) => v.gamesPlayed >= 100
  },

  {
    id: "doscientas-partidas",
    icon: "🚀",
    title: "Jugador experto",
    description: "Juega 200 partidas online.",
    check: (v) => v.gamesPlayed >= 200
  },

  {
    id: "quinientas-partidas",
    icon: "🏆",
    title: "Veterano",
    description: "Juega 500 partidas online.",
    check: (v) => v.gamesPlayed >= 500
  },

  {
    id: "mil-partidas",
    icon: "👑",
    title: "Maestro del juego",
    description: "Juega 1000 partidas online.",
    check: (v) => v.gamesPlayed >= 1000
  },


  // ----------------------------------------------------------
  // EMPATES
  // ----------------------------------------------------------

  {
    id: "primer-empate",
    icon: "🤝",
    title: "Tablas",
    description: "Consigue tu primer empate.",
    check: (v) => v.draws >= 1
  },

  {
    id: "cinco-empates",
    icon: "⚖️",
    title: "Equilibrio",
    description: "Consigue 5 empates.",
    check: (v) => v.draws >= 5
  },

  {
    id: "diez-empates",
    icon: "⚖️",
    title: "Equilibrio perfecto",
    description: "Consigue 10 empates.",
    check: (v) => v.draws >= 10
  },


  // ----------------------------------------------------------
  // DERROTAS
  // ----------------------------------------------------------

  {
    id: "primera-derrota",
    icon: "💀",
    title: "Primera derrota",
    description: "Pierde tu primera partida.",
    check: (v) => v.losses >= 1
  },

  {
    id: "diez-derrotas",
    icon: "😵",
    title: "Caer para levantarse",
    description: "Pierde 10 partidas.",
    check: (v) => v.losses >= 10
  },

  {
    id: "cincuenta-derrotas",
    icon: "💀",
    title: "Superviviente",
    description: "Pierde 50 partidas.",
    check: (v) => v.losses >= 50
  },


  // ----------------------------------------------------------
  // LOGROS ESPECIALES BASADOS EN ESTADÍSTICAS
  // ----------------------------------------------------------

  {
    id: "diez-a-cero",
    icon: "🔥",
    title: "Racha perfecta",
    description: "Gana al menos 10 partidas sin perder ninguna.",
    check: (v) => v.wins >= 10 && v.losses === 0
  },

  {
    id: "veinte-victorias-mas",
    icon: "💪",
    title: "Gran campeón",
    description: "Consigue al menos 20 victorias.",
    check: (v) => v.wins >= 20
  },

  {
    id: "cincuenta-victorias-mas",
    icon: "💎",
    title: "Élite",
    description: "Consigue al menos 50 victorias.",
    check: (v) => v.wins >= 50
  },

  {
    id: "cien-victorias-mas",
    icon: "👑",
    title: "GOAT",
    description: "Consigue al menos 100 victorias.",
    check: (v) => v.wins >= 100
  },

  {
    id: "cincuenta-partidas-sin-empate",
    icon: "⚔️",
    title: "Sin tregua",
    description: "Juega 50 partidas sin conseguir ningún empate.",
    check: (v) => v.gamesPlayed >= 50 && v.draws === 0
  },

  {
    id: "todo-un-poco",
    icon: "🎲",
    title: "Todo un poco",
    description: "Consigue al menos una victoria, una derrota y un empate.",
    check: (v) =>
      v.wins >= 1 &&
      v.losses >= 1 &&
      v.draws >= 1
  }

];


// ============================================================
// TOTAL DE LOGROS
// ============================================================

export const TOTAL_ACHIEVEMENTS = ACHIEVEMENTS.length;


// ============================================================
// CONVERTIR ESTADÍSTICAS A VALORES
// ============================================================

export function statsToValues(stats = {}) {

  const wins = stats.wins || 0;
  const losses = stats.losses || 0;
  const draws = stats.draws || 0;

  return {
    wins,
    losses,
    draws,

    // Las partidas jugadas se calculan automáticamente.
    gamesPlayed: wins + losses + draws,

    // Mejor racha guardada en las estadísticas.
    bestStreak: stats.bestStreak || 0
  };
}


// ============================================================
// OBTENER RESUMEN DE LOGROS
// ============================================================
// Devuelve todos los logros y si están desbloqueados o no.
// ============================================================

export function getSummary(stats = {}) {

  const values = statsToValues(stats);

  const items = ACHIEVEMENTS.map((achievement) => ({

    id: achievement.id,

    icon: achievement.icon,

    title: achievement.title,

    description: achievement.description,

    unlocked: achievement.check(values)

  }));

  const totalUnlocked = items.filter(
    (item) => item.unlocked
  ).length;

  return {

    totalUnlocked,

    totalCount: ACHIEVEMENTS.length,

    items

  };
}


// ============================================================
// DETECTAR LOGROS RECIÉN DESBLOQUEADOS
// ============================================================
// Compara las estadísticas antiguas con las nuevas.
// Solo devuelve los logros que hayan pasado de bloqueados
// a desbloqueados.
// ============================================================

export function getNewlyUnlocked(oldStats = {}, newStats = {}) {

  const oldValues = statsToValues(oldStats);

  const newValues = statsToValues(newStats);

  const unlocked = [];

  for (const achievement of ACHIEVEMENTS) {

    const wasUnlocked = achievement.check(oldValues);

    const isUnlocked = achievement.check(newValues);

    if (!wasUnlocked && isUnlocked) {

      unlocked.push({

        icon: achievement.icon,

        title: achievement.title

      });

    }

  }

  return unlocked;
}
