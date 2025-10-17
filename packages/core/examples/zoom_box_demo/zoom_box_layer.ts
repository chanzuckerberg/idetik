import { Layer, LayerOptions } from "@/core/layer";
import { OrthographicCamera } from "@/objects/cameras/orthographic_camera";
import { ProjectedLineGeometry } from "@/objects/geometry/projected_line_geometry";
import { ProjectedLine } from "@/objects/renderable/projected_line";
import { ColorLike, Color } from "@/core/color";
import { vec3 } from "gl-matrix";
import { Box2 } from "@/math/box2";
import { EventContext } from "@/core/event_dispatcher";

export type ZoomBoxLayerProps = LayerOptions & {
  targetCamera: OrthographicCamera;
  color?: ColorLike | string;
  width?: number;
};

export class ZoomBoxLayer extends Layer {
  public readonly type = "ZoomBoxLayer";

  private readonly targetCamera_: OrthographicCamera;
  private readonly color_: ColorLike | string;
  private readonly width_: number;
  private projectedLine_?: ProjectedLine;
  private lastViewRect_?: Box2;

  constructor({
    targetCamera,
    color = Color.GREEN,
    width = 2.0,
    ...layerOptions
  }: ZoomBoxLayerProps) {
    super(layerOptions);
    this.targetCamera_ = targetCamera;
    this.color_ = color;
    this.width_ = width;
    this.setState("initialized");
  }

  public update() {
    switch (this.state) {
      case "initialized":
        this.createZoomBoxRenderable();
        this.setState("ready");
        break;
      case "loading":
        break;
      case "ready":
        this.updateZoomBoxIfNeeded();
        break;
      default: {
        const exhaustiveCheck: never = this.state;
        throw new Error(`Unhandled LayerState case: ${exhaustiveCheck}`);
      }
    }
  }

  public onEvent(event: EventContext) {
    if (event.type === "pointerup" && event.worldPos) {
      // pan the camera to center on the zoom box
      const camPos = this.targetCamera_.position;
      const worldPos = vec3.clone(event.worldPos);
      worldPos[2] = camPos[2]; // keep the camera's z position
      this.targetCamera_.pan(vec3.sub(vec3.create(), worldPos, camPos));
    }
  }

  private createZoomBoxRenderable() {
    const viewRect = this.targetCamera_.getWorldViewRect();
    const rectanglePath = this.boxToRectanglePath(viewRect);
    const geometry = new ProjectedLineGeometry(rectanglePath);

    // Handle both hex strings and Color objects
    const color =
      typeof this.color_ === "string"
        ? Color.fromRgbHex(this.color_)
        : this.color_;

    this.projectedLine_ = new ProjectedLine({
      geometry,
      color,
      width: this.width_,
    });

    this.addObject(this.projectedLine_);
    this.lastViewRect_ = viewRect.clone();
  }

  private updateZoomBoxIfNeeded() {
    if (!this.projectedLine_ || !this.lastViewRect_) {
      return;
    }

    const currentViewRect = this.targetCamera_.getWorldViewRect();

    // Only update if the view rect has actually changed
    if (!Box2.equals(currentViewRect, this.lastViewRect_)) {
      // Remove old renderable
      this.removeObject(this.projectedLine_);

      // Create new geometry with updated rectangle path
      const rectanglePath = this.boxToRectanglePath(currentViewRect);
      const geometry = new ProjectedLineGeometry(rectanglePath);

      // Handle both hex strings and Color objects
      const color =
        typeof this.color_ === "string"
          ? Color.fromRgbHex(this.color_)
          : this.color_;

      // Create new projected line with updated geometry
      this.projectedLine_ = new ProjectedLine({
        geometry,
        color,
        width: this.width_,
      });

      this.addObject(this.projectedLine_);
      this.lastViewRect_ = currentViewRect.clone();
    }
  }

  private boxToRectanglePath(box: Box2): vec3[] {
    // Convert Box2 to a closed rectangle path starting from middle of bottom edge
    const z = 0; // 2D rectangle in z=0 plane
    const midX = (box.min[0] + box.max[0]) / 2;

    return [
      vec3.fromValues(midX, box.min[1], z), // middle of bottom edge (start)
      vec3.fromValues(box.max[0], box.min[1], z), // bottom-right corner
      vec3.fromValues(box.max[0], box.max[1], z), // top-right corner
      vec3.fromValues(box.min[0], box.max[1], z), // top-left corner
      vec3.fromValues(box.min[0], box.min[1], z), // bottom-left corner
      vec3.fromValues(midX, box.min[1], z), // back to middle of bottom edge (close)
    ];
  }
}
