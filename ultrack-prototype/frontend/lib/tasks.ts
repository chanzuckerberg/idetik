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

// TODO: create a function to validate tasks as they come from the server
// TODO: possibly make this a class instead
export type Task = {
  task_id: string;
  task_type: TaskType;
  task_data: {
    node_id: number;
    tracks_data: Track[];
  };
  answer?: Answer;
  index: number;
  question: string;
};

type Track = {
  track_id: number;
  time: number[];
  position: vec2[] | vec3[];
};

type TaskType = "appearance" | "disappearance" | "division";

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

function taskTracksAs3DPaths(task: Task): vec3[][] {
  const {
    task_data: { tracks_data: tracksData },
  } = task;
  return tracksData.map((track) => {
    // TODO: this 1440 - pos[1] is a hack to flip the y-axis.
    return track.position.map((pos) => {
      const z = pos.length === 3 ? pos[2] : 0;
      return [pos[0], 1440 - pos[1], z];
    });
  });
}

export function taskTimeInterval(task: Task): {
  start: number;
  stop: number;
} {
  if (!task) {
    return { start: 0, stop: 0 };
  }
  const {
    task_data: { tracks_data: tracksData },
  } = task;
  const time = tracksData.flatMap((track) => track.time);
  // add 1 to the max time because we expect the interval to be open
  return { start: Math.min(...time), stop: Math.max(...time) + 1 };
}

export function taskLayers(
  task: Task,
  imageSource: OmeZarrImageSource
): { imageSeriesLayer: ImageSeriesLayer; tracksLayer: ProjectedLineLayer } {
  const timeInterval = taskTimeInterval(task);
  const region = [
    { dimension: "T", index: timeInterval },
    { dimension: "Z", index: 0 },
  ];

  const imageSeriesLayer = new ImageSeriesLayer(imageSource, region, "T");

  const paths = taskTracksAs3DPaths(task);
  const tracksLayer = new ProjectedLineLayer(
    paths.map((path, i) => ({
      path,
      color: COLOR_CYCLE[i % COLOR_CYCLE.length],
      width: 0.01,
    }))
  );

  return {
    imageSeriesLayer,
    tracksLayer,
  };
}

export function tracksLayerCamera(
  tracksLayer: ProjectedLineLayer,
  paddingFactor: number = 0.5
): OrthographicCamera {
  const { xMin, xMax, yMin, yMax } = tracksLayer.extent;
  const padding = paddingFactor * Math.max(xMax - xMin, yMax - yMin);
  return new OrthographicCamera(
    xMin - padding,
    xMax + padding,
    yMin - padding,
    yMax + padding
  );
}
