"""Reads what the server needs from an ISO base-media file (MP4, M4A, QuickTime).

Used for the 60-second video limit (DG-54) and to tell audio from video
containers: a recording must hold no video track, a video must hold one.
It parses box headers only — it never decodes media — and gives up on
anything malformed, so a broken or crafted file is refused, not trusted.
"""
from __future__ import annotations

import struct
from dataclasses import dataclass, field

_MAX_BOXES = 10_000  # far more than any real recording holds


@dataclass
class MediaSummary:
    brand: str = ""
    duration_seconds: float | None = None
    track_types: set[str] = field(default_factory=set)


class MalformedMedia(ValueError):
    pass


def _boxes(data: bytes, start: int, end: int):
    """Yield (type, payload_start, payload_end) for the boxes in data[start:end]."""
    offset, count = start, 0
    while offset + 8 <= end:
        count += 1
        if count > _MAX_BOXES:
            raise MalformedMedia("too many boxes")
        size, kind = struct.unpack_from(">I4s", data, offset)
        header = 8
        if size == 1:
            if offset + 16 > end:
                raise MalformedMedia("truncated large box")
            size = struct.unpack_from(">Q", data, offset + 8)[0]
            header = 16
        elif size == 0:
            size = end - offset  # box extends to the end of its container
        if size < header or offset + size > end:
            raise MalformedMedia("box size out of bounds")
        yield kind.decode("latin-1"), offset + header, offset + size
        offset += size


def _child(data: bytes, start: int, end: int, kind: str):
    for k, s, e in _boxes(data, start, end):
        if k == kind:
            return s, e
    return None


def summarise(data: bytes) -> MediaSummary:
    """Parses ftyp, moov/mvhd and every trak's handler type. Raises MalformedMedia, never anything else."""
    try:
        return _summarise(data)
    except (struct.error, IndexError, UnicodeDecodeError) as exc:  # a read past a box: refuse, do not crash
        raise MalformedMedia(f"unreadable header: {type(exc).__name__}") from None


def _summarise(data: bytes) -> MediaSummary:
    summary = MediaSummary()
    moov = None
    for kind, s, e in _boxes(data, 0, len(data)):
        if kind == "ftyp" and e - s >= 4:
            summary.brand = data[s : s + 4].decode("latin-1")
        elif kind == "moov":
            moov = (s, e)
    if not summary.brand or moov is None:
        raise MalformedMedia("not an ISO base-media file")
    for kind, s, e in _boxes(data, *moov):
        if kind == "mvhd":
            if e - s < 1:  # an empty movie header: not even a version byte
                raise MalformedMedia("empty mvhd")
            version = data[s]
            if version == 1 and e - s >= 32:
                timescale, duration = struct.unpack_from(">IQ", data, s + 20)
            elif version == 0 and e - s >= 20:
                timescale, duration = struct.unpack_from(">II", data, s + 12)
            else:
                raise MalformedMedia("bad mvhd")
            if timescale == 0:
                raise MalformedMedia("zero timescale")
            summary.duration_seconds = duration / timescale
        elif kind == "trak":
            mdia = _child(data, s, e, "mdia")
            hdlr = _child(data, *mdia, "hdlr") if mdia else None
            if hdlr and hdlr[1] - hdlr[0] >= 12:
                summary.track_types.add(data[hdlr[0] + 8 : hdlr[0] + 12].decode("latin-1"))
    if summary.duration_seconds is None:
        raise MalformedMedia("no movie header")
    return summary
