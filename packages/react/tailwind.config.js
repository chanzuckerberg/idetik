/* eslint-disable @typescript-eslint/no-var-requires */
/** @type {import('tailwindcss').Config} */

const sds = require("@czi-sds/components/dist/tailwind.json");
const typography = require("@tailwindcss/typography");

module.exports = {
  mode: "jit",
  darkMode: "media",
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx,scss,md,mdx}",
    "./src/**/*.module.css",
    "./*.tsx",

  ],
  theme: {
    extend: {
      ...sds,
      fontWeight: {
        "sds-regular": "400",
        "sds-semibold": "600",
      },
      height: {
        // NOTE: This is the same as in vc-litqa-agent constants.ts
        "nav-height": "46px",
      },
      width: {
        // NOTE: These constants are the same as in vc-litqa-agent constants.ts
        "main-content": "620px",
        "main-content-large": "800px",
        modal: "600px",
      },
      maxWidth: {
        content: "1600px",
        "content-small": "800px",
      },
      lineHeight: {
        "sds-body-xxxs": "16px",
        "sds-body-xxs": "18px",
        "sds-body-xs": "20px",
        "sds-body-s": "24px",
        "sds-body-m": "26px",
        "sds-body-l": "28px",
        "sds-caps-xxxxs": "14px",
        "sds-caps-xxxs": "16px",
        "sds-caps-xxs": "18px",
        "sds-header-xxxs": "16px",
        "sds-header-xxs": "18px",
        "sds-header-xs": "18px",
        "sds-header-s": "20px",
        "sds-header-m": "22px",
        "sds-header-l": "24px",
        "sds-header-xl": "30px",
        "sds-header-xxl": "34px",
        "sds-tabular-xs": "20px",
        "sds-tabular-s": "24px",
        "sds-code-xs": "20px",
        "sds-code-s": "24px",
      },
      fontFamily: {
        "sds-body":
          "var(--font-inter), -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Helvetica, Arial, sans-serif",
        "sds-caps":
          "var(--font-inter), -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Helvetica, Arial, sans-serif",
        "sds-code": "IBM Plex Mono, monospace",
        "sds-header":
          "var(--font-inter), -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Helvetica, Arial, sans-serif",
        "sds-tabular":
          "var(--font-inter), -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Helvetica, Arial, sans-serif",
      },
      screens: {
        xs: "415px",
        sm: "640px",
        /**
         * (thuang): Should be 768px, but we use 945px for now,
         * since our desktop navbar doesn't look good below that width
         */
        md: "945px",
        lg: "1024px",
        xl: "1280px",
      },
    },
  },
  // @rainandbare - This is the recommended way to integrate MUI and Tailwind -
  // https://mui.com/material-ui/integrations/interoperability/?srsltid=AfmBOookkeSn7JaD7EtxryuQXC5OCjUVlRyP6XYQ3tG3PvmpDvfVQiRG#tailwind-css
  // however we still need the normalization that we were getting from the preflight css
  // so we are now hardcoding it in frontend/app/preflight.css
  corePlugins: {
    preflight: false,
  },
  important: "html",
  plugins: [typography],
};