import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontSize: {
        // ─── 가독성 강화 (디자인 가이드 §3.1 기반 +1~2px) ────────────────────────
        // Tailwind 기본보다 한 단계 키워 모바일 한국어 가독성 확보
        xs: ["13px", { lineHeight: "1.55" }],     // 보조 설명, 캡션 (was 12)
        sm: ["16px", { lineHeight: "1.6" }],      // 본문, 라벨 (was 14 → 15 → 16)
        base: ["16px", { lineHeight: "1.6" }],    // 큰 본문, 강조 텍스트
        lg: ["18px", { lineHeight: "1.5" }],      // 카드 타이틀, 코치 이름
        xl: ["20px", { lineHeight: "1.4" }],      // 섹션 타이틀
        "2xl": ["24px", { lineHeight: "1.3" }],   // 페이지 타이틀
        "3xl": ["28px", { lineHeight: "1.25" }],
        "4xl": ["32px", { lineHeight: "1.2" }],   // 디스플레이
      },
      colors: {
        // ─── Neutral base (베이스 — 텍스트/배경/라인) ────────────────────────────
        ink: "#0F172A",         // 본문 헤드라인, 주요 텍스트
        "ink-2": "#475569",     // 보조 본문
        "ink-3": "#94A3B8",     // placeholder, 캡션
        line: "#E2E8F0",        // 기본 보더
        "line-strong": "#CBD5E1", // 강조 보더
        surface: "#FFFFFF",     // 카드 배경
        bg: "#F8FAFC",          // 페이지 배경
        soft: "#F1F5F9",        // 인풋·소프트 영역 배경

        // ─── Brand primary — Courtside Green ─────────────────────────────────
        primary: {
          50: "#F0FDFA",
          100: "#CCFBF1",
          400: "#2DD4BF",   // ★ Courtside Green (브랜드 베이스)
          500: "#14B8A6",
          600: "#0D9488",   // hover/pressed
          700: "#0F766E",
          DEFAULT: "#2DD4BF",
        },

        // ─── Accent palette — 카테고리/상태 구분용 (제한된 3종) ──────────────────
        "accent-coral": {
          DEFAULT: "#FF6B6B", // 정규레슨 / 응답필요 / 긴급
          soft: "#FFEDED",
        },
        "accent-orange": {
          DEFAULT: "#FF9F43", // 쿠폰레슨 / 진행중
          soft: "#FFF1E0",
        },
        "accent-purple": {
          DEFAULT: "#7C5CBF", // 프리미엄 구독 / 강조 배너
          soft: "#EFE7FA",
        },

        // semantic(성공/경고/오류/안내)은 Tailwind 기본 emerald/amber/red/sky 사용 —
        // 디자인 가이드 §2.3 참조
      },
    },
  },
  plugins: [],
};

export default config;
