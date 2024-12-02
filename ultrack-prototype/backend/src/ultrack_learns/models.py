from datetime import datetime, timezone
from uuid import UUID

from enum import auto, StrEnum

from pydantic import AwareDatetime, BaseModel, Field


Path2D = list[tuple[float, float]]
Path3D = list[tuple[float, float, float]]


class TaskType(StrEnum):
    APPEARANCE = auto()
    DISAPPEARANCE = auto()
    DIVISION = auto()


class TrackData(BaseModel):
    track_id: int
    time: list[int]
    position: Path2D | Path3D


class ImageData(BaseModel):
    url: str
    time_dimension: str
    slice_indices: dict[str, int]


class TaskData(BaseModel):
    node_id: int
    tracks_data: list[TrackData]
    image_data: ImageData


class Task(BaseModel):
    task_id: UUID
    task_type: TaskType
    task_data: TaskData


class AnswerType(StrEnum):
    YES = auto()
    NO = auto()
    UNCERTAIN = auto()


class Answer(BaseModel):
    answer_id: UUID
    task_id: UUID
    created_at: AwareDatetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        init=False,
    )
    answer: AnswerType
