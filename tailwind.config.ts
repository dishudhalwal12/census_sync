import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        popover: "hsl(var(--popover))",
        "popover-foreground": "hsl(var(--popover-foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        secondary: "hsl(var(--secondary))",
        "secondary-foreground": "hsl(var(--secondary-foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        accent: "hsl(var(--accent))",
        "accent-foreground": "hsl(var(--accent-foreground))",
        destructive: "hsl(var(--destructive))",
        "destructive-foreground": "hsl(var(--destructive-foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))"
        },
        lavender: {
          50: "#f7f1ff",
          100: "#efe1ff",
          200: "#dec2ff",
          300: "#cc9bff",
          400: "#b678f8",
          500: "#9f59eb"
        },
        peach: {
          50: "#fff4ec",
          100: "#ffe8d6",
          200: "#ffd0ae",
          300: "#ffb083"
        },
        butter: {
          50: "#fffbea",
          100: "#fff2bf",
          200: "#ffe491"
        }
      },
      borderRadius: {
        xl: "1.25rem",
        "2xl": "1.75rem",
        "3xl": "2.25rem",
        "4xl": "2.75rem"
      },
      fontFamily: {
        sans: ["var(--font-sans)", ...defaultTheme.fontFamily.sans],
        display: ["var(--font-display)", ...defaultTheme.fontFamily.sans]
      },
      boxShadow: {
        halo: "0 18px 60px rgba(133, 97, 180, 0.14)",
        soft: "0 10px 40px rgba(24, 24, 27, 0.08)"
      },
      backgroundImage: {
        "hero-grid":
          "radial-gradient(circle at top, rgba(193,166,240,0.28), transparent 38%), radial-gradient(circle at left, rgba(255,225,180,0.24), transparent 30%)"
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" }
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.65" }
        }
      },
      animation: {
        float: "float 7s ease-in-out infinite",
        "fade-up": "fade-up 0.8s ease forwards",
        "pulse-soft": "pulseSoft 2.4s ease-in-out infinite"
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
};

export default config;
