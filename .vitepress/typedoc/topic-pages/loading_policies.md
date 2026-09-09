Factory functions for creating chunk loading policies.

A loading policy controls how layers load image data: how far to
prefetch beyond the visible region, the order in which chunk requests
are served, and which levels of detail can load. Every image, label,
and volume layer takes an optional `policy` at construction and
defaults to an exploration policy.

```ts
const layer = new ImageLayer({
  source,
  sliceCoords: { z: 0, t: 0, c: undefined },
  policy: createPlaybackPolicy(),
});
```
