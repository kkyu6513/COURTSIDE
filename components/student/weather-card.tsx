/**
 * 학생 홈 — 오늘의 테니스 컨디션 카드 (#C1 + #C2)
 *
 * Open-Meteo 무료 API (lib/weather.ts) 기반.
 * 호출 실패하거나 데이터 없을 때는 컴포넌트 자체가 null 을 반환해 홈 흐름 영향 없음.
 */

import { tennisCondition, weatherCodeLabel, type WeatherSnapshot } from "@/lib/weather";

const LEVEL_STYLE: Record<
  ReturnType<typeof tennisCondition>["level"],
  { bg: string; border: string; text: string; chipBg: string; chipText: string }
> = {
  great:   { bg: "bg-gradient-to-br from-sky-50 to-emerald-50",  border: "border-sky-200",     text: "text-sky-900",     chipBg: "bg-emerald-100", chipText: "text-emerald-700" },
  ok:      { bg: "bg-gradient-to-br from-emerald-50 to-emerald-50/40", border: "border-emerald-200", text: "text-emerald-900", chipBg: "bg-emerald-100", chipText: "text-emerald-700" },
  caution: { bg: "bg-gradient-to-br from-amber-50 to-orange-50", border: "border-amber-200",   text: "text-amber-900",   chipBg: "bg-amber-100",   chipText: "text-amber-700"   },
  indoor:  { bg: "bg-gradient-to-br from-slate-50 to-sky-50",    border: "border-slate-200",   text: "text-slate-900",   chipBg: "bg-slate-100",   chipText: "text-slate-700"   },
};

export function WeatherCard({ weather }: { weather: WeatherSnapshot | null }) {
  if (!weather) return null; // fetch 실패 — 섹션 자체 미노출
  const cond = tennisCondition(weather);
  const wcode = weatherCodeLabel(weather.weatherCode);
  const style = LEVEL_STYLE[cond.level];

  // 미세먼지 라벨
  const pmLabel = (() => {
    if (weather.pm25 == null) return null;
    if (weather.pm25 >= 75) return { text: "매우 나쁨", color: "text-red-600" };
    if (weather.pm25 >= 35) return { text: "나쁨", color: "text-orange-600" };
    if (weather.pm25 >= 15) return { text: "보통", color: "text-emerald-600" };
    return { text: "좋음", color: "text-sky-600" };
  })();

  // 자외선 라벨
  const uvLabel = (() => {
    if (weather.uvIndex == null) return null;
    if (weather.uvIndex >= 11) return { text: "위험", color: "text-purple-700" };
    if (weather.uvIndex >= 8) return { text: "매우 강함", color: "text-red-600" };
    if (weather.uvIndex >= 6) return { text: "강함", color: "text-orange-600" };
    if (weather.uvIndex >= 3) return { text: "보통", color: "text-amber-600" };
    return { text: "낮음", color: "text-emerald-600" };
  })();

  return (
    <div className={`rounded-2xl border ${style.bg} ${style.border} p-4`}>
      {/* 상단 — 한 줄 결론 */}
      <div className="flex items-start gap-3">
        <div className="flex-none text-3xl leading-none">{cond.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-extrabold ${style.text}`}>{cond.headline}</div>
          <div className="mt-0.5 text-[11px] text-ink-3 flex items-center gap-1">
            <span>{wcode.emoji}</span>
            <span>{wcode.text}</span>
            <span className="mx-0.5 text-ink-3/40">·</span>
            <span className="font-semibold text-ink-2">{weather.temperature.toFixed(0)}℃</span>
          </div>
        </div>
        <span className={`flex-none rounded-full px-2 py-1 text-[10px] font-bold ${style.chipBg} ${style.chipText}`}>
          오늘 컨디션
        </span>
      </div>

      {/* 메트릭 — 4 컬럼 그리드 */}
      <div className="mt-3 grid grid-cols-4 gap-2">
        <Metric label="기온" value={`${weather.temperature.toFixed(0)}°`} subText="" />
        <Metric
          label="바람"
          value={`${weather.windSpeed.toFixed(1)}`}
          subText="m/s"
        />
        <Metric
          label="미세먼지"
          value={weather.pm25 != null ? weather.pm25.toFixed(0) : "—"}
          subText={pmLabel?.text ?? ""}
          subColor={pmLabel?.color}
        />
        <Metric
          label="자외선"
          value={weather.uvIndex != null ? weather.uvIndex.toFixed(0) : "—"}
          subText={uvLabel?.text ?? ""}
          subColor={uvLabel?.color}
        />
      </div>

      {/* 사유 리스트 */}
      {cond.reasons.length > 0 && (
        <ul className="mt-3 space-y-1">
          {cond.reasons.slice(0, 3).map((r, idx) => (
            <li key={idx} className={`text-[11px] leading-relaxed ${style.text} flex items-start gap-1.5`}>
              <span className="mt-1 inline-block w-1 h-1 rounded-full bg-current opacity-60 flex-none" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 text-[10px] text-ink-3/80 text-right">
        실시간 · open-meteo 제공
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  subText,
  subColor,
}: {
  label: string;
  value: string;
  subText: string;
  subColor?: string;
}) {
  return (
    <div className="rounded-lg bg-white/70 px-2 py-2 text-center">
      <div className="text-[9px] font-semibold text-ink-3">{label}</div>
      <div className="mt-0.5 text-sm font-extrabold text-ink leading-none tabular-nums">{value}</div>
      {subText && (
        <div className={`mt-0.5 text-[9px] font-semibold ${subColor ?? "text-ink-3"}`}>
          {subText}
        </div>
      )}
    </div>
  );
}
