/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,ts}"],
  theme: {
    extend: {
      colors: {
        border: "#e5e7eb",
        background: "#ffffff",
        foreground: "#111827",
        muted: "#f5f6f8",
        primary: "#2563eb"
      },
      borderRadius: {
        xl: "0.75rem"
      }
    },
  },
  plugins: [],
}
