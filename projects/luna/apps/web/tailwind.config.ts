import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 月夜テーマ
        night: {
          900: "#0a0e1a",
          800: "#111729",
          700: "#1a2238",
          600: "#283150",
        },
        moon: {
          100: "#fdf6e3",
          200: "#f4e9c9",
          300: "#e8d49a",
        },
        luna: {
          accent: "#a5b4fc",
          glow: "#c7d2fe",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Hiragino Sans", "sans-serif"],
      },
      keyframes: {
        "moon-pulse": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "moon-pulse": "moon-pulse 4s ease-in-out infinite",
        "fade-up": "fade-up 0.3s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
