from enum import auto, StrEnum

from pydantic import BaseModel


Path2D = list[tuple[float, float]]
Path3D = list[tuple[float, float, float]]


class TaskType(StrEnum):
    APPEARANCE = auto()
    DEATH = auto()
    DISAPPEARANCE = auto()
    DIVISION = auto()


class TrackData(BaseModel):
    track_id: int
    time: list[int]
    position: Path2D | Path3D


class TaskData(BaseModel):
    node_id: int
    tracks_data: list[TrackData]


class Task(BaseModel):
    task_id: int
    task_type: TaskType
    task_data: TaskData
