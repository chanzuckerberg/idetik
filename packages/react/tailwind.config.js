const sds = require("@czi-sds/components/dist/tailwind.json");

module.exports = {
  mode: "jit",
  content: ["./src/**/*.{tsx,scss}"],
  theme: {
    extend: sds,
  },
};