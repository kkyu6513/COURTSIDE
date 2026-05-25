import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-bg flex flex-col items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div className="text-5xl font-extrabold text-ink-3 tracking-tight">404</div>
        <h1 className="mt-4 text-lg font-bold text-ink">페이지를 찾을 수 없어요</h1>
        <p className="mt-2 text-sm text-ink-2 leading-relaxed">
          요청하신 페이지가 존재하지 않거나
          <br />접근 권한이 없을 수 있어요.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-ink px-8 text-sm font-semibold text-white hover:opacity-90 transition active:scale-[0.98]"
        >
          홈으로 가기
        </Link>
      </div>
    </main>
  );
}
