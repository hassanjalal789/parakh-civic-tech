"""Speech-to-text and translation adapters (DG-16: no provider selected; DG-48).

Every report text has three parts the reporter confirms together (DG-62;
Mobile SRS v2.3.0 FR-PUB.16): the transcription (the reporter's own words),
the Urdu text and the English text. An adapter returns all three, and says
per text whether it was transcribed, translated or otherwise rendered.

The only adapter is **SIMULATED**. It does not listen to the recording and
does not translate. Its texts say they are simulated, it refuses to load
outside development and test, and every artefact it touches is marked
`simulated = True`, so no screen or test can mistake its output for real
transcription or translation.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.utils.module_loading import import_string

# Origins an adapter may report. "reporter" is decided by the server, never by an adapter.
AI_TRANSCRIPTION = "ai_transcription"
AI_TRANSLATION = "ai_translation"
AI_RENDERING = "ai_rendering"


@dataclass(frozen=True)
class RenderingResult:
    source_asr_text: str  # raw intermediate output; never returned to a citizen
    transcription: str
    source_language: str  # "ur", "en" or "und"
    urdu_civic_rendering: str
    english_rendering: str
    origins: dict[str, str]  # "transcription" | "ur" | "en" -> an AI origin
    model_name: str
    model_version: str
    detected_languages: list[str] = field(default_factory=list)
    critical_fields: dict[str, str] = field(default_factory=dict)
    field_confidence: dict[str, float] = field(default_factory=dict)
    overall_confidence: float | None = None
    simulated: bool = False
    needs_human_review: bool = False


@dataclass(frozen=True)
class TranslationResult:
    text: str
    model_name: str
    model_version: str
    simulated: bool = False


class ProcessingFailure(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


# Category names for the simulated text only. The client has its own labels.
_CATEGORY = {
    "water": ("پانی", "Water"),
    "road": ("سڑک", "Road"),
    "drainage": ("نکاسیِ آب", "Drainage"),
    "streetlight": ("اسٹریٹ لائٹ", "Street light"),
    "waste": ("کچرا", "Waste"),
    "other": ("دیگر", "Other"),
}
_URDU_SCRIPT = re.compile(r"[؀-ۿݐ-ݿ]")
_LATIN = re.compile(r"[A-Za-z]")

SIMULATED_UR = "[SIMULATED · نقلی ترجمہ] "
SIMULATED_EN = "[SIMULATED translation — not a real translation] "


def script_language(text: str) -> str:
    """The SIMULATED adapter's guess from the script alone. It cannot tell Roman Urdu from English."""
    if _URDU_SCRIPT.search(text):
        return "ur"
    if _LATIN.search(text):
        return "en"
    return "und"


class SimulatedRenderingAdapter:
    """Development and test only. Produces labelled placeholder output, never a transcript or a translation."""

    MODEL_NAME = "parakh-simulated-dev"
    MODEL_VERSION = "0"

    def __init__(self):
        if settings.PARAKH_ENV not in {"development", "test"}:
            raise ImproperlyConfigured("The simulated AI adapter is for development and test only")

    @staticmethod
    def _check(outcome: str) -> None:
        if outcome == "fail":
            raise ProcessingFailure("SIMULATED_FAILURE")

    def render_text(self, text: str, hints: dict) -> RenderingResult:
        """A typed text (DG-53, DG-61). The text in the typed language is the reporter's own; the other is simulated."""
        outcome = settings.PARAKH_SIMULATED_AI_OUTCOME
        self._check(outcome)
        typed = text  # the reporter's own words, exactly as written (FR-PUB.12; DG-76)
        if not typed.strip():
            raise ProcessingFailure("EMPTY_TEXT")
        category_ur, category_en = _CATEGORY.get(hints.get("category", ""), _CATEGORY["other"])
        language = script_language(typed)
        if language == "ur":
            urdu, english = typed, SIMULATED_EN + typed[:500]
            origins = {"ur": AI_RENDERING, "en": AI_TRANSLATION}  # the server marks the verbatim one as the reporter's
        elif language == "en":
            urdu, english = SIMULATED_UR + typed[:500], typed
            origins = {"ur": AI_TRANSLATION, "en": AI_RENDERING}
        else:
            urdu, english = SIMULATED_UR + typed[:500], SIMULATED_EN + typed[:500]
            origins = {"ur": AI_RENDERING, "en": AI_RENDERING}
        return RenderingResult(
            source_asr_text="",  # typed input has no speech recognition step
            transcription=typed,
            source_language=language,
            urdu_civic_rendering=urdu,
            english_rendering=english,
            origins={"transcription": AI_RENDERING, **origins},
            model_name=self.MODEL_NAME,
            model_version=self.MODEL_VERSION,
            critical_fields={"issue_category": category_ur},
            field_confidence={"issue_category": 0.9},
            overall_confidence=0.9,
            simulated=True,
            needs_human_review=outcome == "review_required",
        )

    def render(self, audio: bytes, mime_type: str, hints: dict) -> RenderingResult:
        outcome = settings.PARAKH_SIMULATED_AI_OUTCOME
        self._check(outcome)
        if not audio:
            raise ProcessingFailure("EMPTY_AUDIO")
        category_ur, category_en = _CATEGORY.get(hints.get("category", ""), _CATEGORY["other"])
        urdu = (
            "[SIMULATED · نقلی متن] "
            f"یہ متن کسی حقیقی آواز سے نہیں بنایا گیا۔ زمرہ: {category_ur}۔ "
            "مقام: محلے کی مرکزی گلی کے قریب۔"
        )
        english = (
            SIMULATED_EN + "This text was not produced from any real voice. "
            f"Category: {category_en}. Location: near the main street of the neighbourhood."
        )
        return RenderingResult(
            source_asr_text="[SIMULATED] no speech recognition was performed",
            transcription=urdu,  # simulated speech "in Urdu": the transcription and the Urdu text coincide
            source_language="ur",
            urdu_civic_rendering=urdu,
            english_rendering=english,
            origins={"transcription": AI_TRANSCRIPTION, "ur": AI_TRANSCRIPTION, "en": AI_TRANSLATION},
            model_name=self.MODEL_NAME,
            model_version=self.MODEL_VERSION,
            detected_languages=[],
            critical_fields={"issue_category": category_ur, "location": "محلے کی مرکزی گلی کے قریب"},
            # The location is deliberately low-confidence so the targeted-question path can be exercised.
            field_confidence={"issue_category": 0.9, "location": 0.4},
            overall_confidence=0.6,
            simulated=True,
            needs_human_review=outcome == "review_required",
        )

    def translate(self, text: str, source_language: str, target_language: str, hints: dict) -> TranslationResult:
        """Re-derives one language from a text the reporter corrected (DG-62). Simulated: a labelled echo."""
        self._check(settings.PARAKH_SIMULATED_AI_OUTCOME)
        if not text.strip():
            raise ProcessingFailure("EMPTY_TEXT")
        if target_language not in {"ur", "en"}:
            raise ProcessingFailure("UNSUPPORTED_LANGUAGE")
        prefix = SIMULATED_UR if target_language == "ur" else SIMULATED_EN
        return TranslationResult(
            text=prefix + text.strip()[:500],
            model_name=self.MODEL_NAME,
            model_version=self.MODEL_VERSION,
            simulated=True,
        )


_DEVELOPMENT_ADAPTERS = {"parakh.drafts.ai.SimulatedRenderingAdapter"}


def check_ai_configuration(env: str, backend: str) -> None:
    if env == "production" and (not backend or backend in _DEVELOPMENT_ADAPTERS):
        raise ImproperlyConfigured("Production needs a real AI provider; none is selected (DG-16)")


def get_adapter():
    return import_string(settings.PARAKH_AI_BACKEND)()
