import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 추론 실험실",
  description: "피드백을 통해 분류 규칙을 찾아가는 고등학생용 인공지능 체험",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
