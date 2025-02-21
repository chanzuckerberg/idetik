/* eslint-disable @typescript-eslint/no-var-requires */
/** @type {import('tailwindcss').Config} */

const sds = require("@czi-sds/components/dist/tailwind.json");

module.exports = {
    mode: "jit",
    content: ["./src/**/*.{tsx,scss}"],
    theme: {
      extend: {
        ...sds,
        colors: {
          ...sds.colors,
          blue: {
            500: '#3B82F6',
          },
          red: {
            500: '#EF4444',
          }
        },
      },
    },
  };