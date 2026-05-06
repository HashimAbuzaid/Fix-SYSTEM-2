from typing import Any

from pydantic import BaseModel


class AuditItem(BaseModel):
    id: str
    created_at: str | None = None
    agent_id: str
    agent_name: str
    team: str
    case_type: str
    audit_date: str
    order_number: str | None = None
    phone_number: str | None = None
    ticket_id: str | None = None
    quality_score: float
    comments: str | None = None
    score_details: list[dict[str, Any]] = []
    shared_with_agent: bool | None = None
    shared_at: str | None = None
    created_by_user_id: str | None = None
    created_by_name: str | None = None
    created_by_email: str | None = None
    created_by_role: str | None = None


class AuditsPageResponse(BaseModel):
    data: list[AuditItem]
    next_page: int | None

