import sds from "@czi-sds/components/dist/tailwind.json" assert { type: "json" };

export default {
  mode: "jit",
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,css}",
    "./examples/**/*.{ts,tsx,css}",
  ],
  theme: {
    extend: sds,
  },
  // Material UI compatibility settings
  // See https://mui.com/material-ui/integrations/interoperability/#tailwind-css
  // Disable preflight to avoid conflicts with Material-UI.
  corePlugins: {
    preflight: false,
  },
};
