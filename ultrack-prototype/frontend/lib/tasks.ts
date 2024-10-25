import { vec2, vec3 } from "gl-matrix";

import {
  ImageSeriesLayer,
  OmeZarrImageSource,
  OrthographicCamera,
  ProjectedLineLayer,
} from "@";

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

type TaskData = {
  nodeId: number;
  tracksData: Track[];
};

function taskDataFromJSON(taskDataJSON: unknown): TaskData {
  if (typeof taskDataJSON !== "object" || taskDataJSON === null) {
    throw new Error("Invalid input: expected a JSON object");
  }

  const { node_id, tracks_data } = taskDataJSON as Record<string, unknown>;

  if (typeof node_id !== "number") {
    throw new Error("Invalid nodeId, expected a number");
  }

  if (!Array.isArray(tracks_data)) {
    throw new Error("Invalid tracksData, expected an array");
  }

  const tracksData = tracks_data.map(trackFromJSON);

  return { nodeId: node_id, tracksData };
}

const TASK_TYPES = ["appearance", "disappearance", "division"] as const;
type TaskType = (typeof TASK_TYPES)[number];

function isValidTaskType(taskType: unknown): taskType is TaskType {
  return (
    typeof taskType === "string" && TASK_TYPES.includes(taskType as TaskType)
  );
}

export type Answer = "Unanswered" | "Yes" | "No" | "Uncertain";

// TODO: create a function to validate tasks as they come from the server
export class Task {
  taskId: string;
  taskType: TaskType;
  taskData: TaskData;
  answer: Answer = "Unanswered";

  private timeInterval_: { start: number; stop: number } | null = null;
  private tracksLayer_: ProjectedLineLayer | null = null;

  private constructor(taskId: string, taskType: TaskType, taskData: TaskData) {
    this.taskId = taskId;
    this.taskType = taskType;
    this.taskData = taskData;
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
    return new Task(this.taskId, this.taskType, {
      nodeId: this.taskData.nodeId,
      tracksData: this.taskData.tracksData.map((track) => ({
        trackId: track.trackId,
        time: [...track.time],
        position: track.position.map((pos) => [
          ...pos,
        ]) as typeof track.position,
      })),
    });
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

  private tracksAs3DPaths(): vec3[][] {
    const tracksData = this.taskData.tracksData;
    return tracksData.map((track) => {
      // TODO: this 1440 - pos[1] is a hack to flip the y-axis.
      return track.position.map((pos) => {
        const z = pos.length === 3 ? pos[2] : 0;
        return [pos[0], 1440 - pos[1], z];
      });
    });
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

  imageSeriesLayer(
    source: OmeZarrImageSource,
    preLoad = true
  ): ImageSeriesLayer {
    const region = [
      { dimension: "T", index: this.timeInterval },
      { dimension: "Z", index: 0 },
    ];
    const layer = new ImageSeriesLayer(source, region, "T");
    if (preLoad) {
      layer.update();
    }
    return layer;
  }

  tracksLayer(): ProjectedLineLayer {
    if (this.tracksLayer_ === null) {
      this.tracksLayer_ = new ProjectedLineLayer(
        this.tracksAs3DPaths().map((path, i) => ({
          path,
          color: COLOR_CYCLE[i % COLOR_CYCLE.length],
          width: 0.01,
        }))
      );
    }
    return this.tracksLayer_;
  }

  public layers(imageSource: OmeZarrImageSource): {
    imageSeriesLayer: ImageSeriesLayer;
    tracksLayer: ProjectedLineLayer;
  } {
    const layers = {
      imageSeriesLayer: this.imageSeriesLayer(imageSource),
      tracksLayer: this.tracksLayer(),
    };
    this.tracksLayer_ = layers.tracksLayer;
    return layers;
  }

  public camera(paddingFactor: number = 1.0): OrthographicCamera {
    const { xMin, xMax, yMin, yMax } = this.tracksLayer().extent;
    const padding = paddingFactor * Math.max(xMax - xMin, yMax - yMin);
    return new OrthographicCamera(
      xMin - padding,
      xMax + padding,
      yMin - padding,
      yMax + padding
    );
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
