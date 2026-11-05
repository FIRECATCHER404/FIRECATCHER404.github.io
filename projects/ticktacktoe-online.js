import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, onDisconnect, set, runTransaction, connectDatabaseEmulator } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { firebaseConfig } from "../message-firebase-config.js";
import { decodeBoard, getResult } from "./ticktacktoe-core.js";

const app = getApps().find(item => item.name === "tic-tac-toe") || initializeApp(firebaseConfig, "tic-tac-toe");
const db = getDatabase(app);
if (["127.0.0.1", "localhost"].includes(location.hostname) && new URLSearchParams(location.search).get("emulator") === "1") {
  connectDatabaseEmulator(db, "127.0.0.1", 9000);
}
const roomsRef = ref(db, "games/tictactoe-v2/rooms");

function waitForConnection() {
  return new Promise((resolve, reject) => {
    let unsubscribe = () => {};
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error("The game server is unavailable"));
    }, 8000);
    unsubscribe = onValue(ref(db, ".info/connected"), snapshot => {
      if (!snapshot.val()) return;
      clearTimeout(timeout);
      queueMicrotask(() => unsubscribe());
      resolve();
    }, error => {
      clearTimeout(timeout);
      unsubscribe();
      reject(error);
    });
  });
}

export function createOnlineGame({ onState, onError }) {
  const playerId = crypto.randomUUID();
  const newRoomId = crypto.randomUUID();
  let closed = false;
  let roomRef = null;
  let presenceRef = null;
  let disconnect = null;
  let unsubscribeRoom;
  let unsubscribeConnection;
  let searchTimer;
  let symbol = "X";
  let clockOffset = 0;

  function close() {
    closed = true;
    clearTimeout(searchTimer);
    unsubscribeRoom?.();
    unsubscribeConnection?.();
    // If the tab is already offline, the registered server-side action handles this.
    if (presenceRef) set(presenceRef, false).then(() => disconnect?.cancel()).catch(() => {});
  }

  async function start() {
    await waitForConnection();
    if (closed) return;
    clockOffset = await new Promise((resolve, reject) => {
      onValue(ref(db, ".info/serverTimeOffset"), snapshot => resolve(snapshot.val() || 0), reject, { onlyOnce: true });
    });
    if (closed) return;
    const now = Date.now() + clockOffset;
    // Pairing and room creation commit together, so simultaneous visitors cannot
    // claim the same opponent or observe a half-created match.
    const match = await runTransaction(roomsRef, current => {
      if (closed) return;
      const rooms = { ...(current || {}) };
      for (const [id, room] of Object.entries(rooms)) {
        const age = now - (room.updatedAt || room.createdAt || 0);
        if ((room.status === "waiting" && (age > 120000 || room.presence?.X === false)) ||
            (age > 3600000 && (room.status === "finished" || (!room.presence?.X && !room.presence?.O)))) {
          delete rooms[id];
        }
      }
      const waiting = Object.entries(rooms)
        .filter(([, room]) => room.status === "waiting" && room.presence?.X === true && room.players?.X && room.players.X !== playerId)
        .sort((a, b) => a[1].createdAt - b[1].createdAt || a[0].localeCompare(b[0]));
      if (waiting.length) {
        const [id, room] = waiting[0];
        rooms[id] = {
          ...room, status: "active", updatedAt: now,
          players: { ...room.players, O: playerId },
          presence: { X: true, O: true }
        };
      } else {
        rooms[newRoomId] = {
          board: ".........", turn: "X", status: "waiting",
          createdAt: now, updatedAt: now,
          players: { X: playerId }, presence: { X: true }
        };
      }
      return rooms;
    }, { applyLocally: false });
    if (!match.committed) return;
    const entry = Object.entries(match.snapshot.val() || {})
      .find(([, room]) => room.players?.X === playerId || room.players?.O === playerId);
    if (!entry) throw new Error("Matchmaking did not return a game");
    const [roomId, room] = entry;
    symbol = room.players.X === playerId ? "X" : "O";
    roomRef = ref(db, `games/tictactoe-v2/rooms/${roomId}`);
    presenceRef = ref(db, `games/tictactoe-v2/rooms/${roomId}/presence/${symbol}`);
    if (closed) {
      close();
      return;
    }
    disconnect = onDisconnect(presenceRef);
    await disconnect.set(false);
    if (closed) {
      close();
      return;
    }
    searchTimer = setTimeout(() => onError(Object.assign(new Error("No opponent found"), { code: "no-opponent" })), 120000);
    unsubscribeRoom = onValue(roomRef, snapshot => {
      if (closed) return;
      const data = snapshot.val();
      if (!data) {
        onError(new Error("This game is no longer available"));
        return;
      }
      if (data.status !== "waiting") clearTimeout(searchTimer);
      try {
        onState({
          board: decodeBoard(data.board), symbol, turn: data.turn,
          status: data.status,
          opponentConnected: data.presence?.[symbol === "X" ? "O" : "X"] === true
        });
      } catch (error) {
        onError(error);
      }
    }, error => { if (!closed) onError(error); });
    let connectedOnce = false;
    unsubscribeConnection = onValue(ref(db, ".info/connected"), snapshot => {
      if (snapshot.val()) connectedOnce = true;
      else if (connectedOnce && !closed) onError(new Error("Connection lost"));
    });
  }

  async function move(index) {
    if (closed || !roomRef || !Number.isInteger(index) || index < 0 || index > 8) return;
    const result = await runTransaction(roomRef, data => {
      if (closed || !data || data.status !== "active" || data.turn !== symbol ||
          data.players?.[symbol] !== playerId || data.presence?.X !== true || data.presence?.O !== true) return;
      const board = decodeBoard(data.board);
      if (board[index] || getResult(board)) return;
      board[index] = symbol;
      const result = getResult(board);
      return {
        ...data, board: board.map(cell => cell || ".").join(""),
        turn: symbol === "X" ? "O" : "X",
        status: result ? "finished" : "active", updatedAt: Date.now() + clockOffset
      };
    }, { applyLocally: false });
    if (!closed && !result.committed) throw new Error("The move was not accepted");
  }

  return { start, move, close };
}
