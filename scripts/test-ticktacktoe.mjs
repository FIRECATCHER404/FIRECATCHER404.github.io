import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../projects/ticktacktoe-core.js", import.meta.url), "utf8");
const { WIN_LINES, getResult, decodeBoard, chooseAIMove } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

for (const symbol of ["X", "O"]) {
  for (const line of WIN_LINES) {
    const board = Array(9).fill("");
    line.forEach(index => { board[index] = symbol; });
    assert.deepEqual(getResult(board), { winner: symbol, line });
  }
}
assert.equal(getResult(Array(9).fill("")), null);
assert.equal(getResult(decodeBoard("XOXXOOOXX")).winner, "draw");
assert.throws(() => decodeBoard("bad board"));
assert.throws(() => decodeBoard(null));
assert.equal(chooseAIMove(decodeBoard("OO.XX.X..")), 2, "Take the winning move");
assert.equal(chooseAIMove(decodeBoard("XX..O....")), 2, "Block a human win");
assert.equal(chooseAIMove(decodeBoard("XXXOO....")), null, "Never move after a win");
assert.equal(chooseAIMove(decodeBoard("XOXXOOOXX")), null, "Never move on a full board");

let games = 0;
function exploreHumanMoves(board) {
  for (let index = 0; index < 9; index += 1) {
    if (board[index]) continue;
    const position = board.slice();
    position[index] = "X";
    const humanResult = getResult(position);
    assert.notEqual(humanResult?.winner, "X", "The AI must cover every human winning line and fork");
    if (humanResult) { games += 1; continue; }
    const original = position.slice();
    const reply = chooseAIMove(position);
    assert.deepEqual(position, original, "Planning must not mutate the live board");
    assert.ok(Number.isInteger(reply) && reply >= 0 && reply < 9 && !position[reply], "The AI replies on an empty square");
    position[reply] = "O";
    if (getResult(position)) games += 1;
    else exploreHumanMoves(position);
  }
}
exploreHumanMoves(Array(9).fill(""));
console.log(`PASS: all winning lines, draws, invalid boards, immediate wins, blocking, and ${games} complete human-vs-AI games.`);
