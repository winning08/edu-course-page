export function createBlankGrid(rows, cols) {
  return Array.from({ length: rows }, () => Array(cols).fill(0));
}

export function cloneGrid(grid) {
  return grid.map((row) => [...row]);
}

export function setCell(grid, row, col, value) {
  const next = cloneGrid(grid);
  next[row][col] = value;
  return next;
}

export function gridsEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let row = 0; row < a.length; row += 1) {
    if (a[row].length !== b[row].length) return false;
    for (let col = 0; col < a[row].length; col += 1) {
      if (a[row][col] !== b[row][col]) return false;
    }
  }
  return true;
}

export function usedColors(puzzle) {
  const colors = new Set();
  const visit = (grid) => grid.forEach((row) => row.forEach((cell) => colors.add(cell)));
  puzzle.train.forEach((pair) => {
    visit(pair.input);
    visit(pair.output);
  });
  visit(puzzle.test.input);
  visit(puzzle.test.output);
  return [...colors].sort((a, b) => a - b);
}
