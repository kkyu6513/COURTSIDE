/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // 클라이언트 라우터 캐시 비활성화 — dynamic 페이지가 항상 최신 데이터를 가져오도록.
    // (예: 코치 스케줄 페이지에 신규 등록된 레슨이 진입 즉시 반영)
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },
};

export default nextConfig;
