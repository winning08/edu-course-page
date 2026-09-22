export const FEATURES = {
  x: { name: "꽃잎 길이", unit: "cm", min: 3.5, max: 6.5, step: 0.1 },
  y: { name: "꽃잎 너비", unit: "cm", min: 1, max: 2.6, step: 0.1 },
};

export const DATA = [
  { x: 4.7, y: 1.4, c: 0 },
  { x: 4.5, y: 1.5, c: 0 },
  { x: 4.9, y: 1.5, c: 0 },
  { x: 4.0, y: 1.3, c: 0 },
  { x: 4.6, y: 1.5, c: 0 },
  { x: 4.5, y: 1.3, c: 0 },
  { x: 4.7, y: 1.6, c: 0 },
  { x: 3.9, y: 1.1, c: 0 },
  { x: 6.0, y: 2.5, c: 1 },
  { x: 5.1, y: 1.9, c: 1 },
  { x: 5.9, y: 2.1, c: 1 },
  { x: 5.6, y: 1.8, c: 1 },
  { x: 5.8, y: 2.2, c: 1 },
  { x: 4.5, y: 1.7, c: 1 },
  { x: 5.1, y: 2.0, c: 1 },
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
