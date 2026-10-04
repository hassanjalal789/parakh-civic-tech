"""Speech-to-rendering adapters (DG-16: no provider selected; DG-48).

The only adapter is **SIMULATED**. It does not listen to the recording. It
returns fixed text that says it is simulated, refuses to load outside
development and test, and marks every artefact `simulated = True`, so no
screen or test can mistake its output for real transcription.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.utils.module_loading import import_string


@dataclass(frozen=True)
class RenderingResult:
    source_asr_text: str
    urdu_civic_rendering: str
    model_name: str
    model_version: str
    detected_languages: list[str] = field(default_factory=list)
    critical_fields: dict[str, str] = field(default_factory=dict)
    field_confidence: dict[str, float] = field(default_factory=dict)
    overall_confidence: float | None = None
    simulated: bool = False
    needs_human_review: bool = False


class ProcessingFailure(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


# Urdu category names for the simulated text only. The client has its own labels.
_CATEGORY_UR = {
    "water": "پانی",
    "road": "سڑک",
    "drainage": "نکاسیِ آب",
    "streetlight": "اسٹریٹ لائٹ",
    "waste": "کچرا",
    "other": "دیگر",
}


class SimulatedRenderingAdapter:
    """Development and test only. Produces labelled placeholder output, never a transcript."""

    MODEL_NAME = "parakh-simulated-dev"
    MODEL_VERSION = "0"

    def __init__(self):
        if settings.PARAKH_ENV not in {"development", "test"}:
            raise ImproperlyConfigured("The simulated AI adapter is for development and test only")

    def render(self, audio: bytes, mime_type: str, hints: dict) -> RenderingResult:
        outcome = settings.PARAKH_SIMULATED_AI_OUTCOME
        if outcome == "fail":
            raise ProcessingFailure("SIMULATED_FAILURE")
        if not audio:
            raise ProcessingFailure("EMPTY_AUDIO")
        category = _CATEGORY_UR.get(hints.get("category", ""), "دیگر")
        rendering = (
            "[SIMULATED · نقلی متن] "
            f"یہ متن کسی حقیقی آواز سے نہیں بنایا گیا۔ زمرہ: {category}۔ "
            "مقام: محلے کی مرکزی گلی کے قریب۔"
        )
        return RenderingResult(
            source_asr_text="[SIMULATED] no speech recognition was performed",
            urdu_civic_rendering=rendering,
            model_name=self.MODEL_NAME,
            model_version=self.MODEL_VERSION,
            detected_languages=[],
            critical_fields={"issue_category": category, "location": "محلے کی مرکزی گلی کے قریب"},
            # The location is deliberately low-confidence so the targeted-question path can be exercised.
            field_confidence={"issue_category": 0.9, "location": 0.4},
            overall_confidence=0.6,
            simulated=True,
            needs_human_review=outcome == "review_required",
        )


_DEVELOPMENT_ADAPTERS = {"parakh.drafts.ai.SimulatedRenderingAdapter"}


def check_ai_configuration(env: str, backend: str) -> None:
    if env == "production" and (not backend or backend in _DEVELOPMENT_ADAPTERS):
        raise ImproperlyConfigured("Production needs a real AI provider; none is selected (DG-16)")


def get_adapter():
    return import_string(settings.PARAKH_AI_BACKEND)()
