import os
from contextlib import contextmanager

from ultrack_learns.models import TrackData

from sqlalchemy import create_engine, select, Column, Integer, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

# TODO: this will eventually use postgres
ULTRACK_DB_URL = os.getenv(
    "ULTRACK_DB_URL",
    "sqlite:///ultrack_tmp.db",
)
engine = create_engine(ULTRACK_DB_URL, echo=False)
Base = declarative_base()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


session_context = contextmanager(get_session)


class TrackPoint(Base):
    __tablename__ = "track_points"

    id = Column(Integer, primary_key=True, index=True)
    parent_id = Column(Integer, nullable=True)
    track_id = Column(Integer)
    parent_track_id = Column(Integer, nullable=True)
    t = Column(Integer)
    z = Column(Float, nullable=True)
    y = Column(Float)
    x = Column(Float)


def track_points_around_node(
    db: Session,
    node_id: int,
    time_window: int | None = None,
    *,
    include_children: bool = False,
) -> list[TrackData]:
    get_node = select(TrackPoint).where(TrackPoint.id == node_id).limit(1)
    node_record = db.execute(get_node).scalar()
    if node_record is None:
        raise ValueError(f"Node with id {node_id} not found")

    track_ids = [node_record.track_id]
    if include_children:
        get_children = select(TrackPoint.track_id).where(
            TrackPoint.parent_track_id == node_record.track_id
        ).distinct()
        children = db.execute(get_children).scalars().all()
        track_ids.extend(children)

    get_all_points = select(TrackPoint).where(TrackPoint.track_id.in_(track_ids))

    if time_window is not None:
        min_time = node_record.t - time_window // 2
        max_time = node_record.t + time_window - time_window // 2
        get_all_points = get_all_points.where(TrackPoint.t.between(min_time, max_time))

    track_points = db.execute(get_all_points).scalars().all()

    track_ids = {tp.track_id for tp in track_points}

    return [
        TrackData(
            track_id=track_id,
            time=[tp.t for tp in track_points if tp.track_id == track_id],
            position=[
                (tp.x, tp.y, tp.z) if tp.z else (tp.x, tp.y)
                for tp in track_points
                if tp.track_id == track_id
            ],
        )
        for track_id in track_ids
    ]


def set_up_db():
    Base.metadata.create_all(bind=engine)
