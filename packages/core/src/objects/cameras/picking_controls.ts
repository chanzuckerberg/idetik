import { vec2, vec3 } from "gl-matrix";
import { Camera } from "./camera";
import { PanZoomControls } from "./controls";
import { LayerManager } from "../../core/layer_manager";
import { Layer } from "../../core/layer";
import { RenderableObject } from "../../core/renderable_object";

type ClientToClip = (clientPos: vec2, depth: number) => vec3;

export interface PointPicking {
  getValueAtWorld(world: vec3): unknown | null;
  getValueAtPixel(x: number, y: number): unknown | null;
  getImageRenderable(): RenderableObject | undefined;
}

function isPickableLayer(layer: Layer): layer is Layer & PointPicking {
  return (
    "getValueAtWorld" in layer &&
    typeof (layer as Layer & PointPicking).getValueAtWorld === "function"
  );
}

export class PickingControls extends PanZoomControls {
  private dragStart_: vec2 | null = null;
  private readonly dragThreshold_ = 3;

  constructor(
    camera: Camera,
    _canvas: HTMLCanvasElement,
    private readonly layerManager: LayerManager,
    private readonly onPickValue_?: (info: {
      client: vec2;
      world: vec3;
      value: unknown | null;
      layer: Layer | null;
    }) => void
  ) {
    super(camera);
  }

  public override callbacks(
    target: EventTarget,
    clientToClip: ClientToClip
  ): [string, EventListener][] {
    const base = super.callbacks(target, clientToClip);

    const onPointerDown = (event: Event) => {
      const pointerEvent = event as PointerEvent;
      this.dragStart_ = vec2.fromValues(
        pointerEvent.clientX,
        pointerEvent.clientY
      );
    };

    const onPointerMove = (event: Event) => {
      const pointerEvent = event as PointerEvent;
      if (!this.dragStart_) return;

      const currentPos = vec2.fromValues(
        pointerEvent.clientX,
        pointerEvent.clientY
      );
      const dist = vec2.distance(currentPos, this.dragStart_);

      if (dist > this.dragThreshold_) {
        this.applyPanFromClientDelta(this.dragStart_, currentPos, clientToClip);
        this.dragStart_ = currentPos;
      }
    };

    const onPointerUpOrCancel = (_event: Event) => {
      this.dragStart_ = null;
    };

    const onClick = (event: Event) => {
      const mouseEvent = event as MouseEvent;
      const client = vec2.fromValues(mouseEvent.clientX, mouseEvent.clientY);
      const world = this.camera_.clipToWorld(
        clientToClip(client, this.clipDepth)
      );

      let value: unknown | null = null;
      let pickedLayer: Layer | null = null;

      for (const layer of this.layerManager.getLayers()) {
        if (isPickableLayer(layer)) {
          value = layer.getValueAtWorld(world);
          if (value !== null) {
            pickedLayer = layer;
            break;
          }
        }
      }

      this.onPickValue_?.({ client, world, value, layer: pickedLayer });
    };

    return [
      ...base,
      ["pointerdown", onPointerDown],
      ["pointermove", onPointerMove],
      ["pointerup", onPointerUpOrCancel],
      ["pointercancel", onPointerUpOrCancel],
      ["click", onClick],
    ];
  }

  protected applyPanFromClientDelta(
    start: vec2,
    end: vec2,
    clientToClip: ClientToClip
  ) {
    const worldStart = this.camera_.clipToWorld(
      clientToClip(start, this.clipDepth)
    );
    const worldEnd = this.camera_.clipToWorld(
      clientToClip(end, this.clipDepth)
    );
    const delta = vec3.sub(vec3.create(), worldStart, worldEnd);

    this.camera_.pan(delta);
    this.updatePanTarget(delta);
  }
}
