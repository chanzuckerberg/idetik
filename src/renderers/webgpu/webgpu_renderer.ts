import { Camera } from "@/objects/cameras/camera";
import { Layer } from "@/core/layer";
import { Logger } from "@/utilities/logger";
import { Renderer } from "@/core/renderer";
import { Viewport } from "@/core/viewport";

export async function createWebGPURenderer(canvas: HTMLCanvasElement) {
    if (!navigator.gpu) {
        throw new Error("WebGPU is not supported in this browser");
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        throw new Error("Failed to obtain a WebGPU Adapter");
    }

    return new WebGPURenderer(canvas, await adapter.requestDevice());
}

class WebGPURenderer extends Renderer {
    private readonly device_: GPUDevice;
    private readonly format_: GPUTextureFormat;
    private readonly context_: GPUCanvasContext;

    constructor(canvas: HTMLCanvasElement, device: GPUDevice) {
        super(canvas);

        this.device_ = device;
        this.format_ = navigator.gpu.getPreferredCanvasFormat();

        const context = canvas.getContext("webgpu");
        if (!context) {
            throw new Error("Failed to initialize WebGPU context");
        }

        this.context_ = context;
        this.context_.configure({
            device: this.device_,
            format: this.format_,
            alphaMode: "opaque"
        });

        Logger.info("WebGPURenderer", "WebGPU Initialized");
    }

    public render(_viewport: Viewport) {
        const commandEncoder = this.device_.createCommandEncoder();
        const passEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: this.context_.getCurrentTexture().createView(),
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
                loadOp: "clear",
                storeOp: "store"
            }]
        });

        passEncoder.end();
        this.device_.queue.submit([commandEncoder.finish()]);
    }

    protected renderObject(_layer: Layer, _objectIndex: number, _camera: Camera): void {

    }

    protected clear() {

    }

    protected resize() {

    }
};