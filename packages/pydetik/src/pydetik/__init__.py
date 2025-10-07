"""pydetik - Python wrapper for Idetik."""

from importlib.metadata import version

try:
    __version__ = version("pydetik")
except Exception:
    __version__ = "unknown"
