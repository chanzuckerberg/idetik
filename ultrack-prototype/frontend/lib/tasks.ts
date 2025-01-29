import { vec2, vec3 } from "gl-matrix";

import { ImageSeriesLayer, OmeZarrImageSource, TracksLayer } from "@";
import { Region } from "@/data/region";

type Track = {
  trackId: number;
  time: number[];
  position: vec2[] | vec3[];
};

function trackFromJSON(trackJSON: unknown): Track {
  if (typeof trackJSON !== "object" || trackJSON === null) {
    throw new Error("Invalid input: expected a JSON object");
  }

  const { track_id, time, position } = trackJSON as Record<string, unknown>;

  if (typeof track_id !== "number") {
    throw new Error("Invalid trackId, expected a number");
  }

  if (!Array.isArray(time) || time.some((t) => typeof t !== "number")) {
    throw new Error("Invalid time, expected an array of numbers");
  }

  if (!Array.isArray(position) || position.some((pos) => !Array.isArray(pos))) {
    throw new Error("Invalid position, expected an array of arrays");
  }

  if (
    !(
      position.every((pos) => pos.length === 2) ||
      position.every((pos) => pos.length === 3)
    )
  ) {
    throw new Error(
      "Invalid position, expected an array of 2 or 3 element arrays"
    );
  }

  if (position.length !== time.length) {
    throw new Error(
      "Invalid position or time, expected arrays of the same length"
    );
  }

  return { trackId: track_id, time, position };
}

type ImageData = {
  url: string;
  timeDimension: string;
  sliceIndices: Map<string, number>;
};

function imageDataFromJSON(imageJSON: unknown): ImageData {
  if (typeof imageJSON !== "object" || imageJSON === null) {
    throw new Error("Invalid input: expected a JSON object");
  }

  const { url, time_dimension, slice_indices } = imageJSON as Record<
    string,
    unknown
  >;

  if (typeof url !== "string") {
    throw new Error(`Invalid url (${url}), expected a string`);
  }

  if (typeof time_dimension !== "string") {
    throw new Error(
      `Invalid time_dimension (${time_dimension}), expected a string`
    );
  }

  if (!(slice_indices instanceof Object)) {
    throw new Error(
      `Invalid slice_indices (${slice_indices}), expected an Object`
    );
  }
  const sliceIndices = new Map<string, number>();
  for (const [d, i] of Object.entries(slice_indices)) {
    if (typeof d !== "string") {
      throw new Error(`Invalid slice_indices key (${d}), expected a string`);
    }
    if (typeof i !== "number") {
      throw new Error(`Invalid slice_indices value (${i}), expected a number`);
    }
    sliceIndices.set(d, i);
  }

  return { url, timeDimension: time_dimension, sliceIndices };
}

type TaskData = {
  nodeId: number;
  tracksData: Track[];
  imageData: ImageData;
};

function taskDataFromJSON(taskDataJSON: unknown): TaskData {
  if (typeof taskDataJSON !== "object" || taskDataJSON === null) {
    throw new Error("Invalid input: expected a JSON object");
  }

  const { node_id, tracks_data, image_data } = taskDataJSON as Record<
    string,
    unknown
  >;

  if (typeof node_id !== "number") {
    throw new Error("Invalid nodeId, expected a number");
  }

  if (!Array.isArray(tracks_data)) {
    throw new Error("Invalid tracksData, expected an array");
  }

  const tracksData = tracks_data.map(trackFromJSON);

  const imageData = imageDataFromJSON(image_data);

  return { nodeId: node_id, tracksData, imageData };
}

const TASK_TYPES = ["appearance", "disappearance", "division"] as const;
export type TaskType = (typeof TASK_TYPES)[number];

function isValidTaskType(taskType: unknown): taskType is TaskType {
  return (
    typeof taskType === "string" && TASK_TYPES.includes(taskType as TaskType)
  );
}

export type AnswerType = "Unanswered" | "Yes" | "No" | "Uncertain";
export type SyncStatus = "synced" | "not_synced" | "pending" | "error";

export type Answer = {
  answerId: string;
  taskId: string;
  value: AnswerType;
  synced: SyncStatus;
};

const defaultAnswer = (taskId: string) => {
  return {
    answerId: window.crypto.randomUUID(),
    taskId: taskId,
    value: "Unanswered" as AnswerType,
    synced: "synced" as SyncStatus,
  };
};

// TODO: create a function to validate tasks as they come from the server
export class Task {
  taskId: string;
  taskType: TaskType;
  taskData: TaskData;
  answer: Answer;

  private timeInterval_: { start: number; stop: number } | null = null;
  private tracksLayer_: TracksLayer | null = null;

  private constructor(
    taskId: string,
    taskType: TaskType,
    taskData: TaskData,
    answer: Answer = defaultAnswer(taskId)
  ) {
    this.taskId = taskId;
    this.taskType = taskType;
    this.taskData = taskData;
    this.answer = answer;
  }

  static fromJSON(json: unknown): Task {
    if (typeof json !== "object" || json === null) {
      throw new Error("Invalid input: expected a JSON object");
    }

    const {
      task_id: taskId,
      task_type: taskType,
      task_data,
    } = json as Record<string, unknown>;

    if (typeof taskId !== "string") {
      throw new Error("Invalid taskId, expected a string (uuid)");
    }

    if (!isValidTaskType(taskType)) {
      throw new Error(
        `Invalid task_type "{taskType}", expected one of ${TASK_TYPES}`
      );
    }

    const taskData = taskDataFromJSON(task_data);

    return new Task(taskId, taskType, taskData);
  }

  public clone(): Task {
    return new Task(
      this.taskId,
      this.taskType,
      {
        nodeId: this.taskData.nodeId,
        tracksData: this.taskData.tracksData.map((track) => ({
          trackId: track.trackId,
          time: [...track.time],
          position: track.position.map((pos) => [
            ...pos,
          ]) as typeof track.position,
        })),
        imageData: this.taskData.imageData,
      },
      { ...this.answer }
    );
  }

  public get question(): string {
    switch (this.taskType) {
      case "appearance":
        return "Is this a cell appearance event?";
      case "disappearance":
        return "Is this a cell disappearance event?";
      case "division":
        return "Is this a cell division event?";
      default: {
        const exhaustiveCheck: never = this.taskType;
        throw new Error(`Unhandled task type: ${exhaustiveCheck}`);
      }
    }
  }

  private get timeInterval(): { start: number; stop: number } {
    if (!this.timeInterval_) {
      const tracksData = this.taskData.tracksData;
      const time = tracksData.flatMap((track) => track.time);
      // add 1 to the max time because we expect the interval to be open
      this.timeInterval_ = {
        start: Math.min(...time),
        stop: Math.max(...time) + 1,
      };
    }
    return this.timeInterval_;
  }

  public get maxTime(): number {
    return this.timeInterval.stop;
  }

  public get minTime(): number {
    return this.timeInterval.start;
  }

  imageSeriesLayer(preLoad = true): ImageSeriesLayer {
    const imageData = this.taskData.imageData;
    const region: Region = [
      { dimension: imageData.timeDimension, index: this.timeInterval },
    ];
    for (const [d, i] of imageData.sliceIndices.entries()) {
      region.push({ dimension: d, index: i });
    }
    const source = new OmeZarrImageSource(imageData.url);
    const layer = new ImageSeriesLayer({
      source,
      region,
      timeDimension: imageData.timeDimension,
      channelProps: [
        { color: [1, 0, 0] as [number, number, number] },
        { color: [0, 1, 0] as [number, number, number] },
        { color: [0, 0, 1] as [number, number, number] },
      ],
    });
    if (preLoad) {
      layer.update();
    }
    return layer;
  }

  tracksLayer(): TracksLayer {
    if (this.tracksLayer_ === null) {
      const tracksData = this.taskData.tracksData;
      const tracks = tracksData.map((track, i) => {
        return {
          path: track.position.map((pos) => {
            const z = pos.length === 3 ? pos[2] : 0;
            return vec3.fromValues(pos[0], pos[1], z);
          }),
          time: track.time,
          color: COLOR_CYCLE[i % COLOR_CYCLE.length],
          width: 0.01,
          interpolation: { pointsPerSegment: 10, tangentFactor: 0.3 },
        };
      });
      this.tracksLayer_ = new TracksLayer(tracks);
    }
    return this.tracksLayer_;
  }

  public layers(): {
    imageSeriesLayer: ImageSeriesLayer;
    tracksLayer: TracksLayer;
  } {
    const layers = {
      imageSeriesLayer: this.imageSeriesLayer(),
      tracksLayer: this.tracksLayer(),
    };
    return layers;
  }
}

// https://colorbrewer2.org/?type=qualitative&scheme=Set1&n=6
// prettier-ignore
const COLOR_CYCLE: vec3[] = [
  [0.894, 0.102, 0.11],
  [0.216, 0.494, 0.722],
  [0.302, 0.686, 0.29],
  [0.596, 0.306, 0.639],
  [1.0, 0.498, 0.0],
  [1.0, 1.0, 0.2],
];
