import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { RacketBrand } from "@prisma/client";
import { registerRacket } from "../actions";

export const dynamic = "force-dynamic";

const BRAND_LABEL: Record<RacketBrand, string> = {
  WILSON: "윌슨",
  BABOLAT: "바볼랏",
  HEAD: "헤드",
  YONEX: "요넥스",
  PRINCE: "프린스",
  DUNLOP: "던롭",
  TECNIFIBRE: "테크니파이버",
  PROKENNEX: "프로케넥스",
};

export default async function RegisterRacketPage({
  searchParams,
}: {
  searchParams?: { brand?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = (user.app_metadata as { role?: string } | undefined)?.role ?? "STUDENT";
  if (role === "COACH") redirect("/my");

  const selectedBrand = (searchParams?.brand?.toUpperCase() as RacketBrand) || "WILSON";

  const [brands, rackets, currentRacket] = await Promise.all([
    // 활성 브랜드 목록
    prisma.racket.findMany({
      where: { isActive: true },
      distinct: ["brand"],
      select: { brand: true },
    }),
    prisma.racket.findMany({
      where: { isActive: true, brand: selectedBrand },
      orderBy: [{ releaseYear: "desc" }, { model: "asc" }],
    }),
    prisma.userRacket.findFirst({
      where: { userId: user.id, isActive: true },
      select: { stringTension: true, lastStringChangeDate: true, stringType: true },
    }),
  ]);

  const availableBrands = brands.map((b) => b.brand);

  return (
    <main className="min-h-screen bg-bg pb-16">
      <header className="h-14 bg-surface border-b border-line sticky top-0 z-10">
        <div className="max-w-md mx-auto h-full px-2 flex items-center">
          <Link href="/my/racket" aria-label="뒤로" className="w-10 h-10 flex items-center justify-center text-ink text-lg">
            ←
          </Link>
          <h1 className="flex-1 text-center text-base font-bold text-ink tracking-tight">
            라켓 등록
          </h1>
          <span className="w-10" />
        </div>
      </header>

      <form action={registerRacket} className="max-w-md mx-auto px-5 pt-5 space-y-5">
        {/* 브랜드 선택 */}
        <section>
          <label className="block text-xs font-bold text-ink-2 mb-2">브랜드</label>
          <div className="grid grid-cols-4 gap-1.5">
            {availableBrands.map((brand) => (
              <Link
                key={brand}
                href={`/my/racket/register?brand=${brand}`}
                replace
                scroll={false}
                className={`px-2 py-3 border rounded-lg text-[11px] font-semibold text-center transition ${
                  selectedBrand === brand
                    ? "border-ink bg-soft text-ink"
                    : "border-line bg-surface text-ink-2 hover:border-line-strong"
                }`}
              >
                {BRAND_LABEL[brand]}
              </Link>
            ))}
          </div>
        </section>

        {/* 모델 선택 */}
        <section>
          <label className="block text-xs font-bold text-ink-2 mb-2">모델</label>
          {rackets.length === 0 ? (
            <p className="text-xs text-ink-3 font-medium">등록된 모델이 없어요</p>
          ) : (
            <select
              name="racketId"
              required
              defaultValue={rackets[0].id}
              className="w-full h-11 px-3 border border-line rounded-lg text-sm font-medium text-ink bg-surface"
            >
              {rackets.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.model}
                  {r.weight ? ` (${r.weight}g` : ""}
                  {r.headSize ? ` · ${r.headSize}sq in)` : r.weight ? ")" : ""}
                </option>
              ))}
            </select>
          )}
        </section>

        {/* 스트링 텐션 */}
        <section>
          <label className="block text-xs font-bold text-ink-2 mb-2">
            스트링 텐션 (lbs · 선택)
          </label>
          <input
            type="number"
            name="stringTension"
            min={30}
            max={70}
            placeholder="예: 54"
            defaultValue={currentRacket?.stringTension ?? ""}
            className="w-full h-11 px-3 border border-line rounded-lg text-sm font-medium text-ink"
          />
        </section>

        {/* 스트링 종류 */}
        <section>
          <label className="block text-xs font-bold text-ink-2 mb-2">
            스트링 (선택)
          </label>
          <input
            type="text"
            name="stringType"
            placeholder="예: Luxilon 4G 125"
            defaultValue={currentRacket?.stringType ?? ""}
            className="w-full h-11 px-3 border border-line rounded-lg text-sm font-medium text-ink"
          />
        </section>

        {/* 마지막 교체일 */}
        <section>
          <label className="block text-xs font-bold text-ink-2 mb-2">
            마지막 스트링 교체일 (선택)
          </label>
          <input
            type="date"
            name="lastStringChangeDate"
            defaultValue={
              currentRacket?.lastStringChangeDate
                ? currentRacket.lastStringChangeDate.toISOString().slice(0, 10)
                : ""
            }
            className="w-full h-11 px-3 border border-line rounded-lg text-sm font-medium text-ink"
          />
        </section>

        {rackets.length > 0 && (
          <button
            type="submit"
            className="w-full h-12 rounded-xl bg-ink text-white text-sm font-bold"
          >
            등록 완료
          </button>
        )}
      </form>
    </main>
  );
}
