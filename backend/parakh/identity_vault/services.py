"""The only code that touches phone numbers in clear."""
from __future__ import annotations

import re

from cryptography.fernet import Fernet
from django.conf import settings

from parakh.core.errors import ApiError
from parakh.core.hashing import hmac_hex

from .models import CitizenPhoneCredential

# Pakistani mobile numbers: +92 followed by 3XXXXXXXXX (FR-AUTH.5).
_PK_MOBILE = re.compile(r"^3\d{9}$")


def normalise_pk_mobile(raw: str) -> str:
    """Return the E.164 form (+923XXXXXXXXX) or raise E_INVALID_NUMBER."""
    digits = re.sub(r"[\s\-()]", "", str(raw or ""))
    if digits.startswith("+92"):
        digits = digits[3:]
    elif digits.startswith("0092"):
        digits = digits[4:]
    elif digits.startswith("92") and len(digits) == 12:
        digits = digits[2:]
    elif digits.startswith("0"):
        digits = digits[1:]
    if not _PK_MOBILE.match(digits):
        raise ApiError("E_INVALID_NUMBER", "Please enter a valid Pakistani mobile number.")
    return "+92" + digits


def phone_hmac(e164: str) -> str:
    return hmac_hex(settings.PARAKH_PHONE_HMAC_KEY, "phone:" + e164)


def mask(e164: str) -> str:
    """'+923001234567' -> '+92 300 *** 4567'."""
    national = e164[3:]
    return f"+92 {national[:3]} *** {national[-4:]}"


def _fernet() -> Fernet:
    return Fernet(settings.PARAKH_PHONE_ENC_KEY.encode())


def find_credential(e164: str) -> CitizenPhoneCredential | None:
    return CitizenPhoneCredential.objects.filter(phone_lookup_hmac=phone_hmac(e164)).first()


def create_credential(e164: str, citizen_account_id, verified_at) -> CitizenPhoneCredential:
    return CitizenPhoneCredential.objects.create(
        citizen_account_id=citizen_account_id,
        phone_e164_encrypted=_fernet().encrypt(e164.encode()).decode(),
        phone_lookup_hmac=phone_hmac(e164),
        phone_masked_display=mask(e164),
        verified_at=verified_at,
    )


def masked_number_for(citizen_account_id) -> str | None:
    cred = CitizenPhoneCredential.objects.filter(citizen_account_id=citizen_account_id).first()
    return cred.phone_masked_display if cred else None
