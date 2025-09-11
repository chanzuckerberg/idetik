import { L as Layer } from "./metadata_loaders-CXLkXwNR.js";
import { P as ProjectedLineGeometry, a as ProjectedLine } from "./projected_line-CtC2xUEg.js";
class AxesLayer extends Layer {
  type = "AxesLayer";
  constructor(params) {
    super();
    const { length, width } = params;
    this.addObject(
      makeAxis({
        end: [length, 0, 0],
        width,
        color: [1, 0, 0]
      })
    );
    this.addObject(
      makeAxis({
        end: [0, length, 0],
        width,
        color: [0, 1, 0]
      })
    );
    this.addObject(
      makeAxis({
        end: [0, 0, length],
        width,
        color: [0, 0, 1]
      })
    );
    this.setState("ready");
  }
  update() {
  }
}
function makeAxis(params) {
  const { end, width, color } = params;
  const geometry = new ProjectedLineGeometry([[0, 0, 0], end]);
  return new ProjectedLine({
    geometry,
    color,
    width
  });
}
export {
  AxesLayer as A
};
//# sourceMappingURL=axes_layer-BxgIhTAV.js.map
