"""업종 기준표와 인허가 업태 매핑표. 기준: Notion 데이터 전처리 3장, 기획서 6장·18-2.

매핑을 늘리는 작업(상호 규칙, 업태 추가)은 SCRUM-99에서 한다. 여기서는 확정된 표만 둔다.
"""

from dataclasses import dataclass

from ai_core.survival.contract import CATEGORY_IDS


@dataclass(frozen=True)
class Category:
    id: str
    name: str
    seoul_codes: tuple[str, ...]


# 순서가 화면 표시 순서(sort_order)다.
CATEGORIES = (
    Category("korean", "한식", ("CS100001",)),
    Category("chinese", "중식", ("CS100002",)),
    Category("japanese", "일식", ("CS100003",)),
    Category("western", "양식", ("CS100004",)),
    Category("bakery", "제과점", ("CS100005",)),
    Category("fastfood", "패스트푸드", ("CS100006",)),
    Category("snack", "분식", ("CS100008",)),
    Category("pub_chicken", "호프·치킨", ("CS100007", "CS100009")),
    Category("cafe", "카페", ("CS100010",)),
)
assert {c.id for c in CATEGORIES} == set(CATEGORY_IDS)

UPTAE_TO_CATEGORY = {
    "한식": "korean",
    "식육(숯불구이)": "korean",
    "중국식": "chinese",
    "일식": "japanese",
    "경양식": "western",
    "제과점영업": "bakery",
    "패스트푸드": "fastfood",
    "분식": "snack",
    "호프/통닭": "pub_chicken",
    "통닭(치킨)": "pub_chicken",
    "정종/대포집/소주방": "pub_chicken",
    "까페": "cafe",
    "커피숍": "cafe",
    "다방": "cafe",
    "전통찻집": "cafe",
}

# 처음부터 외식 대상이 아닌 업태. 매핑률 분모에서 빼고 건수를 따로 보고한다(기획서 18-2).
# `기타`처럼 업종을 알 수 없는 업태는 여기에 넣지 않는다(미분류로 분모에 포함).
NOT_TARGET_UPTAE = frozenset(
    {
        "편의점",
        "백화점",
        "철도역구내",
        "유원지",
        "관광호텔",
        "극장",
        "공항",
        "고속도로",
        "식품등 수입판매업",
        "식품소분업",
        "출장조리",
        "이동조리",
        "룸살롱",
        "단란주점",
    }
)

MAPPED, UNMAPPED, EXCLUDED = "mapped", "unmapped", "excluded"


def mapping_status(source_type: str | None) -> str:
    """category_mappings.mapping_status 값."""
    if source_type in UPTAE_TO_CATEGORY:
        return MAPPED
    if source_type in NOT_TARGET_UPTAE:
        return EXCLUDED
    return UNMAPPED
