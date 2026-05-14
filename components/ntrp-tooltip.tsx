"use client";

import { useState } from "react";

const NTRP_GUIDE = [
  { level: "1.0~2.0", desc: "라켓을 처음 잡아본 입문자. 공을 코트 안으로 넘기는 연습 단계." },
  { level: "2.5~3.0", desc: "기본 스트로크 가능. 게임은 진행되지만 일관성 부족." },
  { level: "3.5~4.0", desc: "안정적인 스트로크와 코스 조절 가능. 동호인 평균 수준." },
  { level: "4.5~5.0", desc: "다양한 샷 구사. 전술적 게임 운영 가능. 상급 동호인." },
  { level: "5.5+", desc: "세미프로~프로 수준. 대회 입상 가능." },
];

export function NtrpTooltipButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="NTRP 레벨이 뭐예요?"
        className="inline-flex items-center gap-1 text-xs text-ink-2 hover:text-ink transition"
      >
        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-ink-3 text-[10px] font-bold">
          ?
        </span>
        NTRP가 뭐예요?
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-surface rounded-2xl p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-ink">NTRP 레벨 안내</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-soft text-ink-2"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-ink-2 mb-4 leading-relaxed">
              NTRP(National Tennis Rating Program)는 미국테니스협회(USTA)가
              제정한 실력 등급으로, 1.0(입문)부터 7.0(프로)까지 0.5 단위로
              구분합니다.
            </p>

            <div className="space-y-3">
              {NTRP_GUIDE.map((g) => (
                <div key={g.level} className="flex gap-3 items-start">
                  <div className="flex-shrink-0 w-16 text-sm font-bold text-ink">
                    {g.level}
                  </div>
                  <div className="flex-1 text-xs text-ink-2 leading-relaxed">
                    {g.desc}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-5 w-full h-11 rounded-xl bg-ink text-white text-sm font-semibold"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}
