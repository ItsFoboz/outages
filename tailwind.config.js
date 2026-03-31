/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0F1117",
        surface: "#1A1D27",
        card: "#21252F",
        "accent-electricity": "#F59E0B",
        "accent-water": "#38BDF8",
        "accent-heating": "#F97316",
        "text-primary": "#F1F5F9",
        "text-muted": "#94A3B8",
        "status-active": "#EF4444",
        "status-planned": "#3B82F6",
        "status-resolved": "#22C55E",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "8px",
        badge: "6px",
        input: "4px",
      },
    },
  },
  plugins: [],
};
