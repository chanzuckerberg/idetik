import { Geometry } from "./geometry";
import { Logger } from "../utilities/logger";

export class WireframeGeometry extends Geometry {
  constructor(geometry: Geometry) {
    super();

    if (geometry.primitive != "triangles") {
      Logger.warn("WireframeGeometry", "Only indexed geometries are supported");
      return;
    }

    if (geometry.indexData.length == 0) {
      Logger.warn(
        "WireframeGeometry",
        "Only triangulated geometries are supported"
      );
      return;
    }

    this.primitive_ = "lines";
    this.vertexData_ = geometry.vertexData;
    this.attributes_ = geometry.attributes;

    const edgeSet = new Set<{ i0: number; i1: number }>();
    const wireframeIndices: number[] = [];
    const addEdge = (a: number, b: number) => {
      // Normalize edge order and use a set to deduplicate,
      // since shared edges between triangles would otherwise
      // be added multiple times.
      const i0 = Math.min(a, b);
      const i1 = Math.max(a, b);
      if (!edgeSet.has({ i0, i1 })) {
        edgeSet.add({ i0, i1 });
        wireframeIndices.push(i0, i1);
      }
    };

    const index = geometry.indexData;
    for (let i = 0; i < index.length; i += 3) {
      const i0 = index[i];
      const i1 = index[i + 1];
      const i2 = index[i + 2];
      addEdge(i0, i1);
      addEdge(i1, i2);
      addEdge(i2, i0);
    }

    this.indexData_ = new Uint32Array(wireframeIndices);
  }
}
