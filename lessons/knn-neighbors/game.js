import { CLASS_INFO, classifyPoint, generateDataset } from "./game-core.js";

const svg = document.querySelector("#knn-board");
const classInput = document.querySelector("#class-count");
const kInput = document.querySelector("#neighbor-count");
const sampleInput = document.querySelector("#sample-count");
const result = document.querySelector("#result");
const values = { classCount: document.querySelector("#class-count-value"), k: document.querySelector("#neighbor-count-value"), sampleCount: document.querySelector("#sample-count-value") };
let seed = Date.now();
let dataset = [];
let target = null;
let previewTarget = null;
let classification = null;

function regenerate() {
  seed += 1;
  dataset = generateDataset(Number(classInput.value), Number(sampleInput.value), seed);
  target = null;
  previewTarget = null;
  classification = null;
  render();
}

function render() {
  values.classCount.textContent = classInput.value;
  values.k.textContent = kInput.value;
  values.sampleCount.textContent = sampleInput.value;
  const width = 700, height = 480, pad = 22;
  const neighborIds = new Set(classification?.neighbors.map(({ id }) => id) ?? []);
  svg.innerHTML = `<rect width="${width}" height="${height}" rx="18" fill="#f8fafc"/><g stroke="#dbe3ef">${[1,2,3,4].map(i=>`<line x1="${i*140}" y1="0" x2="${i*140}" y2="480"/><line x1="0" y1="${i*96}" x2="700" y2="${i*96}"/>`).join("")}</g>`;
  dataset.forEach((point) => {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", pad + point.x * (width - pad * 2)); circle.setAttribute("cy", pad + point.y * (height - pad * 2));
    circle.setAttribute("r", neighborIds.has(point.id) ? "10" : "7"); circle.setAttribute("fill", CLASS_INFO[point.classId].color);
    circle.setAttribute("stroke", neighborIds.has(point.id) ? "#111827" : "white"); circle.setAttribute("stroke-width", neighborIds.has(point.id) ? "4" : "2");
    svg.append(circle);
  });
  if (target) {
    const x = pad + target.x * (width - pad * 2), y = pad + target.y * (height - pad * 2);
    if (classification?.neighbors.length) {
      const radius = classification.neighbors.at(-1).distance * Math.hypot(width - pad * 2, height - pad * 2);
      const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      ring.setAttribute("cx", x); ring.setAttribute("cy", y); ring.setAttribute("r", radius); ring.setAttribute("class", "neighbor-ring"); svg.append(ring);
    }
    const mark = document.createElementNS("http://www.w3.org/2000/svg", "g");
    mark.innerHTML = `<circle cx="${x}" cy="${y}" r="13" fill="white" stroke="#111827" stroke-width="4"/><path d="M${x-6} ${y}h12M${x} ${y-6}v12" stroke="#111827" stroke-width="3"/>`;
    svg.append(mark);
  }
  if (previewTarget) {
    const px = pad + previewTarget.x * (width - pad * 2), py = pad + previewTarget.y * (height - pad * 2);
    const preview = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    preview.setAttribute("cx", px); preview.setAttribute("cy", py); preview.setAttribute("r", "10");
    preview.setAttribute("fill", "rgba(255,255,255,.75)"); preview.setAttribute("stroke", "#667085");
    preview.setAttribute("stroke-width", "2"); preview.setAttribute("stroke-dasharray", "4 4");
    svg.append(preview);
  }
  renderResult();
}

function renderResult() {
  if (!classification) { result.innerHTML = "<strong>분류할 점을 그래프에서 클릭하세요.</strong><span>가장 가까운 이웃들이 어느 클래스에 속하는지 확인할 수 있습니다.</span>"; return; }
  const info = CLASS_INFO[classification.winner];
  const voteText = classification.votes.map((vote, id) => `<li><i style="background:${CLASS_INFO[id].color}"></i>${CLASS_INFO[id].name}: <strong>${vote}표</strong></li>`).join("");
  result.innerHTML = `<div class="winner"><i style="background:${info.color}"></i><span>분류 결과</span><strong>${info.name}</strong></div><ul>${voteText}</ul><p>${classification.tied ? "최다 득표가 같아 가장 가까운 이웃의 클래스로 결정했습니다." : `이웃 ${classification.neighbors.length}개 중 가장 많은 표를 얻은 클래스로 분류했습니다.`}</p>`;
}

let pointerFrame = 0;
function pointAtPointer(event) {
  const box = svg.getBoundingClientRect();
  return { x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height };
}
svg.addEventListener("pointermove", (event) => {
  if (pointerFrame) return;
  pointerFrame = requestAnimationFrame(() => { pointerFrame = 0; previewTarget = pointAtPointer(event); render(); });
});
svg.addEventListener("pointerleave", () => { previewTarget = null; render(); });
svg.addEventListener("pointerdown", (event) => {
  svg.setPointerCapture?.(event.pointerId);
  target = pointAtPointer(event); previewTarget = null;
  classification = classifyPoint(dataset, target, Number(kInput.value), Number(classInput.value)); render();
});
[classInput, sampleInput].forEach((input) => input.addEventListener("input", regenerate));
kInput.addEventListener("input", () => { if (target) classification = classifyPoint(dataset, target, Number(kInput.value), Number(classInput.value)); render(); });
document.querySelector("#randomize").addEventListener("click", regenerate);
regenerate();
