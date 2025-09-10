import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { copyFileSync } from "node:fs";
import { generateExamplesManifest } from "./generate-examples-manifest.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function examplesManifestPlugin() {
  return {
    name: "examples-navigation",
    buildStart(options) {
      if (options.command !== "build" || options.mode !== "examples") {
        return;
      }

      try {
        generateExamplesManifest();
        console.log("Examples manifest generated");
      } catch (error) {
        console.error("Failed to generate examples manifest:", error);
      }
    },
    configureServer(server) {
      try {
        generateExamplesManifest();
        // copy exaples manifest to public directory for dev server
        const manifestPath = resolve(__dirname, "examples", "examples-manifest.json");
        const publicManifestPath = resolve(__dirname, "public", "examples-manifest.json");
        copyFileSync(manifestPath, publicManifestPath);
        console.log("Examples manifest generated and copied to public for dev server");
      } catch (error) {
        console.error("Failed to generate examples manifest:", error);
      }

      // watch the entire examples directory for changes (including new files/directories)
      const fileWatcher = server.watcher;
      const examplesDir = resolve(__dirname, "examples");
      const distDir = resolve(__dirname, "examples", "dist");
      fileWatcher.add(examplesDir);

      const regenerateManifest = () => {
        console.log("Examples changed, regenerating manifest...");
        try {
          generateExamplesManifest();
          // Copy to public directory for dev server
          const manifestPath = resolve(__dirname, "examples", "examples-manifest.json");
          const publicManifestPath = resolve(__dirname, "public", "examples-manifest.json");
          copyFileSync(manifestPath, publicManifestPath);
          console.log("Manifest regenerated and copied to public");
        } catch (error) {
          console.error("Failed to regenerate manifest:", error);
        }
      };

      fileWatcher.on("change", (path) => {
        if (
          path.startsWith(examplesDir) &&
          path.endsWith("index.html") &&
          !path.startsWith(distDir) &&
          !path.endsWith("/examples/index.html") &&
          !path.endsWith("examples-manifest.json")
        ) {
          regenerateManifest();
        }
      });

      fileWatcher.on("add", (path) => {
        if (
          path.startsWith(examplesDir) &&
          path.endsWith("/index.html") &&
          !path.startsWith(distDir) &&
          !path.endsWith("examples-manifest.json")
        ) {
          regenerateManifest();
        }
      });
    },
  };
}

export default examplesManifestPlugin;
