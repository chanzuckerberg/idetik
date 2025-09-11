import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { copyFileSync } from "node:fs";
import { generateExamplesManifest, discoverExamples } from "./generate-examples-manifest.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getExampleInputs() {
  const examples = discoverExamples();

  const inputs = {
    main: resolve(__dirname, 'examples/index.html'),
  };

  examples.forEach(example => {
    inputs[example.name] = example.path;
  });

  return inputs;
}

function copyManifestToPublic() {
  const manifestPath = resolve(__dirname, "examples", "examples-manifest.json");
  const publicManifestPath = resolve(__dirname, "public", "examples-manifest.json");
  copyFileSync(manifestPath, publicManifestPath);
}

function examplesManifestPlugin() {
  return {
    name: "examples-navigation",
    config(config, { command, mode }) {
      // Configure build inputs for examples mode
      if (command === "build" && mode === "examples") {
        config.build = config.build || {};
        config.build.rollupOptions = config.build.rollupOptions || {};
        config.build.rollupOptions.input = getExampleInputs();
      }
    },
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
      const regenerateManifest = () => {
        console.log("Regenerating examples manifest...");
        try {
          generateExamplesManifest();
          copyManifestToPublic();
          console.log("Manifest regenerated and copied to public");
        } catch (error) {
          console.error("Failed to regenerate manifest:", error);
        }
      };

      regenerateManifest();

      // watch the entire examples directory for changes (including new files/directories)
      const fileWatcher = server.watcher;
      const examplesDir = resolve(__dirname, "examples");
      const distDir = resolve(__dirname, "examples", "dist");
      fileWatcher.add(examplesDir);

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
