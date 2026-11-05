const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];
const wrap = (value, limit) => ((value % limit) + limit) % limit;

export class AntWorld {
  constructor(columns, rows, onFlip = () => {}) {
    this.columns = columns;
    this.rows = rows;
    this.black = new Set();
    this.ants = [];
    this.steps = 0;
    this.onFlip = onFlip;
  }

  addAnt(x, y, direction = 0) {
    const ant = { x: wrap(x, this.columns), y: wrap(y, this.rows), direction: wrap(direction, 4) };
    this.ants.push(ant);
    return ant;
  }

  step(ticks = 1) {
    for (let tick = 0; tick < ticks; tick += 1) {
      for (const ant of this.ants) {
        const key = ant.y * this.columns + ant.x;
        const wasBlack = this.black.has(key);
        ant.direction = (ant.direction + (wasBlack ? 3 : 1)) % 4;
        if (wasBlack) this.black.delete(key);
        else this.black.add(key);
        this.onFlip(ant.x, ant.y, !wasBlack);
        ant.x = wrap(ant.x + DX[ant.direction], this.columns);
        ant.y = wrap(ant.y + DY[ant.direction], this.rows);
        this.steps += 1;
      }
    }
  }

  resize(columns, rows) {
    const black = new Set();
    for (const key of this.black) {
      const x = key % this.columns;
      const y = Math.floor(key / this.columns);
      if (x < columns && y < rows) black.add(y * columns + x);
    }
    this.columns = columns;
    this.rows = rows;
    this.black = black;
    for (const ant of this.ants) {
      ant.x = wrap(ant.x, columns);
      ant.y = wrap(ant.y, rows);
    }
  }
}
