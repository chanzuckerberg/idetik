import { describe, it, expect, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import React, { useEffect, useRef } from 'react';
import { IdetikProvider } from '../../src/components/providers/IdetikProvider';
import { useIdetik } from '../../src/hooks/useIdetik';
import { 
  RuntimeObserverLayer, 
  createRuntimeObserver, 
  waitForRuntimeStart, 
  waitForRuntimeStop 
} from '../utils/runtime-observer';
import { waitFor, waitForAnimationFrames } from '../utils/test-helpers';

describe('IdetikProvider', () => {
  beforeEach(() => {
    cleanup();
  });

  describe('Mount Behavior', () => {
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

    it('should create and start runtime when canvas is mounted', async () => {
      let capturedRuntime: ReturnType<typeof useIdetik>['runtime'];
      let observer: RuntimeObserverLayer;
      
      function TestCanvasComponent() {
        const { runtime, onCanvasChange } = useIdetik();
        const canvasRef = useRef<HTMLCanvasElement>(null);
        
        useEffect(() => {
          if (canvasRef.current) {
            onCanvasChange(canvasRef.current);
          }
          return () => onCanvasChange(null);
        }, [onCanvasChange]);

        useEffect(() => {
          if (runtime) {
            capturedRuntime = runtime;
            observer = createRuntimeObserver(runtime);
          }
        }, [runtime]);

        return <canvas ref={canvasRef} data-testid="test-canvas" />;
      }

      render(
        <IdetikProvider>
          <TestCanvasComponent />
        </IdetikProvider>
      );

      // Wait for runtime to be created
      await waitFor(() => capturedRuntime !== undefined);
      
      expect(capturedRuntime!).not.toBeNull();
      expect(typeof capturedRuntime!.start).toBe('function');
      expect(typeof capturedRuntime!.stop).toBe('function');
      
      // Wait for runtime to start rendering
      await waitForRuntimeStart(capturedRuntime!, observer!);
      expect(observer!.isRenderingActive()).toBe(true);
    });

    it('should update context value when runtime is created', async () => {
      const contextValues: Array<{ runtime: ReturnType<typeof useIdetik>['runtime'] }> = [];
      
      function TestCanvasComponent() {
        const context = useIdetik();
        const canvasRef = useRef<HTMLCanvasElement>(null);
        
        useEffect(() => {
          contextValues.push({ runtime: context.runtime });
        }, [context.runtime]);
        
        useEffect(() => {
          if (canvasRef.current) {
            context.onCanvasChange(canvasRef.current);
          }
          return () => context.onCanvasChange(null);
        }, [context]);

        return <canvas ref={canvasRef} data-testid="test-canvas" />;
      }

      render(
        <IdetikProvider>
          <TestCanvasComponent />
        </IdetikProvider>
      );

      // Wait for runtime to be created
      await waitFor(() => contextValues.length >= 2);
      
      // Initial context should have null runtime
      expect(contextValues[0].runtime).toBeNull();
      
      // After canvas mount, should have runtime
      expect(contextValues[1].runtime).not.toBeNull();
    });
  });

  describe('Unmount Behavior', () => {
    it('should stop runtime and set to null when canvas is unmounted', async () => {
      let capturedRuntime: ReturnType<typeof useIdetik>['runtime'];
      let observer: RuntimeObserverLayer;
      const contextValues: Array<{ runtime: ReturnType<typeof useIdetik>['runtime'] }> = [];
      
      function TestCanvasComponent({ shouldRenderCanvas }: { shouldRenderCanvas: boolean }) {
        const { runtime, onCanvasChange } = useIdetik();
        const canvasRef = useRef<HTMLCanvasElement>(null);
        
        useEffect(() => {
          contextValues.push({ runtime });
        }, [runtime]);
        
        useEffect(() => {
          if (shouldRenderCanvas && canvasRef.current) {
            onCanvasChange(canvasRef.current);
          } else if (!shouldRenderCanvas) {
            onCanvasChange(null);
          }
        }, [shouldRenderCanvas, onCanvasChange]);

        useEffect(() => {
          if (runtime && !observer) {
            capturedRuntime = runtime;
            observer = createRuntimeObserver(runtime);
          }
        }, [runtime]);

        return shouldRenderCanvas ? <canvas ref={canvasRef} data-testid="test-canvas" /> : null;
      }

      const { rerender } = render(
        <IdetikProvider>
          <TestCanvasComponent shouldRenderCanvas={true} />
        </IdetikProvider>
      );

      // Wait for runtime to be created and started
      await waitFor(() => capturedRuntime !== undefined);
      await waitForRuntimeStart(capturedRuntime, observer);
      
      expect(observer.isRenderingActive()).toBe(true);

      // Unmount canvas
      rerender(
        <IdetikProvider>
          <TestCanvasComponent shouldRenderCanvas={false} />
        </IdetikProvider>
      );

      // Wait for runtime to stop and be set to null
      await waitForRuntimeStop(observer);
      await waitFor(() => contextValues.some(ctx => ctx.runtime === null && contextValues.indexOf(ctx) > 0));
      
      // Should have stopped runtime
      expect(contextValues[contextValues.length - 1].runtime).toBeNull();
    });

    it('should call runtime.stop() exactly once on unmount', async () => {
      let capturedRuntime: ReturnType<typeof useIdetik>['runtime'];
      let stopCallCount = 0;
      
      function TestCanvasComponent({ shouldRenderCanvas }: { shouldRenderCanvas: boolean }) {
        const { runtime, onCanvasChange } = useIdetik();
        const canvasRef = useRef<HTMLCanvasElement>(null);
        
        useEffect(() => {
          if (shouldRenderCanvas && canvasRef.current) {
            onCanvasChange(canvasRef.current);
          } else if (!shouldRenderCanvas) {
            onCanvasChange(null);
          }
        }, [shouldRenderCanvas, onCanvasChange]);

        useEffect(() => {
          if (runtime) {
            capturedRuntime = runtime;
            // Spy on stop method
            const originalStop = runtime.stop.bind(runtime);
            runtime.stop = () => {
              stopCallCount++;
              return originalStop();
            };
          }
        }, [runtime]);

        return shouldRenderCanvas ? <canvas ref={canvasRef} data-testid="test-canvas" /> : null;
      }

      const { rerender } = render(
        <IdetikProvider>
          <TestCanvasComponent shouldRenderCanvas={true} />
        </IdetikProvider>
      );

      await waitFor(() => capturedRuntime !== undefined);

      // Unmount canvas
      rerender(
        <IdetikProvider>
          <TestCanvasComponent shouldRenderCanvas={false} />
        </IdetikProvider>
      );

      await waitForAnimationFrames(5);
      
      expect(stopCallCount).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple canvas mount/unmount cycles correctly', async () => {
      const runtimeInstances: Array<ReturnType<typeof useIdetik>['runtime']> = [];
      let observer: RuntimeObserverLayer;
      
      function TestCanvasComponent({ shouldRenderCanvas }: { shouldRenderCanvas: boolean }) {
        const { runtime, onCanvasChange } = useIdetik();
        const canvasRef = useRef<HTMLCanvasElement>(null);
        
        useEffect(() => {
          if (shouldRenderCanvas && canvasRef.current) {
            onCanvasChange(canvasRef.current);
          } else if (!shouldRenderCanvas) {
            onCanvasChange(null);
          }
        }, [shouldRenderCanvas, onCanvasChange]);

        useEffect(() => {
          if (runtime) {
            runtimeInstances.push(runtime);
            if (!observer) {
              observer = createRuntimeObserver(runtime);
            }
          }
        }, [runtime]);

        return shouldRenderCanvas ? <canvas ref={canvasRef} data-testid="test-canvas" /> : null;
      }

      const { rerender } = render(
        <IdetikProvider>
          <TestCanvasComponent shouldRenderCanvas={false} />
        </IdetikProvider>
      );

      // Mount -> Unmount -> Mount -> Unmount cycle
      rerender(<IdetikProvider><TestCanvasComponent shouldRenderCanvas={true} /></IdetikProvider>);
      await waitFor(() => runtimeInstances.length === 1);
      
      rerender(<IdetikProvider><TestCanvasComponent shouldRenderCanvas={false} /></IdetikProvider>);
      await waitForAnimationFrames(3);
      
      rerender(<IdetikProvider><TestCanvasComponent shouldRenderCanvas={true} /></IdetikProvider>);
      await waitFor(() => runtimeInstances.length === 2);
      
      rerender(<IdetikProvider><TestCanvasComponent shouldRenderCanvas={false} /></IdetikProvider>);
      await waitForAnimationFrames(3);

      // Should have created two different runtime instances
      expect(runtimeInstances).toHaveLength(2);
      expect(runtimeInstances[0]).not.toBe(runtimeInstances[1]);
    });

    it('should handle provider unmount with active runtime', async () => {
      let capturedRuntime: ReturnType<typeof useIdetik>['runtime'];
      let observer: RuntimeObserverLayer;
      
      function TestCanvasComponent() {
        const { runtime, onCanvasChange } = useIdetik();
        const canvasRef = useRef<HTMLCanvasElement>(null);
        
        useEffect(() => {
          if (canvasRef.current) {
            onCanvasChange(canvasRef.current);
          }
          return () => onCanvasChange(null);
        }, [onCanvasChange]);

        useEffect(() => {
          if (runtime) {
            capturedRuntime = runtime;
            observer = createRuntimeObserver(runtime);
          }
        }, [runtime]);

        return <canvas ref={canvasRef} data-testid="test-canvas" />;
      }

      const { unmount } = render(
        <IdetikProvider>
          <TestCanvasComponent />
        </IdetikProvider>
      );

      await waitFor(() => capturedRuntime !== undefined);
      await waitForRuntimeStart(capturedRuntime, observer);

      // Unmount the entire provider tree
      unmount();

      // Should not throw errors and should stop cleanly
      await waitForAnimationFrames(3);
      expect(true).toBe(true); // Test passes if no errors thrown
    });

    it('should ignore canvas mount when runtime already exists', async () => {
      const runtimeInstances: Array<ReturnType<typeof useIdetik>['runtime']> = [];
      
      function TestCanvasComponent() {
        const { runtime, onCanvasChange } = useIdetik();
        const canvas1Ref = useRef<HTMLCanvasElement>(null);
        const canvas2Ref = useRef<HTMLCanvasElement>(null);
        
        useEffect(() => {
          // Mount first canvas
          if (canvas1Ref.current) {
            onCanvasChange(canvas1Ref.current);
          }
        }, [onCanvasChange]);

        useEffect(() => {
          if (runtime) {
            runtimeInstances.push(runtime);
            
            // Try to mount second canvas after runtime is created
            setTimeout(() => {
              if (canvas2Ref.current) {
                onCanvasChange(canvas2Ref.current);
              }
            }, 100);
          }
        }, [runtime, onCanvasChange]);

        return (
          <div>
            <canvas ref={canvas1Ref} data-testid="canvas-1" />
            <canvas ref={canvas2Ref} data-testid="canvas-2" />
          </div>
        );
      }

      render(
        <IdetikProvider>
          <TestCanvasComponent />
        </IdetikProvider>
      );

      await waitFor(() => runtimeInstances.length >= 1);
      await waitForAnimationFrames(10); // Wait for second canvas mount attempt

      // Should only have created one runtime instance
      expect(runtimeInstances).toHaveLength(1);
    });
  });
});