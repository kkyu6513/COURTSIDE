import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-bold tracking-tight text-ink">
          COURTSIDE
        </h1>
        <p className="mt-3 text-sm text-ink-2">테니스 코치 SaaS</p>

        <Link
          href="/login"
          className="mt-10 inline-flex h-12 items-center justify-center rounded-xl bg-ink px-8 text-sm font-semibold text-white hover:opacity-90 transition"
        >
          로그인하기
        </Link>

        <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Sprint 1 — 카카오 로그인 테스트 단계
        </div>
      </div>
    </main>
  );
}
