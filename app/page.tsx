import type { Metadata } from "next";
import { RipenessGame } from "./ripeness-game";

export const metadata: Metadata = {
  title: "AI 추론 실험실 | 과일 익음 판별 게임",
  description: "피드백을 통해 AI가 분류 규칙을 찾아가는 과정을 체험하는 고등학생용 수업 게임",
};

export default function Home() {
  return <RipenessGame />;
}
