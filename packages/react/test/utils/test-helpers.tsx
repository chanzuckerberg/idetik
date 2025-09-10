import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { IdetikProvider } from '../../src/components/providers/IdetikProvider';

/**
 * Custom render function that wraps components with IdetikProvider
 */
export function renderWithProvider(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <IdetikProvider>{children}</IdetikProvider>;
  }

  return render(ui, { wrapper: Wrapper, ...options });
}

/**
 * Wait for a condition to be true with timeout
 */
export async function waitFor(
  condition: () => boolean,
  timeout = 1000,
  interval = 10
): Promise<void> {
  const startTime = Date.now();
  
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
}

/**
 * Wait for multiple animation frames to ensure async operations complete
 */
export async function waitForAnimationFrames(count = 3): Promise<void> {
  for (let i = 0; i < count; i++) {
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
}