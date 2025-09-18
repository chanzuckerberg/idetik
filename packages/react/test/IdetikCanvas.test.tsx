import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { IdetikCanvas } from "../src/components/IdetikCanvas";
import { IdetikProvider } from "../src/components/providers/IdetikProvider";
import { Idetik } from "@idetik/core-prerelease";

vi.mock("@idetik/core-prerelease", () => ({
  Idetik: vi.fn().mockImplementation((props) => ({
    start: vi.fn(),
    stop: vi.fn(),
    canvas: props.canvas,
    camera: props.camera,
    cameraControls: props.cameraControls,
  })),
  OrthographicCamera: vi.fn().mockImplementation(() => ({ mockCamera: true })),
  PanZoomControls: vi.fn().mockImplementation(() => ({ mockControls: true })),
}));

function TestComponent() {
  return (
    <IdetikProvider>
      <IdetikCanvas />
    </IdetikProvider>
  );
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

  it("should throw error when more than one IdetikCanvas is used", () => {
    // Suppress console.error for this test since we expect an error
    const originalError = console.error;
    console.error = vi.fn();

    expect(() => {
      render(
        <IdetikProvider>
          <IdetikCanvas />
          <IdetikCanvas />
        </IdetikProvider>
      );
    }).toThrow();

    console.error = originalError;
  });

  it("should create runtime and start it once", () => {
    const mockIdetik = vi.mocked(Idetik);

    render(<TestComponent />);

    expect(mockIdetik).toHaveBeenCalledOnce();
    const mockRuntime = mockIdetik.mock.results[0]?.value;
    expect(mockRuntime.start).toHaveBeenCalledOnce();
  });

  it("should stop and cleanup runtime when unmounted", () => {
    const mockIdetik = vi.mocked(Idetik);
    const { unmount } = render(<TestComponent />);
    expect(mockIdetik).toHaveBeenCalledOnce();
    const mockRuntime = mockIdetik.mock.results[0]?.value;
    expect(mockRuntime.start).toHaveBeenCalledOnce();

    unmount();

    expect(mockRuntime.stop).toHaveBeenCalledOnce();
  });

  it("should handle multiple canvas mount/unmount cycles", () => {
    const mockIdetik = vi.mocked(Idetik);
    const { unmount } = render(<TestComponent />);
    expect(mockIdetik).toHaveBeenCalledOnce();
    const mockRuntime = mockIdetik.mock.results[0]?.value;
    expect(mockRuntime.start).toHaveBeenCalledOnce();
    unmount();
    expect(mockRuntime.stop).toHaveBeenCalledOnce();

    render(<TestComponent />);

    expect(mockIdetik).toHaveBeenCalledTimes(2);
    expect(mockIdetik.mock.results[1]?.value).not.toBe(mockRuntime);
  });
});
