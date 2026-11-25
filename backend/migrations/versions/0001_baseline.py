"""baseline: 빈 초기 마이그레이션

테이블은 이후 티켓에서 추가한다. 이 리비전은 연결과 마이그레이션 흐름을 확인하는 출발점이다.

Revision ID: 0001
Revises:
Create Date: 2026-11-25
"""

from collections.abc import Sequence

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
