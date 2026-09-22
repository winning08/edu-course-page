export const DATA = [
  { x: 2, y: 3, c: 0 },
  { x: 3, y: 4, c: 0 },
  { x: 4, y: 2, c: 0 },
  { x: 4, y: 5, c: 0 },
  { x: 5, y: 3, c: 0 },
  { x: 6, y: 7, c: 1 },
  { x: 7, y: 6, c: 1 },
  { x: 8, y: 7, c: 1 },
  { x: 7, y: 8, c: 1 },
  { x: 9, y: 6, c: 1 },
  { x: 5, y: 7, c: 0 },
  { x: 6, y: 4, c: 1 },
  { x: 3, y: 7, c: 0 },
  { x: 8, y: 4, c: 1 },
  { x: 5, y: 6, c: 1 },
];
export function matches(point, rule) {
  const value = rule.feature === "x" ? point.x : point.y;
  return rule.operator === "lte"
    ? value <= rule.threshold
    : value >= rule.threshold;
}
export function predict(point, rules) {
  const first = matches(point, rules.root),
    child = first ? rules.yes : rules.no;
  if (!child) return first ? 1 : 0;
  return matches(point, child) ? child.yesClass : child.noClass;
}
export function accuracy(data, rules) {
  return Math.round(
    (data.filter((point) => predict(point, rules) === point.c).length /
      data.length) *
      100,
  );
}
