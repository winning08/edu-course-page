export const CLASS_INFO = [
  { id: 0, name: "빨강 클래스", color: "#e24a5a" },
  { id: 1, name: "파랑 클래스", color: "#3976e8" },
  { id: 2, name: "초록 클래스", color: "#22a06b" },
  { id: 3, name: "보라 클래스", color: "#8b5bd6" },
];

export function createRandom(seed = Date.now()) {
  let state = seed >>> 0;
  return () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function generateDataset(classCount, sampleCount, seed = Date.now()) {
  const random = createRandom(seed);
  const centers = [[.34,.36],[.64,.34],[.39,.64],[.64,.65]];
  return Array.from({ length: sampleCount }, (_, index) => {
    const classId = index % classCount;
    const [cx, cy] = centers[classId];
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * .31;
    return { id: index, classId, x: Math.min(.96, Math.max(.04, cx + Math.cos(angle) * radius)), y: Math.min(.96, Math.max(.04, cy + Math.sin(angle) * radius)) };
  });
}

export function classifyPoint(dataset, target, k, classCount) {
  const neighbors = dataset.map((point) => ({ ...point, distance: Math.hypot(point.x - target.x, point.y - target.y) }))
    .sort((a, b) => a.distance - b.distance || a.id - b.id).slice(0, Math.min(k, dataset.length));
  const votes = Array(classCount).fill(0);
  neighbors.forEach((point) => { votes[point.classId] += 1; });
  const maxVote = Math.max(...votes);
  const tied = votes.map((vote, classId) => ({ vote, classId })).filter(({ vote }) => vote === maxVote).map(({ classId }) => classId);
  const winner = tied.length === 1 ? tied[0] : neighbors.find((point) => tied.includes(point.classId)).classId;
  return { neighbors, votes, winner, tied: tied.length > 1 };
}
