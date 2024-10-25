import { vec2, vec3 } from "gl-matrix";

import {
  ImageSeriesLayer,
  OmeZarrImageSource,
  OrthographicCamera,
  ProjectedLineLayer,
} from "@";

export enum Answer {
  YES = "Yes",
  NO = "No",
  UNCERTAIN = "Uncertain",
}

type Track = {
  track_id: number;
  time: number[];
  position: vec2[] | vec3[];
};

function isValidTrack(track: unknown): track is Track {
  if (typeof track !== "object" || track === null) {
    return false;
  }

  const { track_id, time, position } = track as Record<string, unknown>;

  if (typeof track_id !== "number") {
    return false;
  }

  if (!Array.isArray(time) || time.some((t) => typeof t !== "number")) {
    return false;
  }

  if (!Array.isArray(position) || position.some((pos) => !Array.isArray(pos))) {
    return false;
  }

  // TODO: validate position and time have the same length

  return true;
}

type TaskData = {
  node_id: number;
  tracks_data: Track[];
};

function isValidTaskData(taskData: unknown): taskData is TaskData {
  if (typeof taskData !== "object" || taskData === null) {
    return false;
  }

  const { node_id, tracks_data } = taskData as Record<string, unknown>;

  if (typeof node_id !== "number") {
    return false;
  }

  if (!Array.isArray(tracks_data) || !tracks_data.every(isValidTrack)) {
    return false;
  }

  return true;
}

const TASK_TYPES = ["appearance", "disappearance", "division"] as const;
type TaskType = typeof TASK_TYPES[number];

function isValidTaskType(taskType: unknown): taskType is TaskType {
  return typeof taskType === "string" && TASK_TYPES.includes(taskType as TaskType);
}


// TODO: create a function to validate tasks as they come from the server
export class Task {
  task_id!: string;
  task_type!: TaskType;
  task_data!: TaskData;
  answer?: Answer;

  timeInterval_: { start: number, stop: number } | null = null;
  tracksLayer_: ProjectedLineLayer | null = null;

  private constructor(
    task_id: string,
    task_type: TaskType,
    task_data: {
      node_id: number;
      tracks_data: Track[];
    }
  ) {
    this.task_id = task_id;
    this.task_type = task_type;
    this.task_data = task_data;
  }

  static fromJSON(json: unknown): Task {
    if (typeof json !== 'object' || json === null) {
      throw new Error('Invalid input: expected a JSON object');
    }

    const { task_id, task_type, task_data } = json as Record<string, unknown>;

    if (typeof task_id !== 'string') {
      throw new Error('Invalid task_id, expected a string (uuid)');
    }

    if (!isValidTaskType(task_type)) {
      throw new Error(`Invalid task_type "{task_type}", expected one of ${TASK_TYPES}`);
    }

    if (!isValidTaskData(task_data)) {
      throw new Error('Invalid task_data');
    }

    return new Task(task_id, task_type as TaskType, task_data as TaskData);
  }

  public get question(): string {
    switch (this.task_type) {
      case "appearance":
        return "Is this a cell appearance event?";
      case "disappearance":
        return "Is this a cell disappearance event?";
      case "division":
        return "Is this a cell division event?";
      default: {
        const exhaustiveCheck: never = this.task_type;
        throw new Error(`Unhandled task type: ${exhaustiveCheck}`);
      }
    }
  }

  tracksAs3DPaths(): vec3[][] {
    const tracksData = this.task_data.tracks_data;
    return tracksData.map((track) => {
      // TODO: this 1440 - pos[1] is a hack to flip the y-axis.
      return track.position.map((pos) => {
        const z = pos.length === 3 ? pos[2] : 0;
        return [pos[0], 1440 - pos[1], z];
      });
    });
  }

  private get timeInterval(): { start: number, stop: number } {
    if (!this.timeInterval_) {
      const tracksData = this.task_data.tracks_data;
      const time = tracksData.flatMap((track) => track.time);
      // add 1 to the max time because we expect the interval to be open
      this.timeInterval_ = { start: Math.min(...time), stop: Math.max(...time) + 1 };
    }
    return this.timeInterval_;
  }

  public get maxTime(): number {
    return this.timeInterval.stop;
  }

  public get minTime(): number {
    return this.timeInterval.start;
  }

  imageSeriesLayer(source: OmeZarrImageSource, preLoad = true): ImageSeriesLayer {
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

  public layers(imageSource: OmeZarrImageSource): { imageSeriesLayer: ImageSeriesLayer; tracksLayer: ProjectedLineLayer } {
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


};

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
