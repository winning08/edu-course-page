export function summarizeArcResults(results) {
  const list = Array.isArray(results) ? results : [];
  const solvedFirst = list.filter((r) => r === "solved-first").length;
  const solvedRetry = list.filter((r) => r === "solved-retry").length;
  const skipped = list.filter((r) => r === "skipped").length;
  return { solvedFirst, solvedRetry, skipped, attempted: list.length, solved: solvedFirst + solvedRetry };
}
