/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Semantic colors backed by CSS custom properties so every utility
      // follows the selected theme (existing / terminal / light). Values are
      // RGB triplets defined in src/index.css.
      colors: {
        app: "rgb(var(--c-app) / <alpha-value>)",
        panel: "rgb(var(--c-panel) / <alpha-value>)",
        inset: "rgb(var(--c-inset) / <alpha-value>)",
        edge: "rgb(var(--c-edge) / <alpha-value>)",
        "edge-strong": "rgb(var(--c-edge-strong) / <alpha-value>)",
        ink: "rgb(var(--c-ink) / <alpha-value>)",
        "ink-soft": "rgb(var(--c-ink-soft) / <alpha-value>)",
        "ink-muted": "rgb(var(--c-ink-muted) / <alpha-value>)",
        "ink-dim": "rgb(var(--c-ink-dim) / <alpha-value>)",
        accent: "rgb(var(--c-accent) / <alpha-value>)",
        "accent-ink": "rgb(var(--c-accent-ink) / <alpha-value>)",
        danger: "rgb(var(--c-danger) / <alpha-value>)",
        "ok-bg": "rgb(var(--c-ok-bg) / <alpha-value>)",
        "ok-ink": "rgb(var(--c-ok-ink) / <alpha-value>)",
        "warn-bg": "rgb(var(--c-warn-bg) / <alpha-value>)",
        "warn-ink": "rgb(var(--c-warn-ink) / <alpha-value>)",
        "warn-strong": "rgb(var(--c-warn-strong) / <alpha-value>)",
        rule: "rgb(var(--c-rule) / <alpha-value>)",
      },
    },
  },
  plugins: [],
};
