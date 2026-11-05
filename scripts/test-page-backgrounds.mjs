import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../assets/backgrounds/ant-core.js", import.meta.url), "utf8");
const { AntWorld } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

const changes = [];
const world = new AntWorld(12, 12, (...change) => changes.push(change));
world.addAnt(5, 5);
for (const [x, y, direction, black] of [[6, 5, 1, 1], [6, 6, 2, 2], [5, 6, 3, 3], [5, 5, 0, 4], [4, 5, 3, 3]]) {
  world.step();
  assert.deepEqual(world.ants[0], { x, y, direction });
  assert.equal(world.black.size, black);
}
assert.deepEqual(changes[0], [5, 5, true], "White cells turn right and become black");
assert.deepEqual(changes[4], [5, 5, false], "Black cells turn left and become white");
assert.equal(world.steps, 5);

world.resize(8, 8);
assert.deepEqual([...world.black].sort(), [5 * 8 + 6, 6 * 8 + 5, 6 * 8 + 6].sort());
assert.deepEqual(world.ants[0], { x: 4, y: 5, direction: 3 });
world.resize(4, 4);
assert.equal(world.black.size, 0);
assert.deepEqual(world.ants[0], { x: 0, y: 1, direction: 3 });

const edges = new AntWorld(5, 5);
edges.addAnt(4, 2);
edges.step();
assert.deepEqual(edges.ants[0], { x: 0, y: 2, direction: 1 }, "Ants wrap at the world edge");

const shared = new AntWorld(10, 10);
shared.addAnt(5, 5);
shared.addAnt(5, 5);
shared.step();
assert.equal(shared.steps, 2);
assert.equal(shared.black.size, 0, "Two ants flip the same shared cell twice");
assert.deepEqual(shared.ants, [{ x: 6, y: 5, direction: 1 }, { x: 4, y: 5, direction: 3 }]);
console.log("PASS Langton rules, first five steps, cell colours, shared-ant state, wrapping, and resize preservation.");
