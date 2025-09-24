import { SliceCoordinates } from "@/index";
import { Controller, GUI } from "lil-gui";

type DimensionSliderProps = {
  gui: GUI;
  sliceCoords: SliceCoordinates;
  dimensionName: "z" | "t";
  minValue: number;
  maxValue: number;
  stepValue: number;
  playback?: {
    intervalMs: number;
    stride?: number;
  };
};

export function addDimensionSlider(props: DimensionSliderProps) {
  const controller = props.gui
    .add(
      props.sliceCoords,
      props.dimensionName,
      props.minValue,
      props.maxValue,
      props.stepValue
    )
    .name(`${props.dimensionName}-coord`);

  if (props.playback) {
    const playbackController = new PlaybackController({
      controller,
      intervalMs: props.playback.intervalMs,
      start: props.minValue,
      stop: props.maxValue,
      step: props.stepValue * (props.playback.stride ?? 1),
    });
    props.gui
      .add({ play: false }, "play")
      .name(`Play ${props.dimensionName}`)
      .onChange((play: boolean) => {
        if (play) {
          playbackController.play();
        } else {
          playbackController.pause();
        }
      });
  }
}

type PlaybackControllerProps = {
  controller: Controller;
  intervalMs: number;
  start: number;
  stop: number;
  step: number;
};

class PlaybackController {
  private readonly controller_: Controller;
  private readonly start_: number;
  private readonly stop_: number;
  private readonly step_: number;
  private readonly intervalMs_: number;
  private intervalId_?: number;

  constructor(props: PlaybackControllerProps) {
    this.controller_ = props.controller;
    this.intervalMs_ = props.intervalMs;
    this.start_ = props.start;
    this.stop_ = props.stop;
    this.step_ = props.step;
  }

  public play() {
    if (this.intervalId_ !== undefined) return;
    this.intervalId_ = window.setInterval(() => {
      this.incrementTime();
    }, this.intervalMs_);
  }

  public pause() {
    if (this.intervalId_ === undefined) return;
    window.clearInterval(this.intervalId_);
    this.intervalId_ = undefined;
  }

  private incrementTime = () => {
    const newValue = this.controller_.getValue() + this.step_;
    if (newValue <= this.stop_) {
      this.controller_.setValue(newValue);
    } else {
      this.controller_.setValue(this.start_);
    }
  };
}
