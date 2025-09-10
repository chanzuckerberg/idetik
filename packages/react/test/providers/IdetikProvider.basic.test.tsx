import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import React, { useEffect, useRef } from 'react';
import { IdetikProvider } from '../../src/components/providers/IdetikProvider';
import { useIdetik } from '../../src/hooks/useIdetik';
import { Idetik } from '@idetik/core-prerelease';

// Mock the core library to avoid WebGL issues in jsdom
vi.mock('@idetik/core-prerelease', () => ({
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

describe('IdetikProvider - Basic Tests', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('Context Value', () => {
    it('should provide initial context value with runtime as null', () => {
      let capturedContext: ReturnType<typeof useIdetik> | undefined;
      
      function TestComponent() {
        const context = useIdetik();
        capturedContext = context;
        return <div>Test</div>;
      }

      render(
        <IdetikProvider>
          <TestComponent />
        </IdetikProvider>
      );

      expect(capturedContext?.runtime).toBeNull();
      expect(typeof capturedContext?.onCanvasChange).toBe('function');
    });

    it('should update context when runtime is created', () => {
      let capturedContext: ReturnType<typeof useIdetik> | undefined;
      
      function TestCanvasComponent() {
        const context = useIdetik();
        const canvasRef = useRef<HTMLCanvasElement>(null);
        capturedContext = context;
        
        useEffect(() => {
          if (canvasRef.current) {
            context.onCanvasChange(canvasRef.current);
          }
        }, [context]);

        return <canvas ref={canvasRef} data-testid="test-canvas" />;
      }

      render(
        <IdetikProvider>
          <TestCanvasComponent />
        </IdetikProvider>
      );

      expect(capturedContext?.runtime).not.toBeNull();
      expect(capturedContext?.runtime?.start).toBeDefined();
      expect(capturedContext?.runtime?.stop).toBeDefined();
    });
  });

  describe('Runtime Lifecycle', () => {
    it('should create and start runtime when canvas mounts', () => {
      const mockIdetik = vi.mocked(Idetik);
      
      function TestCanvasComponent() {
        const { onCanvasChange } = useIdetik();
        const canvasRef = useRef<HTMLCanvasElement>(null);
        
        useEffect(() => {
          if (canvasRef.current) {
            onCanvasChange(canvasRef.current);
          }
        }, [onCanvasChange]);

        return <canvas ref={canvasRef} data-testid="test-canvas" />;
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

    it('should stop runtime when canvas unmounts', () => {
      const mockIdetik = vi.mocked(Idetik);
      let capturedContext: ReturnType<typeof useIdetik> | undefined;
      
      function TestCanvasComponent({ shouldRender }: { shouldRender: boolean }) {
        const context = useIdetik();
        const canvasRef = useRef<HTMLCanvasElement>(null);
        capturedContext = context;
        
        useEffect(() => {
          if (shouldRender && canvasRef.current) {
            context.onCanvasChange(canvasRef.current);
          } else if (!shouldRender) {
            context.onCanvasChange(null);
          }
        }, [shouldRender, context]);

        return shouldRender ? <canvas ref={canvasRef} data-testid="test-canvas" /> : null;
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

  describe('Edge Cases', () => {
    it('should handle multiple mount/unmount cycles', () => {
      const mockIdetik = vi.mocked(Idetik);
      let capturedContext: ReturnType<typeof useIdetik> | undefined;
      
      function TestCanvasComponent({ shouldRender }: { shouldRender: boolean }) {
        const context = useIdetik();
        const canvasRef = useRef<HTMLCanvasElement>(null);
        capturedContext = context;
        
        useEffect(() => {
          if (shouldRender && canvasRef.current) {
            context.onCanvasChange(canvasRef.current);
          } else if (!shouldRender) {
            context.onCanvasChange(null);
          }
        }, [shouldRender, context]);

        return shouldRender ? <canvas ref={canvasRef} data-testid="test-canvas" /> : null;
      }

      const { rerender } = render(
        <IdetikProvider>
          <TestCanvasComponent shouldRender={false} />
        </IdetikProvider>
      );

      // Mount -> Unmount -> Mount cycle
      rerender(<IdetikProvider><TestCanvasComponent shouldRender={true} /></IdetikProvider>);
      expect(capturedContext?.runtime).not.toBeNull();
      
      rerender(<IdetikProvider><TestCanvasComponent shouldRender={false} /></IdetikProvider>);
      expect(capturedContext?.runtime).toBeNull();
      
      rerender(<IdetikProvider><TestCanvasComponent shouldRender={true} /></IdetikProvider>);
      expect(capturedContext?.runtime).not.toBeNull();

      // Should have created two separate runtime instances
      expect(mockIdetik).toHaveBeenCalledTimes(2);
    });

    it('should not create runtime when canvas is null', () => {
      const mockIdetik = vi.mocked(Idetik);
      let capturedContext: ReturnType<typeof useIdetik> | undefined;
      
      function TestCanvasComponent() {
        const context = useIdetik();
        capturedContext = context;
        
        useEffect(() => {
          // Call onCanvasChange with null (simulating unmount)
          context.onCanvasChange(null);
        }, [context]);

        return <div>No canvas</div>;
      }

      render(
        <IdetikProvider>
          <TestCanvasComponent />
        </IdetikProvider>
      );

      // Should not create any runtime instance when canvas is null
      expect(mockIdetik).toHaveBeenCalledTimes(0);
      expect(capturedContext?.runtime).toBeNull();
    });
  });
});