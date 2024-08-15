import { LayerManager, SingleMeshLayer, WebGLRenderer } from "@";

const singleMeshLayer = new SingleMeshLayer();

const layersManager = new LayerManager();
layersManager.add(singleMeshLayer);

const renderer = new WebGLRenderer("#canvas", layersManager);
renderer.render();
