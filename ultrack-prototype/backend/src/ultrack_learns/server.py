from typing import Annotated

from fastapi import FastAPI, APIRouter, Depends, Query
from sqlalchemy import inspect
from sqlalchemy.orm import Session

from ultrack_learns.db import get_session, track_points_around_node

# TODO: control mock mode with env var
from ultrack_learns.mock_data import mock_lifespan as lifespan
from ultrack_learns.mock_data import mock_router

app = FastAPI(lifespan=lifespan)

debug_router = APIRouter(prefix="/debug")


@app.get("/ping")
def read_root():
    return {"Hello": "World"}


@debug_router.get("/tables")
def list_tables(db: Session = Depends(get_session)):
    inspector = inspect(db.bind)
    return {"tables": inspector.get_table_names()}


@app.get("/track")
def get_track_for_node(
    node_id: int,
    time_window: Annotated[int | None, Query(gt=0)] = None,
    include_children: bool = False,
    db: Session = Depends(get_session),
):
    return track_points_around_node(db, node_id, time_window, include_children)


app.include_router(mock_router)
app.include_router(debug_router)
