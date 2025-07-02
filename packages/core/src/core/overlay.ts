import { Idetik } from "../idetik";

export type Overlay = {
  update(idetik: Idetik, timestamp?: DOMHighResTimeStamp): void;
};
