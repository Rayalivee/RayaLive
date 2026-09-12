const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

function checkWinner(board) {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

function isFull(board) {
  return board.every((cell) => cell !== "");
}

function minimax(board, depth, isMaximizing, aiSymbol, humanSymbol) {
  const winner = checkWinner(board);
  if (winner === aiSymbol) return 10 - depth;
  if (winner === humanSymbol) return depth - 10;
  if (isFull(board)) return 0;

  if (isMaximizing) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === "") {
        board[i] = aiSymbol;
        best = Math.max(best, minimax(board, depth + 1, false, aiSymbol, humanSymbol));
        board[i] = "";
      }
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === "") {
        board[i] = humanSymbol;
        best = Math.min(best, minimax(board, depth + 1, true, aiSymbol, humanSymbol));
        board[i] = "";
      }
    }
    return best;
  }
}

export function getAIMove(board, aiSymbol, humanSymbol, difficulty = "imposible") {
  const empty = board.map((v, i) => (v === "" ? i : null)).filter((v) => v !== null);
  if (empty.length === 0) return null;

  if (difficulty === "facil" && Math.random() < 0.75) {
    return empty[Math.floor(Math.random() * empty.length)];
  }
  if (difficulty === "normal" && Math.random() < 0.35) {
    return empty[Math.floor(Math.random() * empty.length)];
  }

  let bestScore = -Infinity;
  let bestMove = empty[0];
  for (const i of empty) {
    board[i] = aiSymbol;
    const score = minimax(board, 0, false, aiSymbol, humanSymbol);
    board[i] = "";
    if (score > bestScore) {
      bestScore = score;
      bestMove = i;
    }
  }
  return bestMove;
}
