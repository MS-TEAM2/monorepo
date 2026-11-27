"""생존 라벨 (SCRUM-116). 기준: Notion 데이터 전처리 6장 "A09·A11 학습 데이터".

한 행 = 인허가 1건. 입력은 `licenses.clean()` → `coords.locate()`를 거친 매장 표다.

- 기간: 인허가일부터 폐업일. 영업 중이면 원천별 관측 종료일(원천 갱신 마지막 날)까지 중도절단.
  2025년에서 자르지 않는다. 관측 종료일 뒤의 폐업일은 중도절단으로 본다.
- 12개월 라벨: 12개월 안에 폐업하면 0, 아니면 1.
  관측이 12개월보다 짧은 영업 중 매장은 표본에서 뺀다.
- 표본: Kaplan-Meier는 2023–2025년 개업, 12개월은 2021–2025년 개업(2021–22년은 개발 검증용).
- 제외는 첫 사유 하나만 기록한다. Kaplan-Meier에는 좌표·면적·팝업 조건을 적용하지 않는다.
- 팝업(2026-11-26 결정, 기획서의 100m 규칙 대신): 개업 시점에 알 수 있는 정보로 판정한다.
  확정 ① 상호 `한시적` ② 임시 장소 주소 ③ 팝업 업체(같은 핵심 상호의 직전 1년 인허가 3건 이상,
  그 과거 건 영업일 중앙값 60일 이하) → 12개월 표본에서 뺀다.
  의심 ④ 같은 주소 직전 1년 개업 3건 이상 → 표시만 한다. ⑤ 100m 규칙은 피처 작업(SCRUM-118).
- 다시 개업 의심: 같은 주소·같은 상호로 폐업 후 90일 안에 새 인허가. 앞 인허가에 표시만 하고
  합치지 않는다(상호가 바뀐 재등록은 폐업 + 새 개업). 보고서에서 포함·제외를 비교한다.

    # 내려받은 CSV로 라벨과 보고서 만들기. --out은 새 폴더(기존 결과를 덮어쓰지 않는다)
    uv run python -m ai_core.survival.labels --csv-dir <폴더> --geojson <경계 파일> --out <새 폴더>
"""

import argparse
import json
import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd

from ai_core.ingest.categories import EXCLUDED

KM_YEARS = (2023, 2025)
M12_YEARS = (2021, 2025)
REOPEN_DAYS = 90
HORIZON_DAYS = {"12m": 365, "24m": 730, "36m": 1095}
SOURCE_TIMEZONE = "Asia/Seoul"

# 팝업 기준값 (2026-11-26 결정)
POPUP_LOOKBACK_DAYS = 365
POPUP_OPERATOR_MIN_PRIOR = 3
POPUP_OPERATOR_MAX_MEDIAN_DAYS = 60
BUSY_SPOT_MIN_PRIOR = 3

# ① `한시십일분` 같은 상호가 걸리지 않게 `한시적`과 `(한시)`만 본다.
_HANSHI = re.compile(r"한시적|[(\[]\s*한시\s*[)\]]")
# ② 삼일대로·일원동·광장상가 같은 지명·건물명은 걸리지 않게 한다.
_EVENT_PLACE = re.compile(
    r"행사장|행사매장|팝업|부스|특설|\s일대(?![로길동])|\s일원(?![로길동])"
    r"|잔디\s*광장|광장\s*(?:내|앞|옆|일대)"
)

LABEL_COLUMNS = [
    "source", "management_no", "category_id", "status", "licensed_on", "closed_on",
    "obs_end", "cohort_year", "duration_days", "event", "censored", "dong_code", "lat", "lon",
    "area_sqm", "reopen_suspect", "popup_confirmed", "popup_reason", "popup_suspect",
    "km_sample", "km_exclude_reason", "m12_sample", "m12_exclude_reason", "label_12m",
    "role_dev", "role_final",
]  # fmt: skip


def observation_end(stores: pd.DataFrame) -> pd.Series:
    """원천별 관측 종료일: 원천 갱신 시각 최댓값의 한국 날짜."""
    updated = pd.to_datetime(stores["source_updated_at"], utc=True)
    last = updated.groupby(stores["source"]).max()
    return last.dt.tz_convert(SOURCE_TIMEZONE).dt.tz_localize(None).dt.normalize()


def build_labels(stores: pd.DataFrame) -> pd.DataFrame:
    """매장 표 전체(연도를 자르지 않은)로 라벨을 만든다. 반환은 두 표본 기간 안의 행만."""
    s = stores.reset_index(drop=True).copy()
    lic = pd.to_datetime(s["licensed_on"])
    clo = pd.to_datetime(s["closed_on"])
    s["obs_end"] = s["source"].map(observation_end(s))
    s["cohort_year"] = lic.dt.year.astype("Int64")

    # ---------- 기간, 사건 ----------
    s["event"] = (s["status"] == "closed") & clo.notna() & (clo <= s["obs_end"])
    end = clo.where(s["event"], s["obs_end"])
    s["duration_days"] = (end - lic).dt.days.astype("Int64")
    s["censored"] = ~s["event"]

    # ---------- 표시 ----------
    target = s["mapping_status"] != EXCLUDED
    s["reopen_suspect"] = _reopen_suspect(s, lic, clo)
    popup = _popup(s, lic, clo, target)
    s["popup_reason"] = popup["reason"]
    s["popup_confirmed"] = s["popup_reason"].notna()
    s["popup_suspect"] = ~s["popup_confirmed"] & popup["busy_spot"]

    # ---------- 제외 사유 (첫 사유만) ----------
    area = pd.to_numeric(s["area_sqm"], errors="coerce")
    in_km = s["cohort_year"].between(*KM_YEARS).fillna(False)
    in_m12 = s["cohort_year"].between(*M12_YEARS).fillna(False)
    common = [
        ("not_target", ~target),
        ("missing_licensed_on", lic.isna()),
        ("date_inverted", clo.notna() & (clo < lic)),
        ("unmapped_category", s["category_id"].isna()),
        ("temporary_name_hanshi", s["popup_reason"] == "hanshi"),
        ("closed_without_date", (s["status"] == "closed") & clo.isna()),
    ]
    twelve = lic + pd.DateOffset(months=12)
    observed_12m = s["event"] | (s["obs_end"] >= twelve)
    s["km_exclude_reason"] = _first_reason(s.index, [("out_of_period", ~in_km), *common])
    s["m12_exclude_reason"] = _first_reason(
        s.index,
        [
            ("out_of_period", ~in_m12),
            *common,
            ("popup_confirmed", s["popup_confirmed"]),
            ("missing_coordinates", s["lat"].isna() | s["lon"].isna()),
            ("area_missing_or_zero", area.isna() | (area <= 0)),
            ("not_observed_12m", ~observed_12m),
        ],
    )
    s["km_sample"] = s["km_exclude_reason"].isna()
    s["m12_sample"] = s["m12_exclude_reason"].isna()
    survived = ~(s["event"] & (clo < twelve))
    s["label_12m"] = survived.astype("Int64").where(s["m12_sample"])

    # ---------- 검증 역할 (plan.md: 2023 동 분리 CV, 2021–22 → 2024, 최종 2023 → 2025 1회) ----
    year = s["cohort_year"]
    s["role_dev"] = (
        pd.Series(pd.NA, index=s.index, dtype="object")
        .mask(year.isin([2021, 2022]).fillna(False), "dev_train")
        .mask((year == 2023).fillna(False), "dev_cv_by_dong")
        .mask((year == 2024).fillna(False), "dev_test")
        .where(s["m12_sample"])
    )
    s["role_final"] = (
        pd.Series(pd.NA, index=s.index, dtype="object")
        .mask((year == 2023).fillna(False), "final_train")
        .mask((year == 2025).fillna(False), "final_test_once")
        .where(s["m12_sample"])
    )
    return s.loc[in_km | in_m12, LABEL_COLUMNS].reset_index(drop=True)


def _first_reason(index: pd.Index, rules: list[tuple[str, pd.Series]]) -> pd.Series:
    reason = pd.Series(pd.NA, index=index, dtype="object")
    for label, mask in rules:
        reason = reason.mask(reason.isna() & mask.fillna(False).astype(bool), label)
    return reason


def _address(s: pd.DataFrame) -> pd.Series:
    """도로명(없으면 지번) 주소에서 공백만 뺀 값. 호실·층이 남아 같은 건물의 다른 가게를 가른다."""
    addr = s["road_address"].fillna(s["lot_address"]).fillna("")
    return addr.astype(str).str.replace(r"\s+", "", regex=True)


def _reopen_suspect(s: pd.DataFrame, lic: pd.Series, clo: pd.Series) -> pd.Series:
    """같은 주소·상호로 폐업 후 REOPEN_DAYS일 안에 새 인허가가 있으면 앞 인허가에 True."""
    name = s["name"].fillna("").astype(str).str.replace(r"\s+", "", regex=True).str.lower()
    addr = _address(s)
    key = (addr + "|" + name).where((addr != "") & (name != ""))
    frame = pd.DataFrame({"key": key, "lic": lic, "clo": clo, "row": s.index})
    frame = frame[frame["key"].notna() & frame["key"].duplicated(keep=False)]
    pairs = frame[frame["clo"].notna()].merge(
        frame[["key", "lic", "row"]], on="key", suffixes=("", "_n")
    )
    gap = (pairs["lic_n"] - pairs["clo"]).dt.days
    hit = pairs.loc[(pairs["row"] != pairs["row_n"]) & gap.between(0, REOPEN_DAYS), "row"]
    return pd.Series(s.index.isin(hit), index=s.index)


def core_name(name: str | None) -> str:
    """법인 표기·괄호·지점명·한시적을 뺀 핵심 상호. 팝업 업체 판정에 쓴다."""
    n = str(name or "").lower()
    n = re.sub(r"\(주\)|㈜|주식회사|유한회사|농업회사법인|\(유\)", "", n)
    n = re.sub(r"\(.*?\)|\[.*?\]", "", n)
    n = re.sub(r"한시적\s*영업|한시적|한시", "", n)
    n = re.sub(r"\s+", " ", n).strip()
    if len(n.replace(" ", "")) > 4:
        n = re.sub(r"\s*\S{1,10}(직영점|본점|점)$", "", n)
    return n.replace(" ", "")


def _popup(s: pd.DataFrame, lic: pd.Series, clo: pd.Series, target: pd.Series) -> pd.DataFrame:
    """확정 팝업 사유(hanshi·event_place·popup_operator, 앞 순서 우선)와 ④ 같은 자리 회전."""
    name = s["name"].fillna("").astype(str)
    addr_text = s["road_address"].fillna("") + " " + s["lot_address"].fillna("")
    hanshi = name.str.contains(_HANSHI)
    event_place = addr_text.str.contains(_EVENT_PLACE)

    ok = target & lic.notna()
    cores = name.map(core_name)
    operator = pd.Series(False, index=s.index)
    lookback = np.timedelta64(POPUP_LOOKBACK_DAYS, "D")
    for _, g in s[ok & (cores.str.len() >= 2)].groupby(cores):
        if len(g) <= POPUP_OPERATOR_MIN_PRIOR:
            continue
        g_lic, g_clo = lic[g.index].to_numpy(), clo[g.index].to_numpy()
        days = (clo[g.index] - lic[g.index]).dt.days.to_numpy()
        for idx, t in zip(g.index, g_lic, strict=True):
            # 개업 전에 이미 끝난 과거 건만 본다. 개업 뒤에 알게 되는 정보는 쓰지 않는다.
            past = (g_lic < t) & (g_lic >= t - lookback) & ~pd.isna(g_clo) & (g_clo < t)
            if past.sum() >= POPUP_OPERATOR_MIN_PRIOR and np.median(days[past]) <= (
                POPUP_OPERATOR_MAX_MEDIAN_DAYS
            ):
                operator[idx] = True

    addr = _address(s)
    busy = pd.Series(False, index=s.index)
    for _, g in s[ok & (addr != "")].groupby(addr):
        if len(g) <= BUSY_SPOT_MIN_PRIOR:
            continue
        g_lic = lic[g.index].to_numpy()
        for idx, t in zip(g.index, g_lic, strict=True):
            busy[idx] = ((g_lic < t) & (g_lic >= t - lookback)).sum() >= BUSY_SPOT_MIN_PRIOR

    reason = pd.Series(pd.NA, index=s.index, dtype="object")
    for label, mask in [
        ("hanshi", hanshi),
        ("event_place", event_place & target),
        ("popup_operator", operator),
    ]:
        reason = reason.mask(reason.isna() & mask, label)
    return pd.DataFrame({"reason": reason, "busy_spot": busy})


# ---------- 보고 ----------
def kaplan_meier_at(duration: pd.Series, event: pd.Series) -> dict:
    """12·24·36개월 시점의 Kaplan-Meier 생존율과 위험 집합 크기. 보고용(기준선은 SCRUM-117)."""
    t = duration.to_numpy(dtype=float)
    e = event.to_numpy(dtype=bool)
    times = np.unique(t[e])
    at_risk = np.array([(t >= ti).sum() for ti in times])
    deaths = np.array([((t == ti) & e).sum() for ti in times])
    surv = np.cumprod(1 - deaths / at_risk) if len(times) else np.array([])
    out = {}
    for label, days in HORIZON_DAYS.items():
        k = np.searchsorted(times, days, side="right")
        value = float(surv[k - 1]) if k else 1.0
        out[label] = {"survival": round(value, 4), "at_risk": int((t >= days).sum())}
    return out


def label_report(labels: pd.DataFrame) -> dict:
    """완료 조건: 중도절단·제외 건수, 재개업 의심 포함·제외 비교."""
    in_km = labels["cohort_year"].between(*KM_YEARS).fillna(False)
    in_m12 = labels["cohort_year"].between(*M12_YEARS).fillna(False)
    km = labels[labels["km_sample"]]
    m12 = labels[labels["m12_sample"]]

    def counts(series: pd.Series) -> dict:
        return {str(k): int(v) for k, v in series.value_counts().items()}

    def m12_rate(d: pd.DataFrame) -> dict:
        n = len(d)
        survived = int((d["label_12m"] == 1).sum())
        return {"n": n, "survived_12m": survived, "rate": round(survived / n, 4) if n else None}

    reopen = {}
    for cat in sorted(set(km["category_id"]) | set(m12["category_id"])):
        k, m = km[km["category_id"] == cat], m12[m12["category_id"] == cat]
        reopen[cat] = {
            "km": {
                "n": len(k),
                "reopen_suspect": int(k["reopen_suspect"].sum()),
                "include": kaplan_meier_at(k["duration_days"], k["event"]),
                "exclude": kaplan_meier_at(
                    k.loc[~k["reopen_suspect"], "duration_days"],
                    k.loc[~k["reopen_suspect"], "event"],
                ),
            },
            "m12": {
                "reopen_suspect": int(m["reopen_suspect"].sum()),
                "include": m12_rate(m),
                "exclude": m12_rate(m[~m["reopen_suspect"]]),
            },
        }
    return {
        "basis": "Notion 데이터 전처리 6장, specs/survival-diagnosis, 팝업 2026-11-26 결정",
        "obs_end_by_source": {
            str(k): v.strftime("%Y-%m-%d")
            for k, v in labels.groupby("source")["obs_end"].max().items()
        },
        "km_sample": {
            "years": list(KM_YEARS),
            "rows_in_period": int(in_km.sum()),
            "excluded_by_reason": counts(labels.loc[in_km, "km_exclude_reason"].dropna()),
            "sample": len(km),
            "events_closed": int(km["event"].sum()),
            "censored": int(km["censored"].sum()),
            "by_category": counts(km["category_id"]),
        },
        "m12_sample": {
            "years": list(M12_YEARS),
            "rows_in_period": int(in_m12.sum()),
            "excluded_by_reason": counts(labels.loc[in_m12, "m12_exclude_reason"].dropna()),
            "sample": len(m12),
            "by_cohort_year": {
                str(y): {
                    "n": len(d),
                    "closed_within_12m": int((d["label_12m"] == 0).sum()),
                    "survived_12m": int((d["label_12m"] == 1).sum()),
                }
                for y, d in m12.groupby("cohort_year")
            },
        },
        "popup": {
            "rule": "확정 ① 한시적 ② 임시 장소 ③ 팝업 업체 → 12개월 표본 제외. "
            "의심 ④ 같은 주소 직전 1년 개업 3건 이상 → 표시만. ⑤ 100m는 SCRUM-118",
            "confirmed_by_reason_in_period": counts(labels.loc[in_m12, "popup_reason"].dropna()),
            "suspect_in_m12_sample": int(m12["popup_suspect"].sum()),
        },
        "reopen_suspect": {
            "rule": f"같은 주소·상호, 폐업 후 {REOPEN_DAYS}일 안에 새 인허가 (앞 인허가에 표시)",
            "in_period": int(labels["reopen_suspect"].sum()),
            "in_km_sample": int(km["reopen_suspect"].sum()),
            "in_m12_sample": int(m12["reopen_suspect"].sum()),
            "by_category": reopen,
        },
    }


# ---------- 실행 ----------
def main(argv: list[str] | None = None) -> int:
    from ai_core.ingest.boundaries import read_admdong
    from ai_core.ingest.coords import Boundaries, locate
    from ai_core.ingest.licenses import clean, iter_sources, read_csv_file

    parser = argparse.ArgumentParser(prog="python -m ai_core.survival.labels", description=__doc__)
    parser.add_argument("--csv-dir", type=Path, required=True, help="인허가 3종 CSV 폴더")
    parser.add_argument("--geojson", type=Path, required=True, help="행정동 경계 GeoJSON")
    parser.add_argument("--out", type=Path, required=True, help="결과를 쓸 새 폴더")
    args = parser.parse_args(argv)
    if args.out.exists() and any(args.out.iterdir()):
        parser.error(
            f"{args.out}에 이미 파일이 있습니다. 기존 결과를 덮어쓰지 않으니 새 폴더를 주세요"
        )

    boundaries = Boundaries.from_frame(read_admdong(args.geojson))
    frames = []
    for source in iter_sources():
        result = clean(source, read_csv_file(args.csv_dir / source.file_name))
        frames.append(locate(result.stores, boundaries))
    labels = build_labels(pd.concat(frames, ignore_index=True))
    report = label_report(labels)

    args.out.mkdir(parents=True, exist_ok=True)
    out = labels.copy()
    for c in ("licensed_on", "closed_on", "obs_end"):
        out[c] = pd.to_datetime(out[c]).dt.strftime("%Y-%m-%d")
    out.to_csv(args.out / "survival_labels.csv", index=False, encoding="utf-8-sig")
    text = json.dumps(report, ensure_ascii=False, indent=2)
    (args.out / "label_report.json").write_text(text, encoding="utf-8")
    print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
