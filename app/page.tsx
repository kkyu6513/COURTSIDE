export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-bold tracking-tight text-ink">
          COURTSIDE
        </h1>
        <p className="mt-3 text-sm text-ink-2">테니스 코치 SaaS</p>
        <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Sprint 1 셋업 완료
        </div>
      </div>
    </main>
  );
}
