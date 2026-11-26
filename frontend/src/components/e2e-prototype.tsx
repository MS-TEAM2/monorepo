"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { calculateBreakEvenRevenue } from "@/lib/prototype-calculations";

type Step = "explore" | "diagnosis" | "contract" | "result";

const stepOrder: Step[] = ["explore", "diagnosis", "contract", "result"];
const stepLabels = ["상권 선택", "진단 입력", "조건 확인", "전후 비교"];

const formatWon = (amount: number) => `${new Intl.NumberFormat("ko-KR").format(amount)}원`;
const formatTenThousandWon = (amount: number | null) =>
  amount === null ? "계산할 수 없음" : `${new Intl.NumberFormat("ko-KR").format(Math.round(amount / 10_000))}만원`;

function Field({
  id,
  label,
  value,
  onChange,
  minimum = 0,
  suffix = "원",
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  minimum?: number;
  suffix?: string;
}) {
  const invalid = !Number.isFinite(value) || value < minimum;

  return (
    <label className="grid gap-2 text-sm font-medium" htmlFor={id}>
      {label}
      <span className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          min={minimum}
          aria-invalid={invalid}
          inputMode="numeric"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-12 text-base"
        />
        <span className="shrink-0 text-muted-foreground">{suffix}</span>
      </span>
      {invalid ? (
        <span className="text-xs font-medium text-destructive" role="alert">
          {minimum > 0 ? `${formatWon(minimum)} 이상 입력해 주세요.` : "0 이상의 금액을 입력해 주세요."}
        </span>
      ) : null}
    </label>
  );
}

function DemoNotice() {
  return (
    <div
      className="rounded-xl border border-primary/30 bg-primary-soft/50 px-4 py-3 text-sm text-foreground"
      role="note"
    >
      <strong>시연용 목업</strong>
      <span className="ml-2">가상 조건과 계산 예시만 사용합니다. 지도·로그인·API·OCR은 연결되지 않았습니다.</span>
    </div>
  );
}

export function E2EPrototype() {
  const [step, setStep] = useState<Step>("explore");
  const [location, setLocation] = useState("공덕동");
  const [radius, setRadius] = useState("500m");
  const [monthlyRent, setMonthlyRent] = useState(2_500_000);
  const [maintenance, setMaintenance] = useState(300_000);
  const [payroll, setPayroll] = useState(3_000_000);
  const [otherFixedCosts, setOtherFixedCosts] = useState(1_200_000);
  const [contractRent, setContractRent] = useState(3_000_000);
  const [contractMaintenance, setContractMaintenance] = useState("");
  const [rentConfirmed, setRentConfirmed] = useState(false);
  const [maintenanceConfirmed, setMaintenanceConfirmed] = useState(false);

  const beforeBreakEven = useMemo(
    () =>
      calculateBreakEvenRevenue({
        monthlyRent,
        maintenance,
        payroll,
        otherFixedCosts,
        variableCostRate: 0.4,
      }),
    [monthlyRent, maintenance, payroll, otherFixedCosts],
  );
  const afterBreakEven = useMemo(
    () =>
      calculateBreakEvenRevenue({
        monthlyRent: contractRent,
        maintenance: contractMaintenance.trim() === "" ? Number.NaN : Number(contractMaintenance),
        payroll,
        otherFixedCosts,
        variableCostRate: 0.4,
      }),
    [contractRent, contractMaintenance, payroll, otherFixedCosts],
  );
  const currentStepIndex = stepOrder.indexOf(step);

  function moveTo(nextStep: Step) {
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function restart() {
    setStep("explore");
    setLocation("공덕동");
    setRadius("500m");
    setMonthlyRent(2_500_000);
    setMaintenance(300_000);
    setPayroll(3_000_000);
    setOtherFixedCosts(1_200_000);
    setContractRent(3_000_000);
    setContractMaintenance("");
    setRentConfirmed(false);
    setMaintenanceConfirmed(false);
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-primary">서울 외식 9종 · 가상 시나리오</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">창업 조건을 한 흐름으로 확인해요</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            상권을 고르고, 월세 손익을 계산하고, 계약 조건을 반영하는 대표 흐름을 시연합니다.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={restart} className="min-h-11">
          처음부터
        </Button>
      </div>

      <DemoNotice />

      <nav aria-label="프로토타입 진행 단계">
        <ol className="grid grid-cols-4 gap-2">
          {stepLabels.map((label, index) => {
            const active = index === currentStepIndex;
            const complete = index < currentStepIndex;
            return (
              <li
                key={label}
                aria-current={active ? "step" : undefined}
                className={`rounded-xl border px-2 py-3 text-center text-xs sm:text-sm ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : complete
                      ? "border-primary/30 bg-primary-soft text-foreground"
                      : "border-border bg-card text-muted-foreground"
                }`}
              >
                <span className="mr-1 font-semibold">{index + 1}</span>
                {label}
              </li>
            );
          })}
        </ol>
      </nav>

      {step === "explore" && (
        <Card>
          <CardHeader>
            <p className="text-sm font-semibold text-primary">1단계 · S02 상권 탐색</p>
            <CardTitle>진단할 위치와 업종을 골라요</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="demo-location">
                위치
              </label>
              <Input
                id="demo-location"
                value={`서울시 마포구 ${location} · 가상 점포`}
                readOnly
                className="h-12 text-base"
              />
              <p className="text-xs text-muted-foreground">실제 주소와 매장 데이터는 조회하지 않습니다.</p>
            </div>
            <div className="grid gap-2">
              <span className="text-sm font-medium">업종</span>
              <div className="flex flex-wrap gap-2" aria-label="선택한 업종">
                <span className="rounded-full bg-primary-soft px-4 py-2 text-sm font-semibold text-foreground">
                  카페
                </span>
                <span className="self-center text-xs text-muted-foreground">가상 시나리오</span>
              </div>
            </div>
            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium">동네 선택</legend>
              <div className="flex flex-wrap gap-2">
                {["공덕동", "연남동", "성수동"].map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant={location === option ? "default" : "outline"}
                    aria-pressed={location === option}
                    onClick={() => setLocation(option)}
                    className="min-h-11"
                  >
                    {option}
                  </Button>
                ))}
              </div>
            </fieldset>
            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium">탐색 반경</legend>
              <div className="flex flex-wrap gap-2">
                {["300m", "500m", "1km"].map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant={radius === option ? "default" : "outline"}
                    aria-pressed={radius === option}
                    onClick={() => setRadius(option)}
                    className="min-h-11 min-w-16"
                  >
                    {option}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                반경 선택만 시연하며 지도·매장 검색은 연결되지 않았습니다.
              </p>
            </fieldset>
            <div className="overflow-hidden rounded-2xl border border-border bg-secondary shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                <div>
                  <p className="text-sm font-bold">{location} 상권 미리보기</p>
                  <p className="text-xs text-muted-foreground">가상 지도 · 실제 매장 검색 없음</p>
                </div>
                <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary">
                  반경 {radius}
                </span>
              </div>
              <div
                className="relative aspect-[16/9] min-h-52 overflow-hidden bg-background"
                role="img"
                aria-label={`${location} 가상 지도와 ${radius} 탐색 범위`}
              >
                <svg
                  viewBox="0 0 640 300"
                  className="absolute inset-0 size-full"
                  aria-hidden="true"
                  preserveAspectRatio="xMidYMid slice"
                >
                  <path
                    d="M-20 55 660 245M-25 225 650 50M95-15l150 340M390-20 275 320M540-20 415 320"
                    className="text-border"
                    stroke="currentColor"
                    strokeWidth="18"
                    fill="none"
                  />
                  <path
                    d="M-20 55 660 245M-25 225 650 50M95-15l150 340M390-20 275 320M540-20 415 320"
                    className="text-card"
                    stroke="currentColor"
                    strokeWidth="11"
                    fill="none"
                  />
                  <circle
                    cx="320"
                    cy="150"
                    r={radius === "300m" ? 55 : radius === "1km" ? 108 : 82}
                    className="text-primary/15"
                    fill="currentColor"
                  />
                  <circle
                    cx="320"
                    cy="150"
                    r={radius === "300m" ? 55 : radius === "1km" ? 108 : 82}
                    className="text-primary"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray="7 6"
                  />
                  <circle cx="242" cy="105" r="7" className="text-accent-coral" fill="currentColor" />
                  <circle cx="403" cy="184" r="7" className="text-accent-coral" fill="currentColor" />
                  <circle cx="350" cy="89" r="7" className="text-accent-coral" fill="currentColor" />
                  <circle cx="320" cy="150" r="12" className="text-primary" fill="currentColor" />
                  <circle cx="320" cy="150" r="5" className="text-primary-foreground" fill="currentColor" />
                </svg>
                <div className="absolute bottom-3 left-3 rounded-xl border border-border bg-card/95 px-3 py-2 text-xs shadow-soft">
                  <p className="font-bold">가상 카페 자리</p>
                  <p className="text-muted-foreground">샘플 매장 핀 3개 · 실제 데이터 아님</p>
                </div>
              </div>
            </div>
            <Button type="button" onClick={() => moveTo("diagnosis")} className="min-h-12 w-full text-base">
              이 조건으로 진단하기
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "diagnosis" && (
        <Card>
          <CardHeader>
            <p className="text-sm font-semibold text-primary">2단계 · 손익 기준 입력</p>
            <CardTitle>예시 비용으로 손익분기 매출을 확인해요</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="rounded-xl bg-muted/60 p-4 text-sm">
              <p className="font-semibold">기획서 시연 예시</p>
              <p className="mt-1 text-muted-foreground">
                월세 250만원, 관리비 30만원, 인건비 300만원, 기타 고정비 120만원, 변동비율 40%
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="monthly-rent" label="월세" value={monthlyRent} onChange={setMonthlyRent} minimum={1} />
              <Field id="maintenance" label="관리비" value={maintenance} onChange={setMaintenance} />
              <Field id="payroll" label="월 인건비" value={payroll} onChange={setPayroll} />
              <Field id="other-fixed" label="기타 고정비" value={otherFixedCosts} onChange={setOtherFixedCosts} />
            </div>
            <div className="rounded-2xl bg-primary-soft p-4">
              <p className="text-sm font-medium">예시 조건의 손익분기 매출</p>
              <p className="mt-1 text-2xl font-bold">{formatTenThousandWon(beforeBreakEven)}</p>
              {beforeBreakEven === null ? (
                <p className="mt-1 text-xs font-medium text-destructive" role="alert">
                  비용을 확인해 주세요. 월세는 1원 이상, 나머지 비용은 0원 이상이어야 계산할 수 있습니다.
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  계산식: 고정비 합계 ÷ (1 − 변동비율). 매출 예측이나 생존 확률은 제공하지 않습니다.
                </p>
              )}
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <Button type="button" variant="outline" onClick={() => moveTo("explore")} className="min-h-11">
                이전
              </Button>
              <Button type="button" onClick={() => moveTo("contract")} className="min-h-11">
                계약 조건 확인하기
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "contract" && (
        <Card>
          <CardHeader>
            <p className="text-sm font-semibold text-primary">3단계 · 계약 조건 확인</p>
            <CardTitle>확인한 조건만 손익에 반영해요</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="rounded-xl border border-primary/30 bg-primary-soft/50 p-4 text-sm text-foreground">
              실제 파일 업로드·OCR 없이, 디자인 시안의 가상 계약 예시와 근거 문구를 보여 줍니다.
            </div>
            <div className="grid gap-2 rounded-2xl border border-border bg-secondary p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-sm font-semibold" htmlFor="contract-rent">
                  월세 · 가상 추출값
                </label>
                <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary">
                  예시 신뢰도 95% · 높음
                </span>
              </div>
              <Input
                id="contract-rent"
                type="number"
                min={1}
                aria-invalid={contractRent < 1}
                inputMode="numeric"
                value={contractRent}
                onChange={(event) => {
                  setContractRent(Number(event.target.value));
                  setRentConfirmed(false);
                }}
                className="h-12 text-base"
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                가상 원문 근거: “차임 월 금 삼백만원정(₩3,000,000), 부가가치세 별도”
              </p>
              {contractRent < 1 ? (
                <p className="text-xs font-medium text-destructive" role="alert">
                  월세는 1원 이상 입력해 주세요.
                </p>
              ) : null}
            </div>
            <div className="grid gap-2 rounded-2xl border border-border bg-secondary p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-sm font-semibold" htmlFor="contract-maintenance">
                  월 관리비 · 낮은 신뢰도
                </label>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">
                  예시 신뢰도 58% · 낮음
                </span>
              </div>
              <Input
                id="contract-maintenance"
                type="number"
                min={0}
                aria-invalid={contractMaintenance.trim() !== "" && Number(contractMaintenance) < 0}
                inputMode="numeric"
                value={contractMaintenance}
                placeholder="원문을 확인해 직접 입력"
                onChange={(event) => {
                  setContractMaintenance(event.target.value);
                  setMaintenanceConfirmed(false);
                }}
                className="h-12 text-base"
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                가상 원문 근거: “관리비는 월 금 3?만원으로 하되 임대인이 필요 시 조정할 수 있다”
              </p>
              {contractMaintenance.trim() !== "" && Number(contractMaintenance) < 0 ? (
                <p className="text-xs font-medium text-destructive" role="alert">
                  관리비는 0원 이상 입력해 주세요.
                </p>
              ) : null}
            </div>
            <label className="flex min-h-12 items-start gap-3 rounded-xl border border-border bg-card p-3 text-sm">
              <input
                type="checkbox"
                checked={rentConfirmed}
                disabled={contractRent < 1}
                onChange={(event) => setRentConfirmed(event.target.checked)}
                className="mt-1 size-5 accent-primary"
              />
              <span>월세 예시값 {formatWon(contractRent)}과 근거를 확인했습니다.</span>
            </label>
            <label className="flex min-h-12 items-start gap-3 rounded-xl border border-border p-3 text-sm">
              <input
                type="checkbox"
                checked={maintenanceConfirmed}
                disabled={contractMaintenance.trim() === "" || Number(contractMaintenance) < 0}
                onChange={(event) => setMaintenanceConfirmed(event.target.checked)}
                className="mt-1 size-5 accent-primary"
              />
              <span>
                {contractMaintenance.trim() === ""
                  ? "낮은 신뢰도 관리비는 원문 확인 후 직접 입력해야 반영할 수 있습니다."
                  : `관리비 예시값 ${formatWon(Number(contractMaintenance))}과 근거를 확인했습니다.`}
              </span>
            </label>
            <div className="rounded-xl bg-muted/60 p-4 text-sm">
              <p className="font-semibold">중도해지 · 원상복구</p>
              <p className="mt-1 text-muted-foreground">
                원문과 추출값이 없어 빈 상태로 둡니다. 이 프로토타입은 법률 판단을 하지 않습니다.
              </p>
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <Button type="button" variant="outline" onClick={() => moveTo("diagnosis")} className="min-h-11">
                이전
              </Button>
              <Button
                type="button"
                onClick={() => moveTo("result")}
                disabled={!rentConfirmed || !maintenanceConfirmed}
                className="min-h-11"
              >
                확인한 조건으로 비교하기
              </Button>
            </div>
            {!rentConfirmed || !maintenanceConfirmed ? (
              <p className="text-center text-xs text-muted-foreground">
                두 조건의 예시값을 확인하면 다음 단계로 갈 수 있습니다.
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}

      {step === "result" && (
        <Card>
          <CardHeader>
            <p className="text-sm font-semibold text-primary">4단계 · 계약 조건 반영 결과</p>
            <CardTitle>입력한 조건과 계약 예시를 비교해요</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border p-4">
                <p className="text-sm text-muted-foreground">입력 조건 손익분기</p>
                <p className="mt-1 text-2xl font-bold">{formatTenThousandWon(beforeBreakEven)}</p>
                <p className="mt-2 text-sm">월세 {formatWon(monthlyRent)}</p>
              </div>
              <div className="rounded-2xl border border-primary/40 bg-primary-soft p-4">
                <p className="text-sm text-muted-foreground">확인한 계약 조건 손익분기</p>
                <p className="mt-1 text-2xl font-bold">{formatTenThousandWon(afterBreakEven)}</p>
                <p className="mt-2 text-sm">월세 {formatWon(contractRent)}</p>
              </div>
            </div>
            <div className="rounded-xl bg-muted/60 p-4 text-sm">
              <p className="font-semibold">변경 내용</p>
              <p className="mt-1 text-muted-foreground">
                손익분기 매출 차이{" "}
                {formatTenThousandWon(
                  afterBreakEven !== null && beforeBreakEven !== null
                    ? Math.abs(afterBreakEven - beforeBreakEven)
                    : null,
                )}
                . 예상 월매출을 입력하지 않아 월손익과 예상 손실은 표시하지 않습니다.
              </p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="font-semibold">확인 질문 예시</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
                <li>월세와 관리비의 부가세 포함 여부를 확인해 주세요.</li>
                <li>중도 해지 조건과 원상복구 범위를 원문에서 확인해 주세요.</li>
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">질문 예시이며 법률 검토 결과가 아닙니다.</p>
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <Button type="button" variant="outline" onClick={() => moveTo("contract")} className="min-h-11">
                조건 수정
              </Button>
              <Button type="button" onClick={restart} className="min-h-11">
                시연 다시 하기
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-center text-xs text-muted-foreground">
        수치는 기획서의 가상 시나리오에서 가져왔습니다. 실제 데이터·API·모델 결과가 아닙니다.
      </p>
    </main>
  );
}
