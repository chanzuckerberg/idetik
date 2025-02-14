import pandas as pd
import json
import numpy as np
from pydantic import BaseModel


RNG = np.random.default_rng(42)


class TrackData(BaseModel):
    track_id: int
    t: list[int]
    z: list[float]
    y: list[float]
    x: list[float]


class CellEventTaskData(BaseModel):
    node_id: int
    tracks_data: list[TrackData]


class AnnotationTask(BaseModel):
    task_id: int
    task_type: str
    task_data: CellEventTaskData


def _query_tracks(
    df: pd.DataFrame,
    node_id: int,
    time_window: int,
    include_children: bool,
) -> list[TrackData]:
    """
    Query the tracks data for a given node_id and time window.
    If provided, include the children of the node_id if within the time window.

    Parameters
    ----------
    df : pd.DataFrame
        The dataframe containing the tracks data.
    node_id : int
        The node_id to query the tracks data.
    time_window : int
        The time window to query the tracks data.
    include_children : bool
        Whether to include the children of the node_id in the query.

    Returns
    -------
    list[TrackData]
        A list of TrackData objects containing the tracks data.
    """

    current_node = df[df["id"] == node_id].iloc[0]

    track_ids = [current_node["track_id"]]

    if include_children:
        track_ids.extend(df[df["parent_id"] == node_id]["track_id"].unique().tolist())

    before_time = current_node["t"] - time_window // 2
    after_time = current_node["t"] + time_window - time_window // 2

    tracks_data = []
    for track_id in track_ids:
        track_df = df[df["track_id"] == track_id]

        if track_df.empty:
            raise ValueError(f"Track {track_id} not found in the dataframe")

        track_df_window = track_df[track_df["t"].between(before_time, after_time)]

        if track_df_window.empty:
            print(track_df)
            raise ValueError(
                f"No data for track {track_id} in the time window at {current_node['t']}"
            )

        track_data = TrackData(
            track_id=track_id,
            t=track_df_window["t"].tolist(),
            z=track_df_window["z"].tolist(),
            y=track_df_window["y"].tolist(),
            x=track_df_window["x"].tolist(),
        )
        tracks_data.append(track_data)

    return tracks_data


def _get_divisions(df: pd.DataFrame, n_samples: int) -> pd.DataFrame:
    df = df[df["track_id"].isin(df["parent_track_id"])]
    div_df = df.groupby("track_id", as_index=False).apply(
        lambda x: x.loc[x["t"].idxmax()]
    )
    return div_df.sample(n=n_samples, random_state=RNG)


def _get_appearances(df: pd.DataFrame, n_samples: int) -> pd.DataFrame:
    df = df[df["parent_id"] < 0]
    return df.sample(n=n_samples, random_state=RNG)


def _get_disappearances(df: pd.DataFrame, n_samples: int) -> pd.DataFrame:
    df = df[~df["id"].isin(df["parent_id"])]
    return df.sample(n=n_samples, random_state=RNG)


def main() -> None:
    df = pd.read_csv(
        "https://public.czbiohub.org/royerlab/ultrack/multi-color/tracks.csv"
    )
    df[["t", "track_id", "id", "parent_id", "parent_track_id"]] = df[
        ["t", "track_id", "id", "parent_id", "parent_track_id"]
    ].astype(int)

    for col in ["z", "y", "x"]:
        if col not in df.columns:
            df[col] = 0.0
        else:
            df[col] = df[col].astype(float)

    mock_data = []
    count = 0

    for task_type, sampling_func in [
        ("division", _get_divisions),
        ("appearance", _get_appearances),
        ("disappearance", _get_disappearances),
    ]:
        for sample in sampling_func(df, n_samples=5).itertuples():
            task_data = CellEventTaskData(
                node_id=sample.id,
                tracks_data=_query_tracks(
                    df,
                    sample.id,
                    time_window=10,
                    include_children=task_type == "division",
                ),
            )
            annotation_task = AnnotationTask(
                task_id=count,
                task_type=task_type,
                task_data=task_data,
            )
            mock_data.append(annotation_task)
            count += 1

    with open("mock_data.json", "w") as f:
        pretty_json = json.dumps([task.dict() for task in mock_data], indent=4)
        f.write(pretty_json)


if __name__ == "__main__":
    main()
