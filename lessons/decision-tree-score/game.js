import { DATA, predict, accuracy } from "./game-core.js";
const svg = document.querySelector("#tree-chart"),
  score = document.querySelector("#accuracy"),
  path = document.querySelector("#tree-path"),
  datasetBody = document.querySelector("#dataset-body");
datasetBody.innerHTML = DATA.map(
  (point, index) =>
    `<tr><th scope="row">${index + 1}</th><td>${point.x}시간</td><td>${point.y}시간</td><td><span class="class-tag ${point.c ? "class-blue" : "class-red"}">${point.c ? "집중 학습형" : "보충 학습형"}</span></td></tr>`,
).join("");
function readRule(id) {
  return {
    feature: document.querySelector(`#${id}-feature`).value,
    threshold: Number(document.querySelector(`#${id}-threshold`).value),
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
  return `${rule.feature === "x" ? "공부 시간" : "수면 시간"} ${rule.threshold}시간 이상? (참→${rule.yesClass ? "집중" : "보충"}, 거짓→${rule.noClass ? "집중" : "보충"})`;
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
      document.querySelector(`#${id}-threshold`).value;
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
  svg.innerHTML =
    '<rect width="660" height="500" fill="#fff" rx="16"/>' +
    DATA.map((point) => {
      const correct = predict(point, rules) === point.c;
      return `<circle cx="${45 + point.x * 57}" cy="${455 - point.y * 43}" r="10" fill="${point.c ? "#3976e8" : "#e24a5a"}" stroke="${correct ? "white" : "#111827"}" stroke-width="${correct ? 2 : 5}"/>`;
    }).join("") +
    '<text x="330" y="490" text-anchor="middle">공부 시간</text><text x="14" y="250" transform="rotate(-90 14 250)" text-anchor="middle">수면 시간</text>';
}
document
  .querySelectorAll("select,input")
  .forEach((element) => element.addEventListener("input", render));
render();
