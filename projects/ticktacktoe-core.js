export const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

export function getResult(board) {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line };
    }
  }
  return board.every(Boolean) ? { winner: "draw", line: [] } : null;
}

export function decodeBoard(value) {
  if (typeof value !== "string" || !/^[XO.]{9}$/.test(value)) {
    throw new Error("Invalid game board");
  }
  return [...value].map(cell => cell === "." ? "" : cell);
}

export function chooseAIMove(board) {
  if (getResult(board)) return null;
  const position = board.slice();
  const order = [4, 0, 2, 6, 8, 1, 3, 5, 7];
  function score(turn, depth) {
    const result = getResult(position);
    if (result) return result.winner === "O" ? 10 - depth : result.winner === "X" ? depth - 10 : 0;
    let best = turn === "O" ? -Infinity : Infinity;
    for (const index of order) {
      if (position[index]) continue;
      position[index] = turn;
      const value = score(turn === "O" ? "X" : "O", depth + 1);
      position[index] = "";
      best = turn === "O" ? Math.max(best, value) : Math.min(best, value);
    }
    return best;
  }
  let best = -Infinity;
  let move = null;
  for (const index of order) {
    if (position[index]) continue;
    position[index] = "O";
    const value = score("X", 0);
    position[index] = "";
    if (value > best) {
      best = value;
      move = index;
    }
  }
  return move;
}
