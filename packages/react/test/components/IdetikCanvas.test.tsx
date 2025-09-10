import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import React from "react";
import { IdetikCanvas } from "../../src/components/IdetikCanvas";
import { IdetikProvider } from "../../src/components/providers/IdetikProvider";
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

describe("IdetikCanvas", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render canvas element with default props", () => {
      render(
        <IdetikProvider>
          <IdetikCanvas />
        </IdetikProvider>
      );

      const canvas = document.querySelector("canvas");
      expect(canvas).toBeInTheDocument();
      expect(canvas).toHaveAttribute("id", "idetik-canvas");
      expect(canvas).toHaveClass("w-full", "h-full");
    });

    it("should render canvas with custom props", () => {
      render(
        <IdetikProvider>
          <IdetikCanvas canvasId="custom-canvas" classNames="custom-class" />
        </IdetikProvider>
      );

      const canvas = document.querySelector("canvas");
      expect(canvas).toBeInTheDocument();
      expect(canvas).toHaveAttribute("id", "custom-canvas");
      expect(canvas).toHaveClass("custom-class");
    });

    it("should throw error when used outside IdetikProvider", () => {
      // Suppress console.error for this test since we expect an error
      const originalError = console.error;
      console.error = vi.fn();

      expect(() => {
        render(<IdetikCanvas />);
      }).toThrow("You must wrap your application in <IdetikProvider>.");

      console.error = originalError;
    });
  });

  describe("Canvas Integration", () => {
    it("should trigger runtime creation when canvas mounts", () => {
      const mockIdetik = vi.mocked(Idetik);

      render(
        <IdetikProvider>
          <IdetikCanvas />
        </IdetikProvider>
      );

      // Canvas mount should trigger runtime creation
      expect(mockIdetik).toHaveBeenCalled();
      const mockRuntime = mockIdetik.mock.results[0]?.value;
      expect(mockRuntime.start).toHaveBeenCalled();
    });

    it("should trigger runtime cleanup when canvas unmounts", () => {
      const mockIdetik = vi.mocked(Idetik);

      function TestComponent({ showCanvas }: { showCanvas: boolean }) {
        return (
          <IdetikProvider>{showCanvas && <IdetikCanvas />}</IdetikProvider>
        );
      }

      const { rerender } = render(<TestComponent showCanvas={true} />);

      // Verify runtime was created
      expect(mockIdetik).toHaveBeenCalled();
      const mockRuntime = mockIdetik.mock.results[0]?.value;
      expect(mockRuntime.start).toHaveBeenCalled();

      // Unmount canvas
      rerender(<TestComponent showCanvas={false} />);

      // Runtime should be stopped
      expect(mockRuntime.stop).toHaveBeenCalled();
    });

    it("should handle multiple canvas mount/unmount cycles", () => {
      const mockIdetik = vi.mocked(Idetik);

      function TestComponent({ showCanvas }: { showCanvas: boolean }) {
        return (
          <IdetikProvider>{showCanvas && <IdetikCanvas />}</IdetikProvider>
        );
      }

      const { rerender } = render(<TestComponent showCanvas={false} />);

      // Mount -> Unmount -> Mount cycle
      rerender(<TestComponent showCanvas={true} />);
      expect(mockIdetik).toHaveBeenCalledTimes(1);

      rerender(<TestComponent showCanvas={false} />);
      expect(mockIdetik.mock.results[0]?.value.stop).toHaveBeenCalled();

      rerender(<TestComponent showCanvas={true} />);
      expect(mockIdetik).toHaveBeenCalledTimes(2);

      // Should have created two separate runtime instances
      expect(mockIdetik.mock.results[0]?.value).not.toBe(
        mockIdetik.mock.results[1]?.value
      );
    });
  });

  describe("Ref Callback", () => {
    it("should call onCanvasChange with canvas element on mount", () => {
      // We can't easily mock the provider internals, so let's just verify
      // the canvas renders and runtime is created (indicating onCanvasChange was called)
      const mockIdetik = vi.mocked(Idetik);

      render(
        <IdetikProvider>
          <IdetikCanvas />
        </IdetikProvider>
      );

      const canvas = document.querySelector("canvas");
      expect(canvas).toBeInTheDocument();
      expect(canvas.tagName).toBe("CANVAS");

      // Runtime creation indicates onCanvasChange was called with canvas element
      expect(mockIdetik).toHaveBeenCalled();
    });

    it("should call onCanvasChange with null on unmount", () => {
      const mockIdetik = vi.mocked(Idetik);

      function TestComponent({ showCanvas }: { showCanvas: boolean }) {
        return (
          <IdetikProvider>{showCanvas && <IdetikCanvas />}</IdetikProvider>
        );
      }

      const { rerender } = render(<TestComponent showCanvas={true} />);

      // Verify canvas was mounted and runtime created
      expect(mockIdetik).toHaveBeenCalled();
      const mockRuntime = mockIdetik.mock.results[0]?.value;

      // Unmount canvas
      rerender(<TestComponent showCanvas={false} />);

      // Should have stopped the runtime (indicating null was passed to onCanvasChange)
      expect(mockRuntime.stop).toHaveBeenCalled();
    });
  });

  describe("DOM Properties", () => {
    it("should be a proper HTML canvas element", () => {
      render(
        <IdetikProvider>
          <IdetikCanvas />
        </IdetikProvider>
      );

      const canvas = document.querySelector("canvas");
      expect(canvas.tagName).toBe("CANVAS");
      expect(canvas).toHaveAttribute("id");
      expect(canvas).toHaveAttribute("class");
    });

    it("should be accessible via test id", () => {
      render(
        <IdetikProvider>
          <IdetikCanvas />
        </IdetikProvider>
      );

      const canvas = document.querySelector("#idetik-canvas");
      expect(canvas).toBeInTheDocument();
      expect(canvas?.tagName).toBe("CANVAS");
    });

    it("should support custom canvas properties", () => {
      render(
        <IdetikProvider>
          <IdetikCanvas
            canvasId="test-id"
            classNames="test-class another-class"
          />
        </IdetikProvider>
      );

      const canvas = document.querySelector("#test-id");
      expect(canvas).toBeInTheDocument();
      expect(canvas).toHaveClass("test-class", "another-class");
    });
  });

  describe("Error Boundaries", () => {
    it("should handle provider context gracefully", () => {
      // This test verifies that the component properly uses the context
      // without throwing errors when properly wrapped
      expect(() => {
        render(
          <IdetikProvider>
            <IdetikCanvas />
          </IdetikProvider>
        );
      }).not.toThrow();
    });
  });
});
