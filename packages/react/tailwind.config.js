import sds from "@czi-sds/components/dist/tailwind.json" assert { type: "json" };

export default {
  mode: "jit",
  content: ["./src/**/*.{ts,tsx,css,scss}"],
  theme: {
    extend: sds,
  },
};
