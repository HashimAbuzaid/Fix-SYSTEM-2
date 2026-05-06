from fastapi import APIRouter, Query

from app.db import get_supabase
from app.schemas.audits import AuditsPageResponse

PAGE_SIZE_DEFAULT = 50
PAGE_SIZE_MAX = 200

router = APIRouter()


@router.get("/audits", response_model=AuditsPageResponse)
def get_audits(
    page: int = Query(default=0, ge=0),
    page_size: int = Query(default=PAGE_SIZE_DEFAULT, ge=1, le=PAGE_SIZE_MAX),
    team: str | None = Query(default=None),
    case_type: str | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
) -> AuditsPageResponse:
    from_idx = page * page_size
    to_idx = from_idx + page_size - 1

    supabase = get_supabase()
    query = (
        supabase.table("audits")
        .select("*")
        .order("created_at", desc=True)
        .order("audit_date", desc=True)
        .range(from_idx, to_idx)
    )

    if team:
        query = query.eq("team", team)
    if case_type:
        query = query.eq("case_type", case_type)
    if date_from:
        query = query.gte("audit_date", date_from)
    if date_to:
        query = query.lte("audit_date", date_to)

    result = query.execute()
    rows = result.data or []
    next_page = page + 1 if len(rows) == page_size else None

    return AuditsPageResponse(data=rows, next_page=next_page)

