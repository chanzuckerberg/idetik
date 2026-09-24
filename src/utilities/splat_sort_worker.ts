/// <reference lib="webworker" />

import { sortSplatsBackToFront } from "./splat_sort";

export type SplatSortRequest =
  | {
      type: "setCenters";
      version: number;
      centers: Float32Array;
      /** Length of the returned order buffers, at least the splat count. */
      orderLength: number;
    }
  | { type: "sort"; version: number; viewZ: number[] };

export type SplatSortResponse = { version: number; order: Uint32Array };

let version = -1;
let centers: Float32Array = new Float32Array(0);
let depths = new Float32Array(0);
let orderLength = 0;

self.addEventListener("message", (e: MessageEvent<SplatSortRequest>) => {
  const request = e.data;
  if (request.type === "setCenters") {
    version = request.version;
    centers = request.centers;
    depths = new Float32Array(centers.length / 3);
    orderLength = request.orderLength;
    return;
  }
  if (request.version !== version) return;
  const order = new Uint32Array(orderLength);
  sortSplatsBackToFront(centers, request.viewZ, order, depths);
  const response: SplatSortResponse = { version, order };
  self.postMessage(response, [order.buffer]);
});
