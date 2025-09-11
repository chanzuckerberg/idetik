import "@testing-library/jest-dom";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { IdetikCanvas } from "../src/components/IdetikCanvas";
import { IdetikProvider } from "../src/components/providers/IdetikProvider";
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

function TestComponent({ showCanvas }: { showCanvas: boolean }) {
  return <IdetikProvider>{showCanvas && <IdetikCanvas />}</IdetikProvider>;
}

describe("IdetikCanvas", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("should throw error when used without IdetikProvider", () => {
    // Suppress console.error for this test since we expect an error
    const originalError = console.error;
    console.error = vi.fn();

    expect(() => {
      render(<IdetikCanvas />);
    }).toThrow();

    console.error = originalError;
  });

  it("should create runtime and start it once", () => {
    const mockIdetik = vi.mocked(Idetik);

    render(<TestComponent showCanvas={true} />);

    expect(mockIdetik).toHaveBeenCalled();
    const mockRuntime = mockIdetik.mock.results[0]?.value;
    expect(mockRuntime.start).toHaveBeenCalledOnce();
  });

  it("should stop and cleanup runtime when unmounted", () => {
    const mockIdetik = vi.mocked(Idetik);

    const { rerender } = render(<TestComponent showCanvas={true} />);

    expect(mockIdetik).toHaveBeenCalled();
    const mockRuntime = mockIdetik.mock.results[0]?.value;
    expect(mockRuntime.start).toHaveBeenCalled();

    rerender(<TestComponent showCanvas={false} />);

    expect(mockRuntime.stop).toHaveBeenCalled();
  });

  it("should handle multiple canvas mount/unmount cycles", () => {
    const mockIdetik = vi.mocked(Idetik);

    const { rerender } = render(<TestComponent showCanvas={false} />);

    // Mount -> Unmount -> Mount cycle
    rerender(<TestComponent showCanvas={true} />);
    expect(mockIdetik).toHaveBeenCalledOnce();

    rerender(<TestComponent showCanvas={false} />);
    expect(mockIdetik.mock.results[0]?.value.stop).toHaveBeenCalledOnce();

    rerender(<TestComponent showCanvas={true} />);
    expect(mockIdetik).toHaveBeenCalledTimes(2);

    // Should have created two separate runtime instances
    expect(mockIdetik.mock.results[0]?.value).not.toBe(
      mockIdetik.mock.results[1]?.value
    );
  });
});
