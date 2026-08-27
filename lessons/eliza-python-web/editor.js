// 아주 가벼운 파이썬 코드 편집기. 외부 라이브러리(CodeMirror 등) 없이
// <textarea> 위에 문법 강조용 <pre><code>를 겹쳐 그리는 방식으로 구현했다
// (textarea는 투명한 글자색으로 입력을 받고, 그 아래 <pre>가 색을 입힌 같은
// 텍스트를 보여준다 — 스크롤/글꼴/여백을 완전히 맞춰야 캐럿과 글자가 어긋나지
// 않는다. styles.css의 .code-editor 관련 규칙과 반드시 함께 맞춰야 한다).
const KEYWORDS = new Set([
  "False", "None", "True", "and", "as", "assert", "async", "await", "break",
  "class", "continue", "def", "del", "elif", "else", "except", "finally",
  "for", "from", "global", "if", "import", "in", "is", "lambda", "nonlocal",
  "not", "or", "pass", "raise", "return", "try", "while", "with", "yield",
]);
const BUILTINS = new Set([
  "print", "input", "len", "str", "int", "float", "bool", "list", "dict",
  "set", "tuple", "range", "enumerate", "zip", "map", "filter", "sorted",
  "sum", "min", "max", "abs", "type", "isinstance", "open",
]);
const TOKEN_RE =
  /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)/g;

// Python은 같은 블록에서 탭과 공백을 섞으면 TabError를 낸다. 붙여넣은 코드나
// 이전 세션에 남은 코드까지 안전하게 실행되도록 실제 탭을 공백 4칸으로 통일한다.
export function normalizePythonIndentation(code) {
  return String(code ?? "").replace(/\t/g, "    ");
}

function normalizeTextareaIndentation(textarea) {
  if (!textarea.value.includes("\t")) return;
  const { selectionStart, selectionEnd, value } = textarea;
  const tabsBeforeStart = (value.slice(0, selectionStart).match(/\t/g) || []).length;
  const tabsBeforeEnd = (value.slice(0, selectionEnd).match(/\t/g) || []).length;
  textarea.value = normalizePythonIndentation(value);
  textarea.selectionStart = selectionStart + tabsBeforeStart * 3;
  textarea.selectionEnd = selectionEnd + tabsBeforeEnd * 3;
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function highlightPython(code) {
  let result = "";
  let lastIndex = 0;
  TOKEN_RE.lastIndex = 0;
  let match;
  while ((match = TOKEN_RE.exec(code))) {
    result += escapeHtml(code.slice(lastIndex, match.index));
    const [full, comment, string, number, word] = match;
    if (comment) result += `<span class="tok-comment">${escapeHtml(comment)}</span>`;
    else if (string) result += `<span class="tok-string">${escapeHtml(string)}</span>`;
    else if (number) result += `<span class="tok-number">${escapeHtml(number)}</span>`;
    else if (word && KEYWORDS.has(word)) result += `<span class="tok-keyword">${escapeHtml(word)}</span>`;
    else if (word && BUILTINS.has(word)) result += `<span class="tok-builtin">${escapeHtml(word)}</span>`;
    else result += escapeHtml(full);
    lastIndex = match.index + full.length;
  }
  result += escapeHtml(code.slice(lastIndex));
  return result;
}

function insertText(textarea, text) {
  const { value, selectionStart, selectionEnd } = textarea;
  textarea.value = value.slice(0, selectionStart) + text + value.slice(selectionEnd);
  const cursor = selectionStart + text.length;
  textarea.selectionStart = textarea.selectionEnd = cursor;
}

function getLineBounds(value, start, end) {
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  let lineEnd = value.indexOf("\n", end);
  if (lineEnd === -1) lineEnd = value.length;
  return { lineStart, lineEnd };
}

function indentSelection(textarea, dedent) {
  const { value, selectionStart, selectionEnd } = textarea;
  const { lineStart, lineEnd } = getLineBounds(value, selectionStart, selectionEnd);
  const before = value.slice(0, lineStart);
  const block = value.slice(lineStart, lineEnd);
  const after = value.slice(lineEnd);
  let firstLineDelta = 0;
  let totalDelta = 0;
  const newLines = block.split("\n").map((line, index) => {
    if (dedent) {
      const removed = (line.match(/^ {1,4}/) || [""])[0].length;
      if (index === 0) firstLineDelta = -removed;
      totalDelta -= removed;
      return line.slice(removed);
    }
    if (index === 0) firstLineDelta = 4;
    totalDelta += 4;
    return `    ${line}`;
  });
  textarea.value = before + newLines.join("\n") + after;
  textarea.selectionStart = Math.max(lineStart, selectionStart + firstLineDelta);
  textarea.selectionEnd = Math.max(textarea.selectionStart, selectionEnd + totalDelta);
}

function handleEnter(textarea) {
  const { value, selectionStart } = textarea;
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const currentLine = value.slice(lineStart, selectionStart);
  const indent = (currentLine.match(/^[ \t]*/) || [""])[0];
  const extra = /:\s*$/.test(currentLine.trimEnd()) ? "    " : "";
  insertText(textarea, `\n${indent}${extra}`);
}

export function setupEditor({ textarea, gutter, highlightPane, highlightCode, onChange }) {
  function render() {
    const value = textarea.value;
    highlightCode.innerHTML = `${highlightPython(value)}\n`;
    const lineCount = value.split("\n").length;
    gutter.textContent = Array.from({ length: lineCount }, (_, index) => index + 1).join("\n");
    syncScroll();
  }

  function syncScroll() {
    highlightPane.scrollTop = textarea.scrollTop;
    highlightPane.scrollLeft = textarea.scrollLeft;
    gutter.scrollTop = textarea.scrollTop;
  }

  textarea.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      event.preventDefault();
      const { selectionStart, selectionEnd, value } = textarea;
      const spansMultipleLines = value.slice(selectionStart, selectionEnd).includes("\n");
      if (spansMultipleLines) indentSelection(textarea, event.shiftKey);
      else if (event.shiftKey) indentSelection(textarea, true);
      else insertText(textarea, "    ");
      render();
      onChange?.();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      handleEnter(textarea);
      render();
      onChange?.();
      return;
    }
    if (event.key === "Escape") {
      // Tab이 편집기 안에서 들여쓰기로 쓰이는 대신 페이지 밖으로 포커스를
      // 옮기고 싶을 때를 위한 키보드 탈출구(Esc로 편집기에서 빠져나온 뒤 Tab).
      textarea.blur();
    }
  });

  textarea.addEventListener("input", () => {
    normalizeTextareaIndentation(textarea);
    render();
    onChange?.();
  });
  textarea.addEventListener("scroll", syncScroll);

  render();

  return {
    render,
    setValue(value) {
      textarea.value = normalizePythonIndentation(value);
      render();
    },
    getValue() {
      return normalizePythonIndentation(textarea.value);
    },
  };
}
