"""진단 업무 규칙. 진단 생성·조회는 SCRUM-124에서, 손익 다시 계산(A13)은 SCRUM-127에서 채운다."""

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, NoReturn
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.contracts import models as _contracts_models  # noqa: F401  (simulations.contract_id 외래 키가 contracts를 찾도록)
from app.diagnoses.calculations import (
    ExitInput,
    LossResult,
    ProfitInput,
    ProfitResult,
    calculate_profit,
    estimate_loss,
)
from app.diagnoses.models import Diagnosis, Simulation
from app.diagnoses.schemas import SimulationCreateRequest, SimulationResponse
from app.errors import AppError


def _not_implemented() -> NoReturn:
    raise AppError(503, "service_unavailable", "진단 기능을 아직 사용할 수 없습니다")


async def create_diagnosis() -> NoReturn:
    _not_implemented()


async def list_diagnoses() -> NoReturn:
    _not_implemented()


async def get_diagnosis() -> NoReturn:
    _not_implemented()


async def create_simulation() -> NoReturn:
    # 로그인 사용자를 확인하는 의존성(SCRUM-181)이 머지되면 라우터가 create_user_simulation을
    # 부르도록 바꾼다. 그 전에는 토큰의 주인을 알 수 없어 503으로 둔다.
    _not_implemented()


async def delete_diagnosis() -> NoReturn:
    # 구현은 SCRUM-157에서 채운다.
    _not_implemented()


@dataclass(frozen=True)
class SimulationOutcome:
    """A13 한 번의 계산 결과. DB를 쓰지 않는 순수 값이다."""

    # 진단 입력에 덮어쓴 뒤의 전체 비용
    costs: dict[str, Any]
    profit: ProfitResult
    # 종료 조건이 없으면 None
    loss: LossResult | None
    # 요청의 종료 조건. 없으면 None
    exit: dict[str, Any] | None

    def inputs(self) -> dict[str, Any]:
        """`simulations.inputs`: costs, exit(없으면 null), applied_terms(A13은 항상 빈 배열)."""
        return {"costs": self.costs, "exit": self.exit, "applied_terms": []}


def compute_simulation(
    cost_input: Mapping[str, Any], body: SimulationCreateRequest
) -> SimulationOutcome:
    """진단의 저장된 비용에 `overrides`로 보낸 값만 덮어쓰고 손익과 예상 손실을 계산한다."""
    costs = dict(cost_input)
    if body.overrides is not None:
        costs.update(body.overrides.model_dump(exclude_unset=True))

    profit_input = ProfitInput(
        monthly_rent=costs["monthly_rent"],
        rent_vat_included=costs["rent_vat_included"],
        management_fee=costs["management_fee"],
        labor_cost=costs["labor_cost"],
        other_fixed_cost=costs["other_fixed_cost"],
        variable_cost_rate=costs["variable_cost_rate"],
        expected_monthly_sales=costs["expected_monthly_sales"],
    )
    profit = calculate_profit(profit_input)

    exit_terms = None if body.exit is None else body.exit.model_dump()
    loss = None
    if exit_terms is not None:
        loss = estimate_loss(
            profit_input,
            key_money=costs["key_money"],
            facility_cost=costs["facility_cost"],
            exit_input=ExitInput(**exit_terms),
        )
    return SimulationOutcome(costs=costs, profit=profit, loss=loss, exit=exit_terms)


def _database_error() -> AppError:
    return AppError(503, "service_unavailable", "데이터베이스에 연결할 수 없습니다")


async def create_user_simulation(
    db: AsyncSession, user_id: UUID, diagnosis_id: UUID, body: SimulationCreateRequest
) -> SimulationResponse:
    """A13. 내 진단의 비용을 덮어써 손익을 다시 계산하고 `source='user'`로 저장한다.

    본인 소유 + 삭제 요청 없음 + 만료 전을 한 쿼리로 조회하고, 하나라도 어긋나면 404다.
    생존확률은 다시 계산하지 않는다.
    """
    try:
        row = (
            await db.execute(
                select(Diagnosis.cost_input).where(
                    Diagnosis.id == diagnosis_id,
                    Diagnosis.user_id == user_id,
                    Diagnosis.deletion_requested_at.is_(None),
                    Diagnosis.expires_at > func.now(),
                )
            )
        ).first()
        if row is None:
            raise AppError(404, "not_found", "진단을 찾을 수 없습니다")

        outcome = compute_simulation(row.cost_input, body)
        assumptions = list(outcome.loss.assumptions) if outcome.loss is not None else []
        simulation = Simulation(
            diagnosis_id=diagnosis_id,
            source="user",
            inputs=outcome.inputs(),
            break_even_sales=outcome.profit.break_even_sales,
            monthly_profit=outcome.profit.monthly_profit,
            affordable_rent=outcome.profit.affordable_rent,
            estimated_loss=outcome.loss.estimated_loss if outcome.loss is not None else None,
            assumptions=assumptions,
            created_at=datetime.now(UTC),
        )
        db.add(simulation)
        await db.commit()
    except SQLAlchemyError:
        await db.rollback()
        raise _database_error() from None

    return SimulationResponse(
        id=simulation.id,
        source="user",
        break_even_sales=simulation.break_even_sales,
        monthly_profit=simulation.monthly_profit,
        affordable_rent=simulation.affordable_rent,
        estimated_loss=simulation.estimated_loss,
        assumptions=assumptions,
    )
