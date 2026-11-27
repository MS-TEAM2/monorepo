"""업종 기준표와 인허가 매장의 외식 9종 분류. 기준: Notion 데이터 전처리 3장, 기획서 6장·18-2.

매장 하나를 `classify_store`로 분류한다. 순서가 결과를 바꾸므로 아래 순서를 지킨다.
2026-11-26 상호 단어 규칙 v5·업태 규칙 v3(임시 스크립트)를 옮긴 것이다.

1. 비대상 업태·비대상 상호(키즈카페, 아이스크림 할인점, 유흥)는 분류돼 있어도 뺀다.
2. 업태가 외식 9종이면 그 업종.
3. 아니면 상호 단어. 업종 단어가 한 업종에만 걸릴 때만 배정한다(쌀국수·베트남은 미분류).
4. 아직 미분류인데 상호가 편의점 브랜드·마트 자체면 뺀다(마트 안 매장은 남긴다).
5. 아직 미분류면 보조 업태(횟집 → 일식 등). 상호가 더 구체적이라 상호 결과를 덮어쓰지 않는다.
6. 아직 미분류인데 상호가 비음식점(PC방·보드게임 등)이면 뺀다.

뺀 매장(excluded)은 매핑률 분모에서 빼고, 미분류(unmapped)는 분모에 남긴다.
"""

import re
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

# 2단계: 업태만으로 정하는 업종.
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

# 5단계: 상호 단어로 정하지 못했을 때만 쓰는 업태 (2026-11-26 결정).
UPTAE_FALLBACK = {
    "횟집": "japanese",
    "복어취급": "japanese",
    "냉면집": "korean",
    "탕류(보신용)": "korean",
    "김밥(도시락)": "snack",
    "패밀리레스트랑": "western",
    "아이스크림": "cafe",
    "떡카페": "cafe",
}

# 1단계: 외식 대상이 아닌 업태. 매핑률 분모에서 빼고 건수를 따로 보고한다(기획서 18-2).
# `기타`처럼 업종을 알 수 없는 업태는 여기에 넣지 않는다(미분류로 분모에 포함).
# 키즈카페·라이브카페·감성주점은 2026-11-26 결정으로 추가했다.
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
        "키즈카페",
        "라이브카페",
        "감성주점",
    }
)
assert not NOT_TARGET_UPTAE & (UPTAE_TO_CATEGORY.keys() | UPTAE_FALLBACK.keys())


# ---------- 3단계: 상호 단어 ----------
def _words(text: str) -> tuple[str, ...]:
    return tuple(text.split())


# 한 업종 단어들. 공백으로 나눈다.
NAME_WORDS: dict[str, tuple[str, ...]] = {
    "cafe": _words(
        "커피 카페 까페 cafe coffee 에스프레소 espresso 스타벅스 투썸플레이스 이디야 "
        "메가엠지씨 메가커피 빽다방 컴포즈 할리스 폴바셋 커피빈 탐앤탐스 파스쿠찌 엔제리너스 "
        "더벤티 매머드 공차 쥬씨 요거트 요거프레소 탕후루 아이스크림 젤라또 젤라토 빙수 "
        "디저트 바나프레소 로스터리 로스터스 배스킨 설빙 밀크티 버블티 주스 쥬스"
    ),
    "bakery": _words(
        "베이커리 bakery 제과 베이글 bagel 파리바게뜨 파리바게트 뚜레쥬르 브레드 bread 도넛 "
        "도너츠 donut 크로와상 빵집 빵공장 호두 베이킹 제빵 케이크 식빵 마카롱 타르트 쿠키 "
        "크로플 와플"
    ),
    "pub_chicken": _words(
        "치킨 chicken 통닭 호프 hof 투다리 포차 펍 pub 맥주 교촌 굽네 처갓집 페리카나 "
        "노랑통닭 푸라닭 bbq bhc"
    ),
    "korean": _words(
        "국밥 갈비 삼겹 곱창 막창 찌개 백반 감자탕 해장국 한정식 보쌈 족발 설렁탕 삼계탕 "
        "닭갈비 비빔밥 한우 칼국수 순대국 순댓국 육개장 떡 본죽 죽이야기 냉면 막국수 찜닭 "
        "아구찜 보리밥 쌈밥 곰탕 수제비"
    ),
    "snack": _words(
        "김밥 분식 떡볶이 떡볶기 떡뽁이 만두 국수 꽈배기 호떡 붕어빵 닭강정 어묵 오뎅 튀김 "
        "순대 토스트 타코야끼 츄러스 한솥 김가네 잉어빵 라면 떡튀순 떡꼬치"
    ),
    "chinese": _words("중국집 중화요리 짜장 짬뽕 마라탕 마라샹궈 훠궈 양꼬치 딤섬 반점"),
    "japanese": _words(
        "스시 초밥 라멘 우동 소바 오마카세 텐동 규동 일식 오니기리 카츠 돈까스 돈가스 덮밥 "
        "연어 장어 참치 이자카야 야키토리"
    ),
    "western": _words(
        "파스타 스테이크 브런치 비스트로 트라토리아 이탈리안 샐러드 샐러디 포케 샌드위치"
    ),
    "fastfood": _words(
        "버거 burger 맥도날드 롯데리아 맘스터치 kfc 서브웨이 subway 핫도그 피자 pizza "
        "써브웨이 케밥 부리또 브리또"
    ),
}
assert set(NAME_WORDS) == set(CATEGORY_IDS)

_NAME_PATTERNS = {
    c: re.compile("|".join(map(re.escape, ws)), re.IGNORECASE) for c, ws in NAME_WORDS.items()
}
# 다른 업종 단어 안에 들어 있는 단어를 그 업종을 볼 때만 지운다.
_STRIP = {
    "japanese": re.compile(r"필라멘트"),
    "fastfood": re.compile(r"(?<!케)밥버거"),  # 밥버거는 한식
    "snack": re.compile(r"칼국수|막국수|순대국|순댓국|순대국밥"),  # 한식 단어 안의 국수·순대
    "cafe": re.compile(r"아이스크림\s*할인"),
    "korean": re.compile(r"떡볶이|떡볶기|떡뽁이|떡튀순|떡꼬치|떡카페"),  # 떡은 떡집만 한식
}
# 휴게음식점은 술 단어(호프·맥주·펍·포차) 없이 치킨 단어만 본다.
_REST_CHICKEN = re.compile(
    r"치킨|chicken|통닭|교촌|굽네|처갓집|페리카나|노랑통닭|푸라닭|bbq|bhc", re.IGNORECASE
)
# 9종 어디에도 맞지 않아 미분류로 남긴다(2026-11-26 결정).
_VIETNAMESE = re.compile(r"쌀국수|베트남|반미|분짜|팟타이|pho\b|포보|퍼홍|에머이", re.IGNORECASE)
_NOT_A_CAFE = re.compile(
    r"보드게임|보드카페|키즈|피씨|pc카페|pc방|만화|스터디|룸카페|방탈출|애견|펫|고양이|멍|타로|사주|코인",
    re.IGNORECASE,
)
_RICE_BURGER = re.compile(r"(?<!케)밥버거")

# ---------- 비대상 상호 ----------
# 1단계: 분류돼 있어도 뺀다.
_ALWAYS_EXCLUDE = {
    "kids_cafe": re.compile(r"키즈\s*[카까]페"),
    "discount_store": re.compile(
        r"아이스크림\s*(?:할인|마트|창고|24)|(?<!요거트)(?<!요거트 )아이스크림\s*천국"
        r"|할인\s*아이스크림"
        r"|노마진\s*아이스|픽미픽미|와와\s*아이스"
        r"|아이스\s*(?:마트|창고|팡팡|할인)|세계\s*과자|과자\s*(?:할인|창고|마트|도매)|할인\s*마트",
        re.IGNORECASE,
    ),
    # `클럽`·`나이트`는 식당 이름에 많아 쓰지 않는다.
    "nightlife_name": re.compile(r"나이트클럽|콜라텍|성인나이트|가라오케|노래빠|룸살롱|단란주점"),
}
# 4단계: 편의점 브랜드는 상호 어디에 있어도, 마트는 상호가 마트 브랜드로 시작하고 괄호가 없을 때만.
# (망고식스롯데마트점, 떡탐(이마트상봉점)처럼 마트 안 매장은 남긴다)
_CONVENIENCE = (
    r"이마트\s*24|훼미리마트|패밀리마트|세븐일레븐|7-?eleven|gs\s*25|지에스\s*(?:\(gs\))?\s*25|lg\s*25"
    r"|미니스톱|위드미|바이더웨이|^(?:\(주\)|㈜|주식회사)?\s*(?:씨유|cu)(?![a-z])"
)
_MART_ITSELF = (
    r"^(?:\(주\)|㈜|주식회사)?\s*(?:신세계|롯데쇼핑\s*(?:\(주\)|㈜)?|\S*농협)?\s*"
    r"(?:이마트(?:에브리데이|트레이더스|메트로)?|롯데마트|홈플러스(?:\s*익스프레스)?|롯데슈퍼|gs\s*슈퍼마켓"
    r"|하나로\s*마트|노브랜드)[^()（）]*$|^[^()（）\s]+(?:마트|슈퍼|슈퍼마켓)$"
)
_MART_OR_CONVENIENCE = re.compile(f"(?:{_CONVENIENCE})|(?:{_MART_ITSELF})", re.IGNORECASE)
# 6단계: 병원·학원·호텔처럼 그 안의 식당까지 걸리는 장소 단어는 넣지 않는다.
_NONFOOD = re.compile(
    r"pc방|피씨방|pc카페|보드게임|만화|스터디|피트니스|휘트니스|헬스장|헬스클럽|짐박스|코인노래|노래연습"
    r"|볼링|당구|골프|방탈출|꽃집|네일|미용실|약국",
    re.IGNORECASE,
)

MAPPED, UNMAPPED, EXCLUDED = "mapped", "unmapped", "excluded"


@dataclass(frozen=True)
class Classification:
    category_id: str | None
    status: str  # MAPPED, UNMAPPED, EXCLUDED
    reason: str  # 어떤 단계에서 정해졌는지 (보고용)


def classify_store(name: str | None, source: str, source_type: str | None) -> Classification:
    """매장 하나를 외식 9종으로 분류한다. source는 stores.source(general·rest·bakery)."""
    name = name if isinstance(name, str) else ""
    source_type = source_type if isinstance(source_type, str) else None
    if source_type in NOT_TARGET_UPTAE:
        return Classification(None, EXCLUDED, "not_target_uptae")
    for reason, pattern in _ALWAYS_EXCLUDE.items():
        if pattern.search(name):
            return Classification(None, EXCLUDED, reason)
    if source_type in UPTAE_TO_CATEGORY:
        return Classification(UPTAE_TO_CATEGORY[source_type], MAPPED, "uptae")
    category, reason = _match_name(name, source)
    if category:
        return Classification(category, MAPPED, "name")
    if _MART_OR_CONVENIENCE.search(name) and "코너" not in name:
        return Classification(None, EXCLUDED, "mart_convenience")
    if source_type in UPTAE_FALLBACK:
        return Classification(UPTAE_FALLBACK[source_type], MAPPED, "uptae_fallback")
    if _NONFOOD.search(name):
        return Classification(None, EXCLUDED, "nonfood_name")
    return Classification(None, UNMAPPED, reason)


def _match_name(name: str, source: str) -> tuple[str | None, str]:
    if not name:
        return None, "no_name"
    if _VIETNAMESE.search(name):
        return None, "vietnamese"
    hits = set()
    for category, pattern in _NAME_PATTERNS.items():
        if source == "rest" and category == "pub_chicken":
            if _REST_CHICKEN.search(name):
                hits.add(category)
            continue
        if category == "cafe" and _NOT_A_CAFE.search(name):
            continue
        text = _STRIP[category].sub("", name) if category in _STRIP else name
        if pattern.search(text):
            hits.add(category)
    if _RICE_BURGER.search(name) and "fastfood" not in hits:
        hits.add("korean")
    if hits == {"cafe", "bakery"}:  # 베이커리 카페는 카페 우선
        hits = {"cafe"}
    if len(hits) == 1:
        return hits.pop(), "name"
    return None, "ambiguous" if hits else "no_match"


def uptae_category(source_type: str | None) -> str | None:
    """업태만으로 정해지는 업종. category_mappings 표에 쓴다."""
    return UPTAE_TO_CATEGORY.get(source_type) or UPTAE_FALLBACK.get(source_type)


def mapping_status(source_type: str | None) -> str:
    """category_mappings.mapping_status 값 (업태 단위)."""
    if uptae_category(source_type):
        return MAPPED
    if source_type in NOT_TARGET_UPTAE:
        return EXCLUDED
    return UNMAPPED
