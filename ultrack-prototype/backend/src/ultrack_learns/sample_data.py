import logging
from contextlib import asynccontextmanager
from random import choices, getrandbits, sample, seed
from uuid import UUID

import pandas as pd
from fastapi import FastAPI, APIRouter, Depends
from sqlalchemy import func, select, create_engine
from sqlalchemy.orm import aliased, Session, load_only
from xgboost import XGBClassifier
from rich.logging import RichHandler

from sklearn.mixture import GaussianMixture

from ultrack import load_config
from ultrack.core.database import NodeDB, NO_PARENT

from ultrack_learns.features import get_ultrack_features
from ultrack_learns.models import ImageData, Task, TaskData, TaskType
from ultrack_learns.db import (
    Image,
    get_session,
    session_context,
    set_up_db,
    TrackData,
    Task as TaskRecord,
)

LOG = logging.getLogger(__name__)
LOG.addHandler(RichHandler())
LOG.setLevel(logging.INFO)


SAMPLE_DATA_URL = "https://public.czbiohub.org/royerlab/ultrack/multi-color"
SAMPLE_TRACKS_URL = f"{SAMPLE_DATA_URL}/tracks.csv"
seed(54)
SAMPLE_IMAGE = dict(
    image_id=UUID(int=getrandbits(128), version=4),
    url=f"{SAMPLE_DATA_URL}/normalized.zarr/",
    time_dimension="T",
    slice_indices={"Z": 0},
)

class ActiveLearner:
    def __init__(self, n_workers: int) -> None:
        self.samples = None
        self.labeled_indices = []
        self.unlabeled_indices = []
        self.model = XGBClassifier()
        self.n_workers = n_workers
    
    def append(self, samples: pd.DataFrame) -> None:
        if self.samples is None:
            self.samples = samples
        else:
            self.samples = pd.concat([self.samples, samples])
            self.unlabeled_indices += samples.index.tolist()
        
    def query(self, n: int) -> pd.DataFrame:

        LOG.info("Querying %d samples", n)

        if len(self.unlabeled_indices) == 0:

            return self.samples.sample(n, replace=True)

            gmm = GaussianMixture(n_components=n, verbose=1)
            LOG.info("Fitting GMM")
            gmm.fit(self.samples)
            LOG.info("Predicting probabilities")
            probs = gmm.predict_proba(self.samples)
            centroids = probs.argmax(axis=0)
            LOG.info("Centroids: %s", centroids)
            LOG.info("Shape of centroids: %s", centroids.shape)
            return self.samples.iloc[centroids]
        
        else:
            raise NotImplementedError


# TODO: will be an input
ULTRACK_CONFIG = load_config("config.toml")

AL_MODELS = {
   TaskType.DIVISION: ActiveLearner(n_workers=7),
}


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

    # if count := db.query(TaskRecord).count():
    #     print(f"Tracks records already seeded ({count} items)- delete DB and restart to re-seed")
    #     print(f"DB file: '{db.bind.url.database}'")
    #     return

    LOG.info("Inserting sample image data into the database")
    db.add(Image(**SAMPLE_IMAGE))
    db.commit()

    LOG.info(ULTRACK_CONFIG)

    LOG.info("Loading features from ULTRACK_CONFIG")

    df = get_ultrack_features(ULTRACK_CONFIG)
    for model in AL_MODELS.values():
        model.append(df)

    print("Done!")


def track_points_around_node(
    db: Session,
    node_id: int,
    time_window: int,
    *,
    include_children: bool = False,
) -> list[TrackData]:
    """
    Query tracklets (track_points) around a given node (point at specific time).

    Parameters
    ----------
    db : Session
        Ultrack's database session
    node_id : int
        Node ID
    time_window : int
        Time window around the node (left + right sides)
    include_children : bool, optional
        To include decendents tracklets of node or not.

    Returns
    -------
    list[TrackData]
        List of tracklets around a given node.
    """

    time = db.execute(
        select(NodeDB.t).where(NodeDB.id == node_id).limit(1)
    ).scalar()

    min_time = time - time_window // 2
    max_time = time + time_window - time_window // 2

    load_opts = load_only(NodeDB.id, NodeDB.t, NodeDB.z, NodeDB.y, NodeDB.x, NodeDB.parent_id)
 
    main_track = TrackData(
        track_id=1,
        time=[],
        position=[],
    )

    # transversing backwards
    current_id = node_id
    while current_id != NO_PARENT:
        node_query = (
             select(NodeDB)
            .options(load_opts)
            .where(NodeDB.id == current_id)
            .limit(1)
        )
        current_node: NodeDB = db.execute(node_query).scalar()

        if current_node.t < min_time:
            break

        main_track.time.append(current_node.t)
        main_track.position.append(
            # (current_node.z, current_node.y, current_node.x)
            (current_node.y, current_node.x)
        )
        current_id = current_node.parent_id
    
    tracks = [main_track]

   # transversing forward
    node_query = select(NodeDB).options(load_opts).where(NodeDB.parent_id == node_id) # this might be very slow, `parent_id` is not indexed
    tracklet_node_queue = [
        n for n, in db.execute(node_query).all()
    ]
    continue_tracklet = len(tracklet_node_queue) == 1

    while tracklet_node_queue:

        current_node = tracklet_node_queue.pop(0)

        if not continue_tracklet:
            # this will be most often the case
            current_track = TrackData(
                track_id=len(tracks) + 1,
                time=[],
                position=[],
            )
            tracks.append(current_track)
        else:
            current_track = main_track
            continue_tracklet = False

        # iterate through tracklet
        while current_node.t <= max_time:
            current_track.time.append(current_node.t)
            current_track.position.append(
                # (current_node.z, current_node.y, current_node.x)
                (current_node.y, current_node.x)
            )

            node_query = select(NodeDB).options(load_opts).where(NodeDB.parent_id == current_node.id)

            children = [
                n for n, in db.execute(node_query).all()
            ]  # this might be very slow, `parent_id` is not indexed

            if len(children) == 1:
                # continue to next node
                current_node = children[0]
            else:
                # len(children) > 1 or len(children) == 0
                if include_children:
                    tracklet_node_queue.extend(children)
                break
    
    for track in tracks:
        if len(track.time) == 1:
            # HACK: avoiding single point tracklets
            #       because interface does not support them
            track.time.append(track.time[0])
            track.position.append(track.position[0])

        LOG.info("%s", str(track))

    return tracks

# TODO: mock routes should be the same as the real routes
mock_router = APIRouter(prefix="/mock_data")

# TODO: use a more sophisticated cache
CACHE = {}


@mock_router.get("/task")
def all_tasks(
    rng_seed: int = 42,
    num_tasks: int = 10,
    time_window: int = 16,
    task_type: str = "division",
    db: Session = Depends(get_session),
) -> list[Task]:

    task_type = TaskType(task_type)

    key = (rng_seed, num_tasks, time_window, task_type)
    if key in CACHE:
        return CACHE[key]
    seed(rng_seed)

    tasks = []
    al_query = AL_MODELS[task_type].query(num_tasks)

    engine = create_engine(ULTRACK_CONFIG.data_config.database_path)

    image = db.get(Image, SAMPLE_IMAGE["image_id"])
    image_data = ImageData(
        image_id=image.image_id,
        url=image.url,
        time_dimension=image.time_dimension,
        slice_indices=image.slice_indices,
    )

    with Session(engine) as ultrack_db:

        for idx in al_query.index:
            task_data = TaskData(
                node_id=idx,
                tracks_data=track_points_around_node(
                    ultrack_db,
                    node_id=idx,
                    time_window=time_window,
                    include_children=task_type == task_type.DIVISION,
                ),
                image_data=image_data,
            )
            tasks.append(
                Task(
                    task_id=UUID(int=getrandbits(128), version=4),
                    task_type=task_type,
                    task_data=task_data,
                )
            )
    

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
