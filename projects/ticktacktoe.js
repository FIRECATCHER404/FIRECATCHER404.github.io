import { chooseAIMove, getResult } from "./ticktacktoe-core.js";

const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");
const menuEl = document.getElementById("menu");
const actionsEl = document.getElementById("game-actions");
const newRoundEl = document.getElementById("new-round");
let board = Array(9).fill("");
let mode = "menu";
let phase = "menu";
let symbol = "X";
let turn = "X";
let pending = false;
let generation = 0;
let aiTimer;
let session = null;

const cells = Array.from({ length: 9 }, (_, index) => {
  const cell = document.createElement("button");
  cell.type = "button";
  cell.className = "cell";
  cell.addEventListener("click", () => playCell(index));
  boardEl.appendChild(cell);
  return cell;
});

function render() {
  const result = getResult(board);
  const canPlay = phase === "playing" && turn === symbol && !pending && !result;
  menuEl.hidden = mode !== "menu";
  boardEl.hidden = mode === "menu";
  actionsEl.hidden = mode === "menu";
  newRoundEl.hidden = mode === "online" && !["ended", "error"].includes(phase);
  newRoundEl.textContent = mode === "ai" ? "New round" : phase === "error" ? "Try again" : "Find another game";
  cells.forEach((cell, index) => {
    cell.textContent = board[index];
    cell.dataset.symbol = board[index];
    cell.disabled = !canPlay || Boolean(board[index]);
    cell.classList.toggle("win", Boolean(result?.line.includes(index)));
    cell.setAttribute("aria-label", `Row ${Math.floor(index / 3) + 1}, column ${index % 3 + 1}: ${board[index] || "empty"}`);
  });
}

function leaveGame() {
  generation += 1;
  clearTimeout(aiTimer);
  session?.close();
  session = null;
  pending = false;
  return generation;
}

function startAI() {
  leaveGame();
  board = Array(9).fill("");
  mode = "ai";
  phase = "playing";
  symbol = "X";
  turn = "X";
  statusEl.textContent = "You are X. Your turn.";
  render();
}

function finishRound() {
  const result = getResult(board);
  if (!result) return false;
  phase = "ended";
  statusEl.textContent = result.winner === "draw" ? "It's a draw!" : result.winner === symbol ? "You win!" : mode === "ai" ? "The computer wins!" : "Your opponent wins!";
  return true;
}

async function playCell(index) {
  if (phase !== "playing" || turn !== symbol || pending || board[index] || getResult(board)) return;
  if (mode === "online") {
    const token = generation;
    pending = true;
    render();
    try {
      await session.move(index);
    } catch (error) {
      if (token === generation) onlineError(error);
    } finally {
      if (token === generation) {
        pending = false;
        render();
      }
    }
    return;
  }
  board[index] = "X";
  if (finishRound()) {
    render();
    return;
  }
  turn = "O";
  statusEl.textContent = "Computer is thinking...";
  render();
  const token = generation;
  aiTimer = setTimeout(() => {
    if (generation !== token || mode !== "ai" || phase !== "playing") return;
    const move = chooseAIMove(board);
    if (move !== null) board[move] = "O";
    turn = "X";
    if (!finishRound()) statusEl.textContent = "You are X. Your turn.";
    render();
  }, 300);
}

function onlineError(error) {
  session?.close();
  session = null;
  phase = "error";
  pending = false;
  statusEl.textContent = error.code === "no-opponent"
    ? "No opponent found. Try again, or play against the computer."
    : "Online play couldn't connect. Try again, or go back and play vs AI.";
  console.error("Tic-tac-toe online:", error);
  render();
}

async function withTimeout(promise, milliseconds) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Connection timed out")), milliseconds); })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function startOnline() {
  const token = leaveGame();
  mode = "online";
  phase = "waiting";
  board = Array(9).fill("");
  statusEl.textContent = "Finding an opponent...";
  render();
  try {
    // The computer game works even when Firebase or the internet is unavailable.
    const { createOnlineGame } = await withTimeout(import("./ticktacktoe-online.js"), 10000);
    if (token !== generation) return;
    session = createOnlineGame({
      onState(state) {
        if (token !== generation || phase === "error") return;
        board = state.board;
        symbol = state.symbol;
        turn = state.turn;
        if (finishRound()) {
          render();
          return;
        }
        if (state.status === "waiting") {
          phase = "waiting";
          statusEl.textContent = "You are X. Waiting for an opponent...";
        } else if (!state.opponentConnected) {
          phase = "ended";
          statusEl.textContent = "Your opponent left the game. Find another game to play again.";
        } else {
          phase = "playing";
          statusEl.textContent = `You are ${symbol}. ${turn === symbol ? "Your turn." : "Opponent's turn."}`;
        }
        render();
      },
      onError(error) {
        if (token === generation && phase !== "ended") onlineError(error);
      }
    });
    await withTimeout(session.start(), 12000);
  } catch (error) {
    if (token === generation && phase !== "error") onlineError(error);
  }
}

document.getElementById("play-ai").addEventListener("click", startAI);
document.getElementById("play-online").addEventListener("click", startOnline);
newRoundEl.addEventListener("click", () => mode === "ai" ? startAI() : startOnline());
function showMenu() {
  leaveGame();
  mode = "menu";
  phase = "menu";
  board = Array(9).fill("");
  statusEl.textContent = "Choose a game to get started.";
  render();
}
document.getElementById("change-mode").addEventListener("click", showMenu);
window.addEventListener("pagehide", showMenu);
render();
