from typing import Annotated

from fastapi import FastAPI, APIRouter, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, select
from sqlalchemy.orm import Session

from ultrack_learns.db import (
    get_session,
    track_points_around_node,
    Answer as AnswerRecord,
)
from ultrack_learns.models import Answer

# TODO: control mock mode with env var
from ultrack_learns.mock_data import mock_lifespan as lifespan
from ultrack_learns.mock_data import mock_router

app = FastAPI(lifespan=lifespan)

# TODO: allow some configuration here
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
)

# TODO: debug routes are for anything *not* used in the prototype
debug_router = APIRouter(prefix="/debug")


@debug_router.get("/ping")
def read_root():
    return {"Hello": "World"}


@debug_router.get("/tables")
def list_tables(db: Session = Depends(get_session)):
    inspector = inspect(db.bind)
    return {"tables": inspector.get_table_names()}


@debug_router.get("/track")
def get_track_for_node(
    node_id: int,
    time_window: Annotated[int | None, Query(gt=0)] = None,
    include_children: bool = False,
    db: Session = Depends(get_session),
):
    return track_points_around_node(db, node_id, time_window, include_children)


@debug_router.get("/task/{task_id}/answer")
def get_task_answers(
    task_id: str,
    db: Session = Depends(get_session),
) -> list[Answer]:
    query = select(AnswerRecord).where(AnswerRecord.task_id == task_id)
    return [Answer(**record.__dict__) for record in db.execute(query).all()]


@app.post("/answer")
def post_one_or_many_answers(
    answers: Answer | list[Answer],
    db: Session = Depends(get_session),
):
    if isinstance(answers, Answer):
        answers = [answers]

    new_records = []
    for answer in answers:
        # upsert answer - answer_id is unique per-session (reload)
        existing = (
            select(AnswerRecord)
            .where(AnswerRecord.answer_id == answer.answer_id)
            .limit(1)
        )
        existing = db.execute(existing).scalar()
        if existing:
            existing.answer = answer.answer
            existing.created_at = answer.created_at
        else:
            new_records.append(AnswerRecord(**answer.__dict__))
    db.add_all(new_records)

    return answers


app.include_router(mock_router)
app.include_router(debug_router)
