import { DATA, FEATURES, accuracy, predict } from "./game-core.js";

const svg = document.querySelector("#tree-chart");
const score = document.querySelector("#accuracy");
const path = document.querySelector("#tree-path");
const treeVisual = document.querySelector("#tree-visual");
let selectedPoint = null;

const className = (classId) => (classId ? "버지니카" : "버시컬러");
const featureName = (feature) => FEATURES[feature].name;

document.querySelector("#dataset-body").innerHTML = DATA.map(
  (point, index) =>
    `<tr><th scope="row">${index + 1}</th><td>${point.x}cm</td><td>${point.y}cm</td><td><span class="class-tag ${point.c ? "class-blue" : "class-red"}">${className(point.c)}</span></td></tr>`,
).join("");

function configureRange(id, preserveRatio = false) {
  const feature = document.querySelector(`#${id}-feature`).value;
  const config = FEATURES[feature];
  const input = document.querySelector(`#${id}-threshold`);
  const oldMin = Number(input.min);
  const oldMax = Number(input.max);
  const oldValue = Number(input.value);
  input.min = config.min;
  input.max = config.max;
  input.step = config.step;
  input.value = preserveRatio
    ? config.min +
      ((oldValue - oldMin) / (oldMax - oldMin)) * (config.max - config.min)
    : input.value;
  if (Number(input.value) < config.min || Number(input.value) > config.max) {
    input.value = (config.min + config.max) / 2;
  }
  const rule = document.querySelector(`#${id}-rule`) ?? input.closest(".rule");
  const ends = rule.querySelector(".range-ends");
  ends.firstElementChild.textContent = `${config.min}${config.unit}`;
  ends.lastElementChild.textContent = `${config.max}${config.unit}`;
}

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
  return `${featureName(rule.feature)} ${rule.threshold}cm ${rule.operator === "lte" ? "이하" : "이상"}? (참→${className(rule.yesClass)}, 거짓→${className(rule.noClass)})`;
}

function leaf(classId) {
  return `<div class="tree-node tree-leaf ${classId ? "leaf-blue" : "leaf-red"}"><small>분류 결과</small><strong>${className(classId)}</strong></div>`;
}

function childTree(rule, defaultClass) {
  if (!rule) return leaf(defaultClass);
  return `<div class="mini-tree"><div class="tree-node tree-question">${featureName(rule.feature)}이 ${rule.threshold}cm ${rule.operator === "lte" ? "이하" : "이상"}?</div><div class="mini-branches"><div><span>참</span>${leaf(rule.yesClass)}</div><div><span>거짓</span>${leaf(rule.noClass)}</div></div></div>`;
}

function renderTree(rules) {
  treeVisual.innerHTML = `<div class="tree-node tree-question tree-root">${featureName(rules.root.feature)}이 ${rules.root.threshold}cm ${rules.root.operator === "lte" ? "이하" : "이상"}?</div><div class="tree-branches"><section><span class="branch-label">참</span>${childTree(rules.yes, 1)}</section><section><span class="branch-label">거짓</span>${childTree(rules.no, 0)}</section></div>`;
}

const plotX = (value) =>
  70 + ((value - FEATURES.x.min) / (FEATURES.x.max - FEATURES.x.min)) * 550;
const plotY = (value) =>
  440 - ((value - FEATURES.y.min) / (FEATURES.y.max - FEATURES.y.min)) * 380;

function axes() {
  const xTicks = [3.5, 4, 4.5, 5, 5.5, 6, 6.5];
  const yTicks = [1, 1.4, 1.8, 2.2, 2.6];
  return `<g class="plot-grid">${xTicks.map((tick) => `<line x1="${plotX(tick)}" y1="60" x2="${plotX(tick)}" y2="440"/><text x="${plotX(tick)}" y="462">${tick}</text>`).join("")}${yTicks.map((tick) => `<line x1="70" y1="${plotY(tick)}" x2="620" y2="${plotY(tick)}"/><text x="58" y="${plotY(tick) + 4}" text-anchor="end">${tick}</text>`).join("")}</g><line class="plot-axis" x1="70" y1="440" x2="620" y2="440"/><line class="plot-axis" x1="70" y1="60" x2="70" y2="440"/><text class="axis-title" x="345" y="492" text-anchor="middle">꽃잎 길이(cm)</text><text class="axis-title" x="18" y="250" transform="rotate(-90 18 250)" text-anchor="middle">꽃잎 너비(cm)</text>`;
}

function pointCallout() {
  if (selectedPoint === null) return "";
  const point = DATA[selectedPoint];
  const pointX = plotX(point.x);
  const pointY = plotY(point.y);
  const boxX = pointX > 500 ? pointX - 128 : pointX + 14;
  const boxY = pointY < 95 ? pointY + 12 : pointY - 42;
  const anchorX = pointX > 500 ? boxX + 114 : boxX;
  return `<g class="point-callout" aria-hidden="true"><line x1="${pointX}" y1="${pointY}" x2="${anchorX}" y2="${boxY + 16}"/><rect x="${boxX}" y="${boxY}" width="114" height="32" rx="9"/><text x="${boxX + 57}" y="${boxY + 21}" text-anchor="middle">(${point.x}, ${point.y})</text></g>`;
}

function render() {
  const rules = getRules();
  const value = accuracy(DATA, rules);
  score.textContent = `${value}%`;
  document.querySelector("#goal-feedback").textContent =
    value >= 90
      ? "목표 달성! 적은 질문으로 두 품종을 잘 구분했습니다."
      : "검은 테두리 점을 살펴보고, 특징이나 기준값을 바꿔 보세요.";

  ["root", "yes", "no"].forEach((id) => {
    document.querySelector(`#${id}-threshold-value`).textContent =
      `${Number(document.querySelector(`#${id}-threshold`).value).toFixed(1)}cm`;
  });
  ["yes", "no"].forEach((id) => {
    const enabled = document.querySelector(`#${id}-use`).checked;
    document
      .querySelector(`#${id}-rule`)
      .classList.toggle("is-disabled", !enabled);
    document
      .querySelectorAll(`#${id}-rule select, #${id}-rule input`)
      .forEach((control) => {
        control.disabled = !enabled;
      });
  });

  path.innerHTML = `<li>첫 질문: ${describe(rules.root)}</li><li>참 가지: ${rules.yes ? describe(rules.yes) : "버지니카로 분류"}</li><li>거짓 가지: ${rules.no ? describe(rules.no) : "버시컬러로 분류"}</li>`;
  renderTree(rules);

  svg.innerHTML =
    '<rect width="660" height="500" fill="#fff" rx="16"/>' +
    axes() +
    DATA.map((point, index) => {
      const correct = predict(point, rules) === point.c;
      const selected = selectedPoint === index;
      return `<circle data-point-index="${index}" tabindex="0" role="button" aria-label="${index + 1}번 표본, 꽃잎 길이 ${point.x}cm, 너비 ${point.y}cm" cx="${plotX(point.x)}" cy="${plotY(point.y)}" r="${selected ? 13 : 10}" fill="${point.c ? "#3976e8" : "#e24a5a"}" stroke="${selected ? "#f59e0b" : correct ? "white" : "#111827"}" stroke-width="${selected ? 5 : correct ? 2 : 5}"/>`;
    }).join("") +
    pointCallout();
}

function togglePoint(index) {
  selectedPoint = selectedPoint === index ? null : index;
  render();
}

["root", "yes", "no"].forEach((id) => {
  configureRange(id);
  document.querySelector(`#${id}-feature`).addEventListener("change", () => {
    configureRange(id, true);
    render();
  });
});
svg.addEventListener("click", (event) => {
  const point = event.target.closest("[data-point-index]");
  if (point) {
    togglePoint(Number(point.dataset.pointIndex));
  }
});
svg.addEventListener("keydown", (event) => {
  const point = event.target.closest("[data-point-index]");
  if (point && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    togglePoint(Number(point.dataset.pointIndex));
  }
});
document.querySelectorAll("select,input").forEach((element) => {
  if (!element.id.endsWith("-feature"))
    element.addEventListener("input", render);
});
render();
