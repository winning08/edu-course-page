// 연습 섹션: 정점 7~10개짜리 무작위 그래프를 만들어 같은 균일 비용 탐색(UCS) 상호작용을
// 반복 연습할 수 있게 한다. 위쪽의 안내된 활동(game.js)과 같은 그래프 렌더링·상호작용 엔진을
// 그대로 재사용하되, 라운드 진행 상태는 이 섹션만의 것으로 완전히 분리해 둔다.
import { runUcsGraphTrace, pathCostFor, nodeLabel, generateRandomGraph } from "../shared/search-graph-lab.js?v=2026082401";
import { renderGraphDiagram, renderListPanel, enableGraphZoom } from "../shared/search-graph-ui.js?v=2026082401";
import { buildRounds, checkPickAnswer, checkDupAnswer } from "./game-core.js?v=2026082401";

const $ = (selector) => document.querySelector(selector);
const el = {
  section: $("#practice-view"),
  newGraphButton: $("#practice-new-graph"),
  stageLabel: $("#practice-stage-label"),
  graph: $("#practice-graph"),
  listPanel: $("#practice-list-panel"),
  prompt: $("#practice-prompt"),
  feedback: $("#practice-feedback"),
  closeAction: $("#practice-close-action"),
  childrenReveal: $("#practice-children-reveal"),
  dupQuestion: $("#practice-dup-question"),
  nextStep: $("#practice-next-step"),
  traceArea: $("#practice-trace-area"),
  results: $("#practice-results"),
  resultsSummary: $("#practice-results-summary"),
  resultsGraph: $("#practice-results-graph"),
};

if (el.section) {
  let graph = null; // { nodes, edges, start, goal }
  let trace = null;
  let rounds = [];
  let currentRoundIndex = 0;
  let roundState = null;
  let interactionPhase = "pick";
  let pendingCandidates = new Map();
  let pendingDup = null;

  function bfsFewestHopsPath() {
    const adj = new Map(graph.nodes.map((n) => [n.id, []]));
    for (const edge of graph.edges) {
      adj.get(edge.a).push(edge.b);
      adj.get(edge.b).push(edge.a);
    }
    const parent = new Map([[graph.start, null]]);
    const queue = [graph.start];
    while (queue.length > 0) {
      const cur = queue.shift();
      if (cur === graph.goal) break;
      for (const next of adj.get(cur)) {
        if (!parent.has(next)) {
          parent.set(next, cur);
          queue.push(next);
        }
      }
    }
    const path = [graph.goal];
    let cur = graph.goal;
    while (cur !== graph.start) {
      cur = parent.get(cur);
      path.push(cur);
    }
    return path.reverse();
  }

  function pathLabel(pathIds) {
    return pathIds.map((id) => nodeLabel(id, graph.nodes)).join(" → ");
  }

  function prevClosedFor(index) {
    return index === 0 ? [] : rounds[index - 1].closedAfter;
  }

  function treeEdgesUpTo(roundIndex) {
    const parentOf = new Map();
    for (let i = 0; i < roundIndex; i += 1) {
      for (const child of rounds[i].children) {
        if (child.status === "new" || child.status === "open-replace") {
          parentOf.set(child.id, { parentId: rounds[i].expandedId, cost: child.cost });
        }
      }
    }
    return parentOf;
  }

  function initRoundState(round) {
    return {
      open: new Map(round.pickCandidates.map((c) => [c.id, c.g])),
      closed: new Map(prevClosedFor(round.index).map((c) => [c.id, c.g])),
      parentOf: treeEdgesUpTo(round.index),
    };
  }

  function renderFromRoundState({ interactiveIds = null, interactiveVerb, resultMarks = {}, label } = {}) {
    // 연습 그래프는 처음부터 정점을 모두 보여주고(시작·목표 아이콘 포함), 간선은 여전히
    // 컴퓨터가 실제로 발견한 만큼만(edgesOverride) 점진적으로 드러낸다.
    const visibleIds = graph.nodes.map((n) => n.id);
    const visibleSet = new Set(visibleIds);
    const statesById = {};
    const gById = {};
    for (const [id, g] of roundState.closed) { statesById[id] = "closed"; gById[id] = g; }
    for (const [id, g] of roundState.open) { statesById[id] = "open"; gById[id] = g; }
    const edgesOverride = [...roundState.parentOf.entries()]
      .filter(([childId, { parentId }]) => visibleSet.has(childId) && visibleSet.has(parentId))
      .map(([childId, { parentId, cost }]) => ({ a: parentId, b: childId, cost }));
    renderGraphDiagram(el.graph, {
      nodes: graph.nodes,
      edges: graph.edges,
      statesById,
      gById,
      visibleIds,
      edgesOverride,
      interactiveIds,
      interactiveVerb: interactiveVerb || "선택하기",
      resultMarks,
      label: label || "지금까지 컴퓨터가 발견한 상태들의 탐색 트리(연습용 랜덤 그래프)",
    });
    renderListPanel(el.listPanel, {
      nodes: graph.nodes,
      open: [...roundState.open].map(([id, g]) => ({ id, g })),
      closed: [...roundState.closed].map(([id, g]) => ({ id, g })),
    });
  }

  function renderRevealPhase() {
    const candidates = [...pendingCandidates.values()];
    const extraEdges = [];
    const committedOverrides = new Map();
    // 참고: 고정 학교 그래프와 달리 랜덤 그래프는 노드 배치를 미리 손으로 검증할 수 없어,
    // 노드 위에 "기존/새" 값을 겹쳐 그리면 다른 노드나 간선 버튼과 부딪힐 수 있다. 그래서 여기서는
    // compareById 배지 없이, 두 후보 간선의 색깔 있는 g(n) 값만으로 비교하게 한다.
    if (pendingDup) {
      committedOverrides.set(pendingDup.id, {
        choice: "keep",
        choiceLabel: `${nodeLabel(pendingDup.id, graph.nodes)} 기존 값 g=${pendingDup.existingG} 유지하기`,
        displayValue: pendingDup.existingG,
      });
      extraEdges.push({
        a: rounds[currentRoundIndex].expandedId,
        b: pendingDup.id,
        cost: pendingDup.cost,
        displayValue: pendingDup.newG,
        pending: true,
        choice: "replace",
        choiceLabel: `${nodeLabel(pendingDup.id, graph.nodes)} 새 값 g=${pendingDup.newG}으로 교체하기`,
      });
    }
    const visibleIds = graph.nodes.map((n) => n.id);
    const visibleSet = new Set(visibleIds);
    const statesById = {};
    const gById = {};
    for (const [id, g] of roundState.closed) { statesById[id] = "closed"; gById[id] = g; }
    for (const [id, g] of roundState.open) { statesById[id] = "open"; gById[id] = g; }
    for (const c of candidates) { statesById[c.id] = "candidate"; gById[c.id] = c.g; }
    const committedEdges = [...roundState.parentOf.entries()]
      .filter(([childId, { parentId }]) => visibleSet.has(childId) && visibleSet.has(parentId))
      .map(([childId, { parentId, cost }]) => {
        const override = committedOverrides.get(childId);
        return override ? { a: parentId, b: childId, cost, ...override } : { a: parentId, b: childId, cost };
      });
    const candidateEdges = candidates
      .filter((c) => visibleSet.has(c.parentId))
      .map((c) => ({ a: c.parentId, b: c.id, cost: c.cost, pending: true }));
    renderGraphDiagram(el.graph, {
      nodes: graph.nodes,
      edges: graph.edges,
      statesById,
      gById,
      visibleIds,
      edgesOverride: [...committedEdges, ...candidateEdges, ...extraEdges],
      interactiveIds: [...pendingCandidates.keys()],
      interactiveVerb: "오픈 리스트에 추가하기",
      label: "지금까지 컴퓨터가 발견한 상태들의 탐색 트리(연습용 랜덤 그래프). 점선 노드나 두 후보 간선을 클릭하세요.",
    });
    renderListPanel(el.listPanel, {
      nodes: graph.nodes,
      open: [...roundState.open].map(([id, g]) => ({ id, g })),
      closed: [...roundState.closed].map(([id, g]) => ({ id, g })),
    });
  }

  function updateStageLabel(round) {
    el.stageLabel.textContent = `단계 ${round.index + 1} / ${rounds.length} · 균일 비용 탐색 연습(정점 ${graph.nodes.length}개)`;
  }

  function childRowHtml(child, statusLabel) {
    return `<div class="child-row" data-status="${child.status}"><span>${nodeLabel(child.id, graph.nodes)}</span><span>g=${child.newG}</span><span class="child-status">${statusLabel}</span></div>`;
  }

  function childStatusLabel(status) {
    return {
      "open-worse-skip": "기존 값이 더 작아 제외",
      "open-replace": "더 작은 값으로 교체됨",
      "pending-dup": "확인 필요(아래 질문)",
    }[status];
  }

  function baseChildRowHtml(child) {
    return `<div class="child-row" data-status="${child.status}" data-child-id="${child.id}"><span>${nodeLabel(child.id, graph.nodes)}</span><span>g=${child.newG}</span><span class="child-status">${childStatusLabel(child.status)}</span></div>`;
  }

  function showRound(index) {
    currentRoundIndex = index;
    interactionPhase = "pick";
    pendingCandidates = new Map();
    pendingDup = null;
    const round = rounds[index];
    roundState = initRoundState(round);
    updateStageLabel(round);
    renderFromRoundState({ interactiveIds: round.pickCandidates.map((c) => c.id), interactiveVerb: "다음 상태로 선택하기" });
    el.feedback.hidden = true;
    el.feedback.className = "step-feedback";
    el.closeAction.hidden = true;
    el.closeAction.innerHTML = "";
    el.childrenReveal.innerHTML = "";
    el.dupQuestion.hidden = true;
    el.dupQuestion.innerHTML = "";
    el.nextStep.hidden = true;

    el.prompt.textContent = round.pickCandidates.length > 1
      ? "그래프에서 g(n)이 가장 작은 상태를 클릭하세요."
      : "오픈 리스트에는 이 상태 하나뿐입니다. 그래프에서 클릭해 확장하세요.";
  }

  function checkRoundComplete() {
    const dupUnresolved = pendingDup != null;
    if (pendingCandidates.size > 0 || dupUnresolved) return;
    interactionPhase = "done";
    el.nextStep.hidden = false;
    el.nextStep.textContent = rounds[currentRoundIndex].isGoal ? "결과 보기 →" : "다음 단계 →";
    el.nextStep.focus();
  }

  function revealChildren(round) {
    interactionPhase = "reveal";
    const newChildren = round.children.filter((c) => c.status === "new");
    const closedSkipChildren = round.children.filter((c) => c.status === "closed-skip");
    pendingCandidates = new Map(newChildren.map((c) => [c.id, { id: c.id, g: c.newG, parentId: round.expandedId, cost: c.cost }]));
    pendingDup = round.dupChildren[0] || null;

    const hints = [];
    if (pendingCandidates.size > 0) hints.push("점선으로 나타난 새 상태를 클릭해 오픈 리스트에 넣으세요.");
    if (pendingDup) hints.push(`${nodeLabel(pendingDup.id, graph.nodes)}로 가는 두 후보 간선 중 더 작은 값을 클릭하세요.`);
    el.prompt.textContent = hints.length ? hints.join(" ") : "새로 바뀔 상태가 없습니다.";

    el.childrenReveal.innerHTML = closedSkipChildren.length
      ? `<p class="children-reveal-hint">${closedSkipChildren.map((c) => `${nodeLabel(c.id, graph.nodes)}은(는) 이미 닫힌 리스트에 있어 다시 열지 않습니다.`).join(" ")}</p>`
      : "";
    if (pendingDup) {
      el.dupQuestion.hidden = false;
      el.dupQuestion.innerHTML = `<p><strong>${nodeLabel(round.expandedId, graph.nodes)}</strong>에서 <strong>${nodeLabel(pendingDup.id, graph.nodes)}</strong>로 가는 새 경로를 찾았습니다. 그래프에서 ${nodeLabel(pendingDup.id, graph.nodes)}로 이어지는 두 후보 간선(기존 값 ${pendingDup.existingG} / 새 값 ${pendingDup.newG}) 중 더 작은 쪽을 클릭하세요.</p>`;
    }

    renderRevealPhase();
    checkRoundComplete();
  }

  function handleAddCandidate(id) {
    const candidate = pendingCandidates.get(id);
    if (!candidate) return;
    roundState.open.set(id, candidate.g);
    roundState.parentOf.set(id, { parentId: candidate.parentId, cost: candidate.cost });
    pendingCandidates.delete(id);
    renderRevealPhase();
    checkRoundComplete();
  }

  function handleDupChoice(insertChosen) {
    if (!pendingDup) return;
    const round = rounds[currentRoundIndex];
    const dup = pendingDup;
    const outcome = checkDupAnswer(dup, insertChosen);

    if (outcome.shouldInsert) {
      roundState.open.set(dup.id, dup.newG);
      roundState.parentOf.set(dup.id, { parentId: round.expandedId, cost: dup.cost });
    }
    pendingDup = null;
    renderRevealPhase();

    el.dupQuestion.innerHTML = `
      <p><strong>${nodeLabel(round.expandedId, graph.nodes)}</strong>에서 <strong>${nodeLabel(dup.id, graph.nodes)}</strong>로 가는 새 경로를 찾았습니다(비용 ${dup.newG}). 오픈 리스트에는 이미 ${nodeLabel(dup.id, graph.nodes)}(g=${dup.existingG})가 있습니다.</p>
      <div class="step-feedback ${outcome.correct ? "correct" : "incorrect"}">
        <strong>${outcome.correct ? "맞아요." : "다시 확인해 볼까요."}</strong>
        <p>${outcome.shouldInsert
          ? `새 값 ${dup.newG}이(가) 기존 값 ${dup.existingG}보다 작으므로, 더 작은 값으로 교체해야 합니다.`
          : `새 값 ${dup.newG}이(가) 기존 값 ${dup.existingG}보다 크거나 같으므로, 기존 값을 그대로 남겨야 합니다.`}</p>
      </div>
    `;
    el.childrenReveal.insertAdjacentHTML("beforeend", baseChildRowHtml(dup));
    checkRoundComplete();
  }

  function handlePick(clickedId) {
    const round = rounds[currentRoundIndex];
    const outcome = checkPickAnswer(round, clickedId);
    const resultMarks = { [clickedId]: outcome.correct ? "correct" : "incorrect" };
    if (!outcome.correct) resultMarks[round.expandedId] = "correct";
    interactionPhase = "close";
    renderFromRoundState({ interactiveIds: [round.expandedId], interactiveVerb: "닫힌 리스트로 옮기기", resultMarks });

    el.feedback.hidden = false;
    el.feedback.classList.add(outcome.correct ? "correct" : "incorrect");
    el.feedback.innerHTML = outcome.correct
      ? `<strong>정답이에요.</strong><p>${nodeLabel(round.expandedId, graph.nodes)}은(는) 오픈 리스트에서 g=${round.g}로 가장 작았습니다.</p>`
      : `<strong>다시 확인해 볼까요.</strong><p>실제로 다음에 확장된 상태는 <b>${nodeLabel(round.expandedId, graph.nodes)}</b>(g=${round.g})입니다. 초록 테두리로 표시했어요.</p>`;

    el.closeAction.hidden = false;
    el.closeAction.innerHTML = `<p>이제 그래프에서 <strong>${nodeLabel(round.expandedId, graph.nodes)}</strong>을(를) 다시 클릭해 닫힌 리스트로 옮기세요.</p>`;
    el.prompt.textContent = `${nodeLabel(round.expandedId, graph.nodes)}을(를) 클릭해 닫힌 리스트로 옮기세요.`;
  }

  function handleClose() {
    const round = rounds[currentRoundIndex];
    roundState.open.delete(round.expandedId);
    roundState.closed.set(round.expandedId, round.g);
    el.closeAction.hidden = true;

    if (round.isGoal) {
      interactionPhase = "done";
      renderFromRoundState();
      el.prompt.textContent = "목표 상태에 도착했습니다!";
      el.nextStep.hidden = false;
      el.nextStep.textContent = "결과 보기 →";
      el.nextStep.focus();
    } else {
      revealChildren(round);
    }
  }

  function handleGraphActivate(event) {
    if (interactionPhase === "pick") {
      const nodeGroup = event.target.closest(".graph-node.is-pickable");
      if (nodeGroup) handlePick(nodeGroup.dataset.node);
      return;
    }
    if (interactionPhase === "close") {
      const nodeGroup = event.target.closest(".graph-node.is-pickable");
      if (nodeGroup) handleClose();
      return;
    }
    if (interactionPhase === "reveal") {
      const edgeChoice = event.target.closest(".graph-edge-choice");
      if (edgeChoice) {
        handleDupChoice(edgeChoice.dataset.choice === "replace");
        return;
      }
      const nodeGroup = event.target.closest(".graph-node.is-pickable");
      if (nodeGroup) handleAddCandidate(nodeGroup.dataset.node);
    }
  }

  el.graph.addEventListener("click", handleGraphActivate);
  el.graph.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (!event.target.closest(".is-pickable")) return;
    event.preventDefault();
    handleGraphActivate(event);
  });

  el.nextStep.addEventListener("click", () => {
    const round = rounds[currentRoundIndex];
    if (round.isGoal) {
      finishTrace();
      return;
    }
    showRound(currentRoundIndex + 1);
  });

  function finishTrace() {
    el.traceArea.hidden = true;
    el.results.hidden = false;
    renderResults();
    el.results.querySelector("h2").focus();
  }

  function renderResults() {
    const fewestHopsPath = bfsFewestHopsPath();
    const fewestHopsCost = pathCostFor(fewestHopsPath, graph);
    const saved = fewestHopsCost - trace.pathCost;
    const hopsDiff = (fewestHopsPath.length - 1) !== (trace.path.length - 1);
    el.resultsSummary.textContent = hopsDiff && saved > 0
      ? `균일 비용 탐색은 총 ${trace.order.length}개 정점을 확정해 목표에 도착했고, 그 경로(${pathLabel(trace.path)})의 비용은 ${trace.pathCost}입니다. 이동 횟수만 보면 ${pathLabel(fewestHopsPath)}(${fewestHopsPath.length - 1}번 이동)가 더 짧아 보이지만, 실제 비용은 ${fewestHopsCost}로 ${saved}만큼 더 듭니다.`
      : `균일 비용 탐색은 총 ${trace.order.length}개 정점을 확정해 목표에 도착했고, 그 경로(${pathLabel(trace.path)})의 비용은 ${trace.pathCost}입니다.`;
    const statesById = {};
    for (const id of trace.path) statesById[id] = "path";
    const lastRound = rounds.at(-1);
    const gById = {};
    for (const entry of lastRound.closedAfter) gById[entry.id] = entry.g;
    renderGraphDiagram(el.resultsGraph, {
      nodes: graph.nodes,
      edges: graph.edges,
      statesById,
      gById,
      visibleIds: graph.nodes.map((n) => n.id),
      edgesOverride: [...treeEdgesUpTo(lastRound.index + 1).entries()].map(([childId, { parentId, cost }]) => ({ a: parentId, b: childId, cost })),
      pathIds: trace.path,
      label: "이번 연습 그래프에서 컴퓨터가 최종적으로 만든 탐색 트리. 최종 경로가 초록색으로 표시됩니다.",
    });
  }

  function newPracticeGraph() {
    graph = generateRandomGraph({ minNodes: 7, maxNodes: 10 });
    trace = runUcsGraphTrace(graph);
    rounds = buildRounds(trace);
    el.results.hidden = true;
    el.traceArea.hidden = false;
    renderGraphDiagram(el.resultsGraph, {});
    showRound(0);
  }

  el.newGraphButton.addEventListener("click", newPracticeGraph);

  enableGraphZoom(el.graph, document.querySelector('[data-zoom-for="practice-graph"]'));
  enableGraphZoom(el.resultsGraph, document.querySelector('[data-zoom-for="practice-results-graph"]'));

  newPracticeGraph();
}
