import { LayerManager, WebGLRenderer } from "@";

const layers = new LayerManager();
const renderer = new WebGLRenderer("#canvas", layers);

renderer.render();
