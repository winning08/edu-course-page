import { DATA, predict, accuracy } from "./game-core.js";
const svg = document.querySelector("#tree-chart"),
  score = document.querySelector("#accuracy"),
  path = document.querySelector("#tree-path"),
  datasetBody = document.querySelector("#dataset-body"),
  pointDetail = document.querySelector("#point-detail"),
  treeVisual = document.querySelector("#tree-visual");
let selectedPoint = null;
datasetBody.innerHTML = DATA.map(
  (point, index) =>
    `<tr><th scope="row">${index + 1}</th><td>${point.x}시간</td><td>${point.y}시간</td><td><span class="class-tag ${point.c ? "class-blue" : "class-red"}">${point.c ? "집중 학습형" : "보충 학습형"}</span></td></tr>`,
).join("");
function readRule(id) {
  return {
    feature: document.querySelector(`#${id}-feature`).value,
    threshold: Number(document.querySelector(`#${id}-threshold`).value),
    operator: document.querySelector(`#${id}-operator`).value,
    yesClass: Number(document.querySelector(`#${id}-yes`).value),
    noClass: Number(document.querySelector(`#${id}-no`).value),
  };
}
function getRules() {
  return {
    root: readRule("root"),
    yes: document.querySelector("#yes-use").checked ? readRule("yes") : null,
    no: document.querySelector("#no-use").checked ? readRule("no") : null,
  };
}
function describe(rule) {
  return `${rule.feature === "x" ? "공부 시간" : "수면 시간"} ${rule.threshold}시간 ${rule.operator === "lte" ? "이하" : "이상"}? (참→${rule.yesClass ? "집중" : "보충"}, 거짓→${rule.noClass ? "집중" : "보충"})`;
}
function className(classId) {
  return classId ? "집중 학습형" : "보충 학습형";
}
function leaf(classId) {
  return `<div class="tree-node tree-leaf ${classId ? "leaf-blue" : "leaf-red"}"><small>분류 결과</small><strong>${className(classId)}</strong></div>`;
}
function childTree(rule, defaultClass) {
  if (!rule) return leaf(defaultClass);
  return `<div class="mini-tree"><div class="tree-node tree-question">${rule.feature === "x" ? "공부 시간" : "수면 시간"}이 ${rule.threshold}시간 ${rule.operator === "lte" ? "이하" : "이상"}?</div><div class="mini-branches"><div><span>참</span>${leaf(rule.yesClass)}</div><div><span>거짓</span>${leaf(rule.noClass)}</div></div></div>`;
}
function renderTree(rules) {
  treeVisual.innerHTML = `<div class="tree-node tree-question tree-root">${rules.root.feature === "x" ? "공부 시간" : "수면 시간"}이 ${rules.root.threshold}시간 ${rules.root.operator === "lte" ? "이하" : "이상"}?</div><div class="tree-branches"><section><span class="branch-label">참</span>${childTree(rules.yes, 1)}</section><section><span class="branch-label">거짓</span>${childTree(rules.no, 0)}</section></div>`;
}
function pointCallout(rules) {
  if (selectedPoint === null) return "";
  const point = DATA[selectedPoint],
    predicted = predict(point, rules),
    pointX = 45 + point.x * 57,
    pointY = 455 - point.y * 43,
    boxX = pointX > 420 ? pointX - 238 : pointX + 18,
    boxY = pointY < 92 ? pointY + 18 : pointY - 76,
    anchorX = pointX > 420 ? boxX + 220 : boxX;
  return `<g class="point-callout" aria-hidden="true"><line x1="${pointX}" y1="${pointY}" x2="${anchorX}" y2="${boxY + 29}"/><rect x="${boxX}" y="${boxY}" width="220" height="58" rx="10"/><text x="${boxX + 12}" y="${boxY + 22}"><tspan font-weight="800">${selectedPoint + 1}번 학생</tspan><tspan dx="10">공부 ${point.x}시간 · 수면 ${point.y}시간</tspan></text><text x="${boxX + 12}" y="${boxY + 44}">실제 ${className(point.c)} · 예측 ${className(predicted)}</text></g>`;
}
function render() {
  const rules = getRules(),
    value = accuracy(DATA, rules);
  score.textContent = `${value}%`;
  document.querySelector("#goal-feedback").textContent =
    value >= 90
      ? "목표 달성! 적은 질문으로 데이터를 잘 구분했습니다."
      : "검은 테두리 점을 살펴보고, 특징이나 기준 시간을 바꿔 보세요.";
  ["root", "yes", "no"].forEach((id) => {
    document.querySelector(`#${id}-threshold-value`).textContent =
      `${document.querySelector(`#${id}-threshold`).value}시간`;
  });
  ["yes", "no"].forEach((id) => {
    const enabled = document.querySelector(`#${id}-use`).checked;
    document
      .querySelector(`#${id}-rule`)
      .classList.toggle("is-disabled", !enabled);
    document
      .querySelectorAll(`#${id}-rule select, #${id}-rule input`)
      .forEach((control) => (control.disabled = !enabled));
  });
  path.innerHTML = `<li>첫 질문: ${describe(rules.root)}</li><li>참 가지: ${rules.yes ? describe(rules.yes) : "집중 학습형으로 분류"}</li><li>거짓 가지: ${rules.no ? describe(rules.no) : "보충 학습형으로 분류"}</li>`;
  renderTree(rules);
  if (selectedPoint !== null) {
    const point = DATA[selectedPoint],
      predicted = predict(point, rules);
    pointDetail.innerHTML = `<strong>${selectedPoint + 1}번 학생</strong><span>공부 ${point.x}시간</span><span>수면 ${point.y}시간</span><span>실제: ${className(point.c)}</span><span>트리 예측: ${className(predicted)}</span>`;
  }
  svg.innerHTML =
    '<rect width="660" height="500" fill="#fff" rx="16"/>' +
    DATA.map((point, index) => {
      const correct = predict(point, rules) === point.c,
        selected = selectedPoint === index;
      return `<circle data-point-index="${index}" tabindex="0" role="button" aria-label="${index + 1}번 학생, 공부 ${point.x}시간, 수면 ${point.y}시간" cx="${45 + point.x * 57}" cy="${455 - point.y * 43}" r="${selected ? 13 : 10}" fill="${point.c ? "#3976e8" : "#e24a5a"}" stroke="${selected ? "#f59e0b" : correct ? "white" : "#111827"}" stroke-width="${selected ? 5 : correct ? 2 : 5}"/>`;
    }).join("") +
    pointCallout(rules) +
    '<text x="330" y="490" text-anchor="middle">공부 시간</text><text x="14" y="250" transform="rotate(-90 14 250)" text-anchor="middle">수면 시간</text>';
}
function showPoint(index) {
  selectedPoint = index;
  render();
}
svg.addEventListener("click", (event) => {
  const point = event.target.closest("[data-point-index]");
  if (point) showPoint(Number(point.dataset.pointIndex));
});
svg.addEventListener("keydown", (event) => {
  const point = event.target.closest("[data-point-index]");
  if (point && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    showPoint(Number(point.dataset.pointIndex));
  }
});
document
  .querySelectorAll("select,input")
  .forEach((element) => element.addEventListener("input", render));
render();
