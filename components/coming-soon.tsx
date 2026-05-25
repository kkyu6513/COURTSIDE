// 미구현 페이지 placeholder — 디자인 가이드 중립 톤

export function ComingSoon({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-10 text-center">
      <div className="text-sm font-semibold text-ink-2">준비 중</div>
      <h2 className="mt-2 text-lg font-bold text-ink">{title}</h2>
      {description && (
        <p className="mt-2 text-xs text-ink-3 leading-relaxed">{description}</p>
      )}
    </div>
  );
}
