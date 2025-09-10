import { Idetik, Layer } from '@idetik/core-prerelease';

/**
 * Test utility layer that observes runtime state changes
 * to track when the animation loop starts and stops.
 */
export class RuntimeObserverLayer extends Layer {
  private animationFrameCallbacks = 0;
  private isActive = false;

  constructor() {
    super();
  }

  render(): void {
    this.animationFrameCallbacks++;
    this.isActive = true;
  }

  /**
   * Get the number of animation frames that have been rendered
   */
  getFrameCount(): number {
    return this.animationFrameCallbacks;
  }

  /**
   * Check if the layer has been rendered at least once
   */
  isRenderingActive(): boolean {
    return this.isActive;
  }

  /**
   * Reset the frame counter and active state
   */
  reset(): void {
    this.animationFrameCallbacks = 0;
    this.isActive = false;
  }
}

/**
 * Wait for the runtime to start rendering by checking if
 * the observer layer has been called
 */
export async function waitForRuntimeStart(
  runtime: Idetik,
  observer: RuntimeObserverLayer,
  timeout = 1000
): Promise<void> {
  const startTime = Date.now();
  
  while (!observer.isRenderingActive()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for runtime to start');
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

/**
 * Wait for the runtime to stop rendering by checking if
 * the observer layer stops being called
 */
export async function waitForRuntimeStop(
  observer: RuntimeObserverLayer,
  timeout = 1000
): Promise<void> {
  const initialFrameCount = observer.getFrameCount();
  const startTime = Date.now();
  
  // Wait a bit to see if more frames are rendered
  await new Promise(resolve => setTimeout(resolve, 100));
  
  while (observer.getFrameCount() > initialFrameCount) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for runtime to stop');
    }
    const currentFrameCount = observer.getFrameCount();
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // If no new frames after 50ms, consider it stopped
    if (observer.getFrameCount() === currentFrameCount) {
      return;
    }
  }
}

/**
 * Create a test observer and add it to the runtime
 */
export function createRuntimeObserver(runtime: Idetik): RuntimeObserverLayer {
  const observer = new RuntimeObserverLayer();
  runtime.layerManager.add(observer);
  return observer;
}