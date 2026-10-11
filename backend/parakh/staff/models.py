"""Staff identity and authority (Data Model §2.3, §3, §5.10; RBAC §6–§8, §10, §14).

- A staff account is invited, never self-created. Its password and official number arrive
  with staff sign-in (StaffCredential); nothing here authenticates anyone.
- Authority comes only from an ACTIVE, unexpired RoleAssignment, evaluated at the point of
  action, one acting assignment at a time, never unioned across assignments.
- Conflict exclusion is keyed on the account, never on an assignment, and kept permanently.
- Role assignments and conflict exclusions are never deleted.
"""
import uuid

from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q


class GeographicScope(models.Model):
    """city ⊃ district ⊃ tehsil ⊃ union_council ⊃ ward (RBAC §6). Boundaries arrive with PostGIS."""

    class Type(models.TextChoices):
        CITY = "city"
        DISTRICT = "district"
        TEHSIL = "tehsil"
        UNION_COUNCIL = "union_council"
        WARD = "ward"

    LEVEL = {"city": 0, "district": 1, "tehsil": 2, "union_council": 3, "ward": 4}

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    type = models.CharField(max_length=16, choices=Type.choices)
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.PROTECT, related_name="children")
    name = models.CharField(max_length=200)

    def clean(self):
        if self.parent_id is None:
            if self.type != self.Type.CITY:
                raise ValidationError("Only a city has no parent scope")
        elif self.LEVEL[self.type] <= self.LEVEL[self.parent.type]:
            raise ValidationError("A scope must be narrower than its parent")

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise RuntimeError("Scopes are reference data; they are never deleted")


def scope_contains(outer_id, inner_id) -> bool:
    """True when `inner_id` is `outer_id` or lies inside it. Unknown or missing scopes contain nothing."""
    if outer_id is None or inner_id is None:
        return False
    current = GeographicScope.objects.filter(id=inner_id).values("id", "parent_id").first()
    for _ in range(len(GeographicScope.LEVEL)):
        if current is None:
            return False
        if current["id"] == outer_id:
            return True
        if current["parent_id"] is None:
            return False
        current = GeographicScope.objects.filter(id=current["parent_id"]).values("id", "parent_id").first()
    return False


class ContractorOrganization(models.Model):
    """Data Model §3.4. A UC Officer can never create one; suspension cascades to its accounts."""

    class Status(models.TextChoices):
        PENDING_APPROVAL = "PENDING_APPROVAL"
        APPROVED = "APPROVED"
        SUSPENDED = "SUSPENDED"
        EXPIRED = "EXPIRED"
        REVOKED = "REVOKED"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    legal_name = models.CharField(max_length=300)
    approval_reference = models.CharField(max_length=120, blank=True, default="")
    approved_by = models.UUIDField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING_APPROVAL)
    valid_from = models.DateTimeField(null=True, blank=True)
    valid_until = models.DateTimeField(null=True, blank=True)
    approved_categories = models.JSONField(default=list)
    service_areas = models.ManyToManyField(GeographicScope, blank=True, related_name="+")

    def approved_at_time(self, now) -> bool:
        """APPROVED and within its validity (RBAC §10), evaluated at the point of action."""
        return (
            self.status == self.Status.APPROVED
            and self.valid_from is not None
            and self.valid_until is not None
            and self.valid_from <= now < self.valid_until
        )


class StaffAccount(models.Model):
    """Data Model §2.3: the unit of identity and of conflict exclusion. No public signup exists."""

    class Status(models.TextChoices):
        INVITED = "INVITED"
        PENDING_ACTIVATION = "PENDING_ACTIVATION"
        ACTIVE = "ACTIVE"
        SUSPENDED = "SUSPENDED"
        REVOKED = "REVOKED"
        EXPIRED = "EXPIRED"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    staff_reference = models.CharField(max_length=64, null=True, blank=True, unique=True)  # never a login identifier
    display_name = models.CharField(max_length=200)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.INVITED)
    organization = models.ForeignKey(
        ContractorOrganization, null=True, blank=True, on_delete=models.PROTECT, related_name="accounts"
    )
    invited_by = models.UUIDField(null=True, blank=True)
    invited_at = models.DateTimeField()
    activated_at = models.DateTimeField(null=True, blank=True)
    suspended_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    reason = models.TextField(blank=True, default="")

    def active_at(self, now) -> bool:
        return self.status == self.Status.ACTIVE and (self.expires_at is None or now < self.expires_at)


class RoleAssignment(models.Model):
    """Data Model §3.2. `valid_until` is mandatory; validity is evaluated at the point of action."""

    class Role(models.TextChoices):
        REP = "REP"  # Street Representative
        UCO = "UCO"  # UC Officer
        CON = "CON"  # Contractor
        MAY = "MAY"  # Mayor & Operations

    class Status(models.TextChoices):
        PENDING = "PENDING"
        ACTIVE = "ACTIVE"
        SUSPENDED = "SUSPENDED"
        EXPIRED = "EXPIRED"
        REVOKED = "REVOKED"

    # Capabilities a role holds only when explicitly granted (RBAC §2).
    EXPLICIT = {
        "CAP_REPORT_OFFICIAL": {"REP", "UCO", "CON", "MAY"},
        "CAP_ACCOUNT_ADMIN": {"MAY"},
        "CAP_ROLE_ASSIGN": {"MAY"},  # only together with CAP_ACCOUNT_ADMIN
    }

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    staff_account = models.ForeignKey(StaffAccount, on_delete=models.PROTECT, related_name="role_assignments")
    role = models.CharField(max_length=3, choices=Role.choices)
    scope = models.ForeignKey(GeographicScope, on_delete=models.PROTECT, related_name="+")
    organization = models.ForeignKey(
        ContractorOrganization, null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    valid_from = models.DateTimeField()
    valid_until = models.DateTimeField()
    granted_capabilities = models.JSONField(default=list)
    assigned_by = models.UUIDField(null=True, blank=True)
    assigned_at = models.DateTimeField()
    revoked_by = models.UUIDField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    reason = models.TextField(blank=True, default="")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["staff_account", "role", "scope"], condition=Q(status="ACTIVE"), name="one_active_assignment"
            ),
            # A contractor acts for exactly one organisation; no other role acts for one.
            models.CheckConstraint(
                condition=(Q(role="CON") & Q(organization__isnull=False)) | (~Q(role="CON") & Q(organization__isnull=True)),
                name="contractor_assignment_names_its_organisation",
            ),
            models.CheckConstraint(condition=Q(valid_until__gt=models.F("valid_from")), name="valid_until_after_from"),
        ]
        indexes = [models.Index(fields=["staff_account", "status"]), models.Index(fields=["role", "scope", "status"])]

    def clean(self):
        granted = list(self.granted_capabilities or [])
        for capability in granted:
            if self.role not in self.EXPLICIT.get(capability, set()):
                raise ValidationError(f"{capability} cannot be granted to {self.role}")
        if "CAP_ROLE_ASSIGN" in granted and "CAP_ACCOUNT_ADMIN" not in granted:
            raise ValidationError("CAP_ROLE_ASSIGN requires CAP_ACCOUNT_ADMIN")
        if len(set(granted)) != len(granted):
            raise ValidationError("A capability is granted once")

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise RuntimeError("Role assignments are never hard-deleted (Data Model §3.2)")

    def valid_at(self, now) -> bool:
        return self.status == self.Status.ACTIVE and self.valid_from <= now < self.valid_until


class ConflictExclusion(models.Model):
    """Data Model §5.10: keyed on the account, retained permanently; a later role grant never clears it."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    report = models.ForeignKey("reports.CivicReport", on_delete=models.PROTECT, related_name="conflict_exclusions")
    excluded_staff_account = models.ForeignKey(StaffAccount, on_delete=models.PROTECT, related_name="+")
    reason = models.CharField(max_length=40)
    created_at = models.DateTimeField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["report", "excluded_staff_account"], name="one_exclusion_per_account")
        ]

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise RuntimeError("A conflict exclusion is never changed")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise RuntimeError("A conflict exclusion is retained permanently (Data Model §5.10)")
