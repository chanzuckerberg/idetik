from typing import Optional
import pandas as pd
import numpy as np

from numpy.typing import ArrayLike

from ultrack.core.segmentation import get_nodes_features
from ultrack.config import MainConfig


def border_dist(
    tracks_df: pd.DataFrame,
    shape: ArrayLike,
    cutoff: float = 5.0,
    spatial_cols: tuple[str] = ("z", "y", "x"),
    scale: Optional[float] = None,
) -> pd.Series:
    """
    Normalized distance to the border of the image.
    Reference: https://github.com/weigertlab/trackastra/blob/225e46d4969aa98ec67e2849cf27b5b2262ffe27/trackastra/data/wrfeat.py#L56
    It considers the centroid rather than the whole cell as the original version.

    Parameters
    ----------
    tracks_df : pd.DataFrame
        Dataframe with the tracks.
    shape : ArrayLike
        Shape of the image.
    cutoff : float
        Cutoff distance to the border.
    spatial_cols : tuple[str], optional
        Spatial columns, by default ("z", "y", "x").
    scale : Optional[float], optional
        Scale of the coordinates, by default None.

    Returns
    -------
    pd.Series
        Normalized distance from centroids to border.
    """
    if len(shape) != len(spatial_cols):
        raise ValueError(
            f"Spatial columns and shape are different. Found '{len(spatial_cols)}' and '{len(shape)}'"
        )

    coords = tracks_df[list(spatial_cols)]

    if scale is not None:
        coords = coords * scale

    lower_border_dists = coords
    upper_border_dists = np.asarray(shape) - 1 - coords

    min_dist_to_border = np.minimum(lower_border_dists, upper_border_dists)
    norm_dist = 1 - np.clip(
        np.linalg.norm(min_dist_to_border, axis=1) / cutoff, a_min=None, a_max=1
    )

    return norm_dist


def get_ultrack_features(
    config: MainConfig,
) -> pd.DataFrame:
    # TODO docs

    df = get_nodes_features(config, include_persistence=True)
    spatial_shape = config.data_config.metadata["shape"]

    df["border_dist"] = border_dist(
        df,
        spatial_shape,
        spatial_cols=["y", "x"] if len(spatial_shape) == 2 else ["z", "y", "x"],
    )

    if "node_birth" in df.columns:
        min_birth = df["node_birth"].min()
        max_death = df["node_death"].max() - min_birth
        df["node_death"] = (df["node_death"] - min_birth) / max_death
        df["node_birth"] = (df["node_birth"] - min_birth) / max_death

    if "id" not in df:
        df["id"] = df.index

    return df