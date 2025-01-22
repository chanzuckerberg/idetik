from collections import Counter
from contextlib import asynccontextmanager
from random import choices, getrandbits, sample, seed
from uuid import UUID

import pandas as pd
from fastapi import FastAPI, APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import aliased, Session

from ultrack_learns.models import ImageData, Task, TaskData, TaskType
from ultrack_learns.db import (
    Image,
    get_session,
    session_context,
    set_up_db,
    track_points_around_node,
    TrackPoint,
    Task as TaskRecord,
)

SAMPLE_DATA_URL = "https://public.czbiohub.org/royerlab/ultrack/multi-color"
SAMPLE_TRACKS_URL = f"{SAMPLE_DATA_URL}/tracks.csv"
seed(54)
SAMPLE_IMAGE = Image(
    image_id=UUID(int=getrandbits(128), version=4),
    url=f"{SAMPLE_DATA_URL}/normalized.zarr/",
    time_dimension="T",
    slice_indices={"Z": 0},
)


@asynccontextmanager
async def mock_lifespan(app: FastAPI):
    print("Starting lifespan")
    set_up_db()
    with session_context() as db:
        seed_mock_data(db)
    yield
    # TODO: clean up mock data if needed


def seed_mock_data(db: Session):
    print("Seeding mock data")
    if count := db.query(TrackPoint).count():
        print(f"Data already seeded ({count} items)- delete DB and restart to re-seed")
        print(f"DB file: '{db.bind.url.database}'")
        return

    print(f"Inserting sample image data into the database")
    db.add(SAMPLE_IMAGE)

    print(f"Downloading sample tracks data from {SAMPLE_TRACKS_URL}")
    df = pd.read_csv(SAMPLE_TRACKS_URL)

    print("Inserting track data into the database")
    for row in df.itertuples():
        parent_id = row.parent_id if row.parent_id != -1 else None
        parent_track_id = row.parent_track_id if row.parent_track_id != -1 else None
        z = row.z if "z" in df.columns else None
        db.add(
            TrackPoint(
                id=row.id,
                parent_id=parent_id,
                track_id=row.track_id,
                parent_track_id=parent_track_id,
                t=row.t,
                z=z,
                y=row.y,
                x=row.x,
            )
        )
    db.commit()
    print(f"Inserted {db.query(TrackPoint).count()} rows")


def _get_appearances(db: Session, n_samples: int):
    query = select(TrackPoint).where(TrackPoint.parent_track_id.is_(None))
    possible_appearances = db.execute(query).scalars().all()

    if len(possible_appearances) < n_samples:
        return possible_appearances
    else:
        return sample(possible_appearances, n_samples)


def _get_disappearances(db: Session, n_samples: int):
    parent_ids_subquery = (
        select(TrackPoint.parent_track_id)
        .where(~TrackPoint.parent_track_id.is_(None))
        .distinct()
    )
    query = select(TrackPoint).where(~TrackPoint.track_id.in_(parent_ids_subquery))
    possible_disappearances = db.execute(query).scalars().all()

    if len(possible_disappearances) < n_samples:
        return possible_disappearances
    else:
        return sample(possible_disappearances, n_samples)


def _get_divisions(db: Session, n_samples: int):
    parent_ids_subquery = (
        select(TrackPoint.parent_track_id)
        .where(~TrackPoint.parent_track_id.is_(None))
        .distinct()
    )

    max_t_subquery = (
        select(TrackPoint.track_id, func.max(TrackPoint.t).label("max_t"))
        .group_by(TrackPoint.track_id)
        .subquery()
    )

    TrackPointAlias = aliased(TrackPoint)

    query = (
        select(TrackPointAlias)
        .join(
            max_t_subquery,
            (TrackPointAlias.track_id == max_t_subquery.c.track_id)
            & (TrackPointAlias.t == max_t_subquery.c.max_t),
        )
        .where(TrackPointAlias.track_id.in_(parent_ids_subquery))
    )
    divisions = db.execute(query).scalars().all()

    if len(divisions) < n_samples:
        return divisions
    else:
        return sample(divisions, n_samples)


sampling_functions = {
    TaskType.APPEARANCE: _get_appearances,
    TaskType.DISAPPEARANCE: _get_disappearances,
    TaskType.DIVISION: _get_divisions,
}

# TODO: mock routes should be the same as the real routes
mock_router = APIRouter(prefix="/mock_data")


# TODO: use a more sophisticated cache
CACHE = {}


@mock_router.get("/task")
def all_tasks(
    rng_seed: int = 42,
    num_tasks: int = 10,
    time_window: int = 16,
    db: Session = Depends(get_session),
) -> list[Task]:
    key = (rng_seed, num_tasks, time_window)
    if key in CACHE:
        return CACHE[key]
    seed(rng_seed)
    tasks = []
    task_types = Counter(choices(list(TaskType), k=num_tasks))
    # There is only one image, but exercise the database by fetching it
    # by its ID as a crude test to check it has actually been stored.
    image = db.get(Image, SAMPLE_IMAGE.image_id)
    image_data=ImageData(
        image_id=image.image_id,
        url=image.url,
        time_dimension=image.time_dimension,
        slice_indices=image.slice_indices,
    )
    # TODO: the client does not yet support different task types
    task_types = {TaskType.DIVISION: num_tasks}
    for task_type, count in task_types.items():
        task_roots = sampling_functions[task_type](db, count)
        task_data = [
            TaskData(
                node_id=root_node.id,
                tracks_data=track_points_around_node(
                    db,
                    root_node.id,
                    time_window=time_window,
                    include_children=task_type == TaskType.DIVISION,
                ),
                image_data=image_data,
            )
            for root_node in task_roots
        ]
        tasks.extend(
            [
                Task(
                    task_id=UUID(int=getrandbits(128), version=4),
                    task_type=task_type,
                    task_data=data,
                )
                for data in task_data
            ]
        )

    for task in tasks:
        db.add(
            TaskRecord(
                task_id=task.task_id,
                task_type=task.task_type,
                node_id=task.task_data.node_id,
            )
        )
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        print("Error committing tasks to the database")
        print(e)

    CACHE[key] = tasks
    return tasks


@mock_router.get("/task/{task_id}")
def task(
    task_id: UUID,
    rng_seed: int = 42,
    num_tasks: int = 10,
    db: Session = Depends(get_session),
) -> Task | None:
    tasks = all_tasks(rng_seed, num_tasks, db)
    return next((t for t in tasks if t.task_id == task_id), None)


def write_mock_data_json():
    import argparse
    from pydantic.json import pydantic_encoder
    import json

    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--num_tasks", type=int, default=10)
    args = parser.parse_args()

    set_up_db()
    with session_context() as db:
        seed_mock_data(db)
        print("Generating mock data")
        tasks = all_tasks(db=db, rng_seed=args.seed, num_tasks=args.num_tasks)
    print("Writing mock data to mock_data.json")
    with open("mock_data.json", "w") as f:
        pretty_json = json.dumps(tasks, indent=4, default=pydantic_encoder)
        f.write(pretty_json)
