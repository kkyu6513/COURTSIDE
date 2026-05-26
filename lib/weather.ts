/**
 * Open-Meteo 무료 API 기반 테니스 컨디션 데이터.
 * - 키 불필요, 무제한 (개인 사용)
 * - 한국 위경도 지원
 * - 날씨(기온/강수/풍속) + 미세먼지(PM2.5) + 자외선
 *
 * 호출 실패해도 학생 홈 전체가 깨지지 않도록 모든 fetch 는 try/catch + null 반환.
 */

// 기본 위치 — 서울시청. 추후 student_profiles.preferredAreaSido/Sigungu → 위경도 매핑 가능.
export const DEFAULT_LAT = 37.5665;
export const DEFAULT_LON = 126.9780;

export type WeatherSnapshot = {
  // 기온 ℃
  temperature: number;
  // 강수량 mm (현재 시각 기준 1시간)
  precipitation: number;
  // 풍속 m/s
  windSpeed: number;
  // weather_code (open-meteo WMO) — 아이콘/문구 매핑용
  weatherCode: number;
  // 미세먼지 PM2.5 ㎍/㎥
  pm25: number | null;
  // 자외선 지수 (0~11+)
  uvIndex: number | null;
};

type Condition = {
  level: "great" | "ok" | "caution" | "indoor";
  emoji: string;
  headline: string;
  reasons: string[];
};

const OK_CODES = new Set([0, 1, 2, 3]); // 맑음 ~ 흐림
const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);

export function weatherCodeLabel(code: number): { emoji: string; text: string } {
  if (code === 0) return { emoji: "☀️", text: "맑음" };
  if (code === 1 || code === 2) return { emoji: "🌤️", text: "구름 조금" };
  if (code === 3) return { emoji: "☁️", text: "흐림" };
  if (code >= 45 && code <= 48) return { emoji: "🌫️", text: "안개" };
  if (code >= 51 && code <= 57) return { emoji: "🌦️", text: "이슬비" };
  if (code >= 61 && code <= 67) return { emoji: "🌧️", text: "비" };
  if (code >= 71 && code <= 77) return { emoji: "❄️", text: "눈" };
  if (code >= 80 && code <= 82) return { emoji: "🌧️", text: "소나기" };
  if (code >= 85 && code <= 86) return { emoji: "🌨️", text: "눈 소나기" };
  if (code >= 95) return { emoji: "⛈️", text: "뇌우" };
  return { emoji: "🌤️", text: "보통" };
}

export function tennisCondition(w: WeatherSnapshot): Condition {
  const reasons: string[] = [];
  let level: Condition["level"] = "great";

  // 비/눈 — 실내 권장
  if (RAIN_CODES.has(w.weatherCode) || w.precipitation > 0.2) {
    reasons.push("비 — 실내 코트 권장");
    level = "indoor";
  }
  if (SNOW_CODES.has(w.weatherCode)) {
    reasons.push("눈 — 실내 코트 권장");
    level = "indoor";
  }

  // 풍속 7m/s 이상 — 야외 어려움
  if (w.windSpeed >= 7) {
    reasons.push(`바람 강함 (${w.windSpeed.toFixed(1)}m/s)`);
    if (level === "great") level = "caution";
  }

  // 기온 — 한여름/한겨울
  if (w.temperature >= 32) {
    reasons.push(`폭염 (${w.temperature.toFixed(0)}℃) — 수분 보충`);
    if (level === "great") level = "caution";
  } else if (w.temperature <= 2) {
    reasons.push(`혹한 (${w.temperature.toFixed(0)}℃) — 실내 권장`);
    if (level !== "indoor") level = "indoor";
  } else if (w.temperature <= 8) {
    reasons.push(`쌀쌀함 (${w.temperature.toFixed(0)}℃) — 보온 준비`);
    if (level === "great") level = "ok";
  }

  // 미세먼지
  if (w.pm25 != null) {
    if (w.pm25 >= 75) {
      reasons.push(`미세먼지 매우 나쁨 (PM2.5 ${w.pm25.toFixed(0)})`);
      if (level !== "indoor") level = "indoor";
    } else if (w.pm25 >= 35) {
      reasons.push(`미세먼지 나쁨 (PM2.5 ${w.pm25.toFixed(0)})`);
      if (level === "great") level = "caution";
    }
  }

  // 자외선
  if (w.uvIndex != null && w.uvIndex >= 8) {
    reasons.push(`자외선 매우 강함 (UV ${w.uvIndex.toFixed(0)}) — 차단제 필수`);
    if (level === "great") level = "caution";
  }

  let emoji: string;
  let headline: string;
  switch (level) {
    case "indoor":
      emoji = "🏠";
      headline = "오늘은 실내 코트 권장";
      break;
    case "caution":
      emoji = "⚠️";
      headline = "야외 가능 — 컨디션 주의";
      break;
    case "ok":
      emoji = "🎾";
      headline = "야외 레슨 OK";
      break;
    case "great":
    default:
      emoji = "🌞";
      headline = OK_CODES.has(w.weatherCode)
        ? "테니스 치기 완벽한 날"
        : "야외 레슨 OK";
  }
  if (reasons.length === 0) {
    reasons.push("기온·바람·미세먼지 모두 양호");
  }
  return { level, emoji, headline, reasons };
}

/**
 * Open-Meteo 날씨 + 미세먼지 동시 호출 (Promise.all).
 * 실패 시 null 반환. Next.js fetch 5분 캐시.
 */
export async function fetchTennisWeather(
  lat: number = DEFAULT_LAT,
  lon: number = DEFAULT_LON,
): Promise<WeatherSnapshot | null> {
  try {
    const weatherUrl =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,precipitation,wind_speed_10m,weather_code` +
      `&wind_speed_unit=ms&timezone=Asia%2FSeoul`;
    const airUrl =
      `https://air-quality-api.open-meteo.com/v1/air-quality` +
      `?latitude=${lat}&longitude=${lon}` +
      `&current=pm2_5,uv_index&timezone=Asia%2FSeoul`;

    const [w, a] = await Promise.all([
      fetch(weatherUrl, { next: { revalidate: 300 } }).then((r) => r.json()).catch(() => null),
      fetch(airUrl, { next: { revalidate: 300 } }).then((r) => r.json()).catch(() => null),
    ]);

    if (!w?.current) return null;

    return {
      temperature: Number(w.current.temperature_2m ?? 0),
      precipitation: Number(w.current.precipitation ?? 0),
      windSpeed: Number(w.current.wind_speed_10m ?? 0),
      weatherCode: Number(w.current.weather_code ?? 0),
      pm25: a?.current?.pm2_5 != null ? Number(a.current.pm2_5) : null,
      uvIndex: a?.current?.uv_index != null ? Number(a.current.uv_index) : null,
    };
  } catch (e) {
    console.error("[fetchTennisWeather] error:", e);
    return null;
  }
}
