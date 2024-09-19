import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import eslint from "vite-plugin-eslint";
import glsl from "vite-plugin-glsl";

const plugins = [react(), eslint(), glsl()];

// https://vitejs.dev/config/
export default defineConfig({
  plugins: plugins,
});
