import {
  ChunkData,
  ChunkDataConstructor,
  ChunkDataRange,
  computeChunkDataRange,
} from "../chunk";

export type SliceSpec = {
  targetShape: { x: number; y: number; z: number };
  chunkIndex: { c: number; t: number };
  dimIndices: { x: number; y: number; z?: number; c?: number; t?: number };
  cChunkSize?: number;
  tChunkSize?: number;
};

export type ProcessedChunk = {
  data: ChunkData;
  dataRange: ChunkDataRange;
};

export function processChunk(
  receivedData: ChunkData,
  receivedShape: number[],
  receivedStride: number[],
  spec: SliceSpec
): ProcessedChunk {
  const data = sliceReceivedChunk(
    receivedData,
    receivedShape,
    receivedStride,
    spec
  );
  const dataRange = computeChunkDataRange(data);
  return { data, dataRange };
}

function sliceReceivedChunk(
  receivedData: ChunkData,
  receivedShape: number[],
  receivedStride: number[],
  spec: SliceSpec
): ChunkData {
  const { targetShape, chunkIndex, dimIndices } = spec;

  let stride = 1;
  for (let i = receivedShape.length - 1; i >= 0; i--) {
    if (receivedStride[i] !== stride) {
      throw new Error(
        `Chunk data is not tightly packed, stride=${JSON.stringify(receivedStride)}, shape=${JSON.stringify(receivedShape)}`
      );
    }
    stride *= receivedShape[i];
  }

  const receivedSpatialShape = {
    x: receivedShape[dimIndices.x],
    y: receivedShape[dimIndices.y],
    z: dimIndices.z !== undefined ? receivedShape[dimIndices.z] : targetShape.z,
  };

  if (
    receivedSpatialShape.x < targetShape.x ||
    receivedSpatialShape.y < targetShape.y ||
    receivedSpatialShape.z < targetShape.z
  ) {
    throw new Error(
      `Received chunk too small: expected ${JSON.stringify(targetShape)}, got ${JSON.stringify(receivedSpatialShape)}`
    );
  }

  const cOffsetInSource = spec.cChunkSize ? chunkIndex.c % spec.cChunkSize : 0;
  const tOffsetInSource = spec.tChunkSize ? chunkIndex.t % spec.tChunkSize : 0;

  const compactSize = targetShape.x * targetShape.y * targetShape.z;

  const cStride = dimIndices.c !== undefined ? receivedStride[dimIndices.c] : 0;
  const tStride = dimIndices.t !== undefined ? receivedStride[dimIndices.t] : 0;

  const srcOffset = tOffsetInSource * tStride + cOffsetInSource * cStride;

  const receivedExactShape =
    receivedSpatialShape.x === targetShape.x &&
    receivedSpatialShape.y === targetShape.y &&
    receivedSpatialShape.z === targetShape.z;

  const noSlicingNeeded =
    srcOffset === 0 &&
    receivedData.length === compactSize &&
    receivedExactShape;

  if (noSlicingNeeded) {
    return receivedData;
  }

  const compactData = new (receivedData.constructor as ChunkDataConstructor)(
    compactSize
  );

  const zStride = dimIndices.z !== undefined ? receivedStride[dimIndices.z] : 0;
  const yStride = receivedStride[dimIndices.y];
  let destOffset = 0;
  for (let z = 0; z < targetShape.z; z++) {
    const zStart = srcOffset + z * zStride;
    for (let y = 0; y < targetShape.y; y++) {
      const srcStart = zStart + y * yStride;
      const srcEnd = srcStart + targetShape.x;
      compactData.set(receivedData.subarray(srcStart, srcEnd), destOffset);
      destOffset += targetShape.x;
    }
  }

  return compactData;
}
