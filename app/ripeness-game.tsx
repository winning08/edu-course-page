"use client";

import { useEffect, useMemo, useState } from "react";

type Color = "초록" | "노랑" | "빨강" | "주황";
type Texture = "단단함" | "중간" | "말랑함";
type Season = "봄" | "여름" | "가을" | "겨울";
type Prediction = "잘 익음" | "안 익음";

type Fruit = { color: Color; texture: Texture; season: Season };
type Attempt = Fruit & {
  round: number;
  prediction: Prediction;
  answer: Prediction;
  correct: boolean;
};

const TOTAL_ROUNDS = 15;
const colorScores: Record<Color, number> = { 초록: 0, 노랑: 2, 빨강: 3, 주황: 2 };
const textureScores: Record<Texture, number> = { 단단함: 0, 중간: 1, 말랑함: 2 };
const fruitEmoji: Record<Color, string> = { 초록: "🍏", 노랑: "🍋", 빨강: "🍎", 주황: "🍊" };

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

function makeRounds(): Fruit[] {
  const colors = shuffle<Color>([
    "초록", "초록", "초록", "초록",
    "노랑", "노랑", "노랑", "노랑",
    "빨강", "빨강", "빨강",
    "주황", "주황", "주황", "주황",
  ]);
  const textures = shuffle<Texture>([
    "단단함", "단단함", "단단함", "단단함", "단단함",
    "중간", "중간", "중간", "중간", "중간",
    "말랑함", "말랑함", "말랑함", "말랑함", "말랑함",
  ]);
  const seasons: Season[] = ["봄", "여름", "가을", "겨울"];

  return colors.map((color, index) => ({
    color,
    texture: textures[index],
    season: seasons[Math.floor(Math.random() * seasons.length)],
  }));
}

function getAnswer(fruit: Fruit): Prediction {
  return colorScores[fruit.color] + textureScores[fruit.texture] >= 3
    ? "잘 익음"
    : "안 익음";
}

export function RipenessGame() {
  const [rounds, setRounds] = useState<Fruit[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [feedback, setFeedback] = useState<Attempt | null>(null);
  const [finished, setFinished] = useState(false);

  const fruit = rounds[roundIndex];
  const correctCount = attempts.filter((attempt) => attempt.correct).length;
  const accuracy = attempts.length ? Math.round((correctCount / attempts.length) * 100) : 0;
  const scoreLabel = useMemo(
    () => (attempts.length ? `${correctCount} / ${attempts.length} · ${accuracy}%` : "아직 기록 없음"),
    [accuracy, attempts.length, correctCount],
  );

  useEffect(() => {
    setRounds(makeRounds());
  }, []);

  function predict(prediction: Prediction) {
    if (feedback || finished) return;
    const answer = getAnswer(fruit);
    const attempt: Attempt = {
      ...fruit,
      round: roundIndex + 1,
      prediction,
      answer,
      correct: prediction === answer,
    };
    setAttempts((current) => [...current, attempt]);
    setFeedback(attempt);
  }

  function goNext() {
    if (!feedback) return;
    if (roundIndex === TOTAL_ROUNDS - 1) {
      setFinished(true);
      setFeedback(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setRoundIndex((current) => current + 1);
    setFeedback(null);
  }

  function restart() {
    setRounds(makeRounds());
    setRoundIndex(0);
    setAttempts([]);
    setFeedback(null);
    setFinished(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!fruit) {
    return (
      <main className="market-shell loading-shell" aria-live="polite">
        <p>오늘의 과일을 진열하고 있습니다…</p>
      </main>
    );
  }

  return (
    <main className="market-shell">
      <header className="lesson-header">
        <div className="lesson-kicker">AI 추론 실험실 · 첫 번째 체험</div>
        <h1>과일 감별사의 비밀</h1>
        <p className="lesson-lead">
          과일의 정보를 보고 익었는지 예측하세요. 정답 피드백과 지난 기록만으로
          감별 규칙을 찾아낼 수 있을까요?
        </p>
      </header>

      {!finished ? (
        <section className="game-board" aria-labelledby="round-title">
          <div className="status-strip" aria-label="게임 진행 상황">
            <div>
              <span className="status-label">현재 회차</span>
              <strong>{roundIndex + 1} / {TOTAL_ROUNDS}</strong>
            </div>
            <div>
              <span className="status-label">누적 정확도</span>
              <strong>{scoreLabel}</strong>
            </div>
          </div>
          <div className="progress-track" aria-hidden="true">
            <span style={{ width: `${((roundIndex + 1) / TOTAL_ROUNDS) * 100}%` }} />
          </div>

          <div className="fruit-stage">
            <p className="round-label">ROUND {String(roundIndex + 1).padStart(2, "0")}</p>
            <div className="fruit-icon" aria-hidden="true">{fruitEmoji[fruit.color]}</div>
            <h2 id="round-title">이 과일은 잘 익었을까요?</h2>
          </div>

          <dl className="attribute-grid" aria-label="이번 과일의 세 가지 정보">
            <div className="attribute-card color-card">
              <dt><span aria-hidden="true">●</span> 색깔</dt>
              <dd>{fruit.color}</dd>
            </div>
            <div className="attribute-card texture-card">
              <dt><span aria-hidden="true">✋</span> 촉감</dt>
              <dd>{fruit.texture}</dd>
            </div>
            <div className="attribute-card season-card">
              <dt><span aria-hidden="true">☀</span> 계절</dt>
              <dd>{fruit.season}</dd>
            </div>
          </dl>

          <div className="prediction-area">
            <p className="prompt">관찰한 정보를 바탕으로 하나를 선택하세요.</p>
            <div className="prediction-buttons">
              <button className="prediction ripe" onClick={() => predict("잘 익음")} disabled={Boolean(feedback)}>
                <span aria-hidden="true">✓</span> 잘 익음
              </button>
              <button className="prediction unripe" onClick={() => predict("안 익음")} disabled={Boolean(feedback)}>
                <span aria-hidden="true">×</span> 안 익음
              </button>
            </div>
          </div>

          <div className="feedback-slot" aria-live="polite" aria-atomic="true">
            {feedback ? (
              <div className={`feedback-card ${feedback.correct ? "correct" : "incorrect"}`}>
                <div className="feedback-mark" aria-hidden="true">{feedback.correct ? "O" : "X"}</div>
                <div>
                  <p className="feedback-title">{feedback.correct ? "맞았습니다!" : "아쉽지만 달랐어요."}</p>
                  <p>실제 정답은 <strong>{feedback.answer}</strong>입니다. 기록에서 비슷한 과일을 찾아보세요.</p>
                </div>
                <button className="next-button" onClick={goNext} autoFocus>
                  {roundIndex === TOTAL_ROUNDS - 1 ? "결과 보기" : "다음 과일"} <span aria-hidden="true">→</span>
                </button>
              </div>
            ) : (
              <p className="waiting-message">선택하면 정답과 피드백이 바로 나타납니다.</p>
            )}
          </div>
        </section>
      ) : (
        <section className="summary-board" aria-labelledby="summary-title">
          <p className="summary-kicker">15번의 관찰과 예측 완료</p>
          <h2 id="summary-title">당신의 감별 정확도</h2>
          <div className="final-score"><strong>{accuracy}</strong><span>%</span></div>
          <p className="final-count">15개 중 {correctCount}개를 맞혔습니다.</p>
          <div className="discussion-card">
            <span className="discussion-label">함께 이야기해 볼 질문</span>
            <p>세 가지 정보 중 <strong>쓸모없었던 것 같은 정보</strong>는 무엇인가요?</p>
            <p>반대로, 판단할 때 가장 먼저 확인하게 된 정보는 무엇이었나요?</p>
          </div>
          <p className="summary-hint">아래 기록에서 한 가지 정보만 바뀐 과일들을 비교해 보세요.</p>
          <button className="restart-button" onClick={restart}>새 과일로 다시 도전</button>
        </section>
      )}

      <section className="history-section" aria-labelledby="history-title">
        <div className="history-heading">
          <div>
            <p className="section-kicker">관찰 노트</p>
            <h2 id="history-title">지금까지의 감별 기록</h2>
          </div>
          <p>{attempts.length}개의 단서가 모였습니다.</p>
        </div>
        {attempts.length === 0 ? (
          <div className="empty-history">첫 번째 과일을 판단하면 이곳에 기록이 쌓입니다.</div>
        ) : (
          <div className="table-scroll" tabIndex={0} aria-label="감별 기록 표, 가로로 스크롤할 수 있습니다">
            <table>
              <thead>
                <tr>
                  <th scope="col">회차</th><th scope="col">색깔</th><th scope="col">촉감</th>
                  <th scope="col">계절</th><th scope="col">내 예측</th><th scope="col">정답</th><th scope="col">결과</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((attempt) => (
                  <tr key={attempt.round}>
                    <th scope="row">{attempt.round}</th>
                    <td>{attempt.color}</td><td>{attempt.texture}</td><td>{attempt.season}</td>
                    <td>{attempt.prediction}</td><td>{attempt.answer}</td>
                    <td><span className={`result-chip ${attempt.correct ? "is-correct" : "is-wrong"}`}><span aria-hidden="true">{attempt.correct ? "O" : "X"}</span><span className="sr-only">{attempt.correct ? "정답" : "오답"}</span></span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="lesson-footer">
        <span>정보 · 인공지능 기초</span>
        <span>관찰 → 예측 → 피드백 → 다시 관찰</span>
      </footer>
    </main>
  );
}
