import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0F172A",
        "ink-2": "#475569",
        "ink-3": "#94A3B8",
        line: "#E2E8F0",
        "line-strong": "#CBD5E1",
        surface: "#FFFFFF",
        bg: "#F8FAFC",
        soft: "#F1F5F9",
      },
    },
  },
  plugins: [],
};

export default config;
