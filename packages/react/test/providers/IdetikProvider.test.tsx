import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { IdetikProvider } from "../../src/components/providers/IdetikProvider";
import { IdetikContextValue, useIdetik } from "../../src/hooks/useIdetik";
import { Idetik } from "@idetik/core-prerelease";

// Mock the core library to avoid WebGL issues in jsdom
vi.mock("@idetik/core-prerelease", () => ({
  Idetik: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    camera: { mockCamera: true },
    cameraControls: { mockControls: true },
    layerManager: { mockLayerManager: true },
  })),
  OrthographicCamera: vi.fn().mockImplementation(() => ({ mockCamera: true })),
  PanZoomControls: vi.fn().mockImplementation(() => ({ mockControls: true })),
}));

describe("IdetikProvider", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("Context Value", () => {
    it("non-canvas component should provide context with null runtime", () => {
      let context: IdetikContextValue | undefined;

      function TestComponent() {
        context = useIdetik();
        return <div>Test</div>;
      }

      render(
        <IdetikProvider>
          <TestComponent />
        </IdetikProvider>
      );

      expect(context?.runtime).toBeNull();
    });

    it("canvas component should update context when runtime is created", () => {
      let context: IdetikContextValue | undefined;

      function TestCanvasComponent() {
        context = useIdetik();
        return (
          <canvas ref={context.onCanvasChange} data-testid="test-canvas" />
        );
      }

      render(
        <IdetikProvider>
          <TestCanvasComponent />
        </IdetikProvider>
      );

      expect(context?.runtime).not.toBeNull();
    });
  });

  describe("Runtime Lifecycle", () => {
    it("should create and start runtime when canvas mounts", () => {
      const mockIdetik = vi.mocked(Idetik);

      function TestCanvasComponent() {
        const { onCanvasChange } = useIdetik();
        return <canvas ref={onCanvasChange} data-testid="test-canvas" />;
      }

      render(
        <IdetikProvider>
          <TestCanvasComponent />
        </IdetikProvider>
      );

      expect(mockIdetik).toHaveBeenCalled();
      const mockRuntime = mockIdetik.mock.results[0]?.value;
      expect(mockRuntime.start).toHaveBeenCalled();
    });

    it("should stop runtime when canvas unmounts", () => {
      const mockIdetik = vi.mocked(Idetik);
      let capturedContext: IdetikContextValue | undefined;

      function TestCanvasComponent({
        shouldRender,
      }: {
        shouldRender: boolean;
      }) {
        const context = useIdetik();
        capturedContext = context;
        return shouldRender ? (
          <canvas ref={context.onCanvasChange} data-testid="test-canvas" />
        ) : null;
      }

      const { rerender } = render(
        <IdetikProvider>
          <TestCanvasComponent shouldRender={true} />
        </IdetikProvider>
      );

      // Runtime should be created
      expect(capturedContext?.runtime).not.toBeNull();
      const mockRuntime = mockIdetik.mock.results[0]?.value;
      expect(mockRuntime.start).toHaveBeenCalled();

      // Unmount canvas
      rerender(
        <IdetikProvider>
          <TestCanvasComponent shouldRender={false} />
        </IdetikProvider>
      );

      // Runtime should be stopped and set to null
      expect(mockRuntime.stop).toHaveBeenCalled();
      expect(capturedContext?.runtime).toBeNull();
    });
  });

  describe("Edge Cases", () => {
    it("should handle multiple mount/unmount cycles", () => {
      const mockIdetik = vi.mocked(Idetik);
      let context: IdetikContextValue | undefined;

      function TestCanvasComponent({
        shouldRender,
      }: {
        shouldRender: boolean;
      }) {
        context = useIdetik();
        return shouldRender ? (
          <canvas ref={context.onCanvasChange} data-testid="test-canvas" />
        ) : null;
      }

      const { rerender } = render(
        <IdetikProvider>
          <TestCanvasComponent shouldRender={false} />
        </IdetikProvider>
      );

      // Mount -> Unmount -> Mount cycle
      rerender(
        <IdetikProvider>
          <TestCanvasComponent shouldRender={true} />
        </IdetikProvider>
      );
      expect(context?.runtime).not.toBeNull();

      rerender(
        <IdetikProvider>
          <TestCanvasComponent shouldRender={false} />
        </IdetikProvider>
      );
      expect(context?.runtime).toBeNull();

      rerender(
        <IdetikProvider>
          <TestCanvasComponent shouldRender={true} />
        </IdetikProvider>
      );
      expect(context?.runtime).not.toBeNull();

      // Should have created two separate runtime instances
      expect(mockIdetik).toHaveBeenCalledTimes(2);
    });

    it("should not create runtime when canvas is null", () => {
      const mockIdetik = vi.mocked(Idetik);
      let context: IdetikContextValue | undefined;

      function TestCanvasComponent() {
        context = useIdetik();
        return <div>No canvas</div>;
      }

      render(
        <IdetikProvider>
          <TestCanvasComponent />
        </IdetikProvider>
      );

      expect(mockIdetik).toHaveBeenCalledTimes(0);
      expect(context?.runtime).toBeNull();
    });
  });
});
