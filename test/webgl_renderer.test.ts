import { expect, test } from 'vitest'

import { WebGLRenderer } from '@';
import { LayerManager } from '@';


test('Instantiate WebGLRenderer', () => {
  document.body.innerHTML = '<canvas id="canvas"></canvas>';
  const renderer = new WebGLRenderer('#canvas', new LayerManager());
  expect(renderer).toBeDefined();
});

test('Instantiate WebGLRenderer with invalid selector', () => {
  document.body.innerHTML = '';
  expect(() => new WebGLRenderer('#canvas', new LayerManager())).toThrowError();
});

test('Instantiate WebGLRenderer with no OpenGL context', () => {
  document.body.innerHTML = '<canvas id="canvas"></canvas>';
  const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;
  // mock getContext to return null
  canvas.getContext = () => null;
  expect(() => new WebGLRenderer('#canvas', new LayerManager())).toThrowError();
});
