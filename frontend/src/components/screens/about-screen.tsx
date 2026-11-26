"use client";

import { Trash } from "lucide-react";
import { useState } from "react";

import { PageShell } from "@/components/screens/page-shell";
import { useStartup } from "@/components/screens/startup-provider";

/** S11 데이터·한계 화면 시안 */
export function AboutScreen() {
  const { resetAll } = useStartup();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");

  return (
    <PageShell>
      <div className="space-y-5">
        <div className="bg-white rounded-[24px] border border-border shadow-sm p-5 space-y-4">
          <span className="text-[13px] font-bold px-2 py-0.5 rounded-full bg-foreground text-white">
            S11 · 데이터 출처 및 한계
          </span>
          <h2 className="text-lg font-extrabold text-foreground">사용 데이터 · 계산식 · 주의사항</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-line text-left text-muted-foreground">
                  <th className="py-2 pr-3">데이터</th>
                  <th className="py-2 px-3">활용 화면</th>
                  <th className="py-2 pl-3">기준 / 한계</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted text-foreground">
                <tr>
                  <td className="py-2.5 pr-3 font-bold">서울시 음식점 인허가</td>
                  <td className="py-2.5 px-3">지도 매장, 반경 집계, 생존 라벨</td>
                  <td className="py-2.5 pl-3 text-ink-500">인허가 폐업 기준 (명의변경·이전과 실제 폐업 차이 존재)</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-3 font-bold">서울시 상권분석 (2026Q2)</td>
                  <td className="py-2.5 px-3">행정동 추정매출·유동인구·개폐업률</td>
                  <td className="py-2.5 pl-3 text-ink-500">행정동 단위 집계 — 반경 인허가와 단일 점수로 합산 불가</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-3 font-bold">임대차 계약서 OCR + AI</td>
                  <td className="py-2.5 px-3">S06~S08 조건 추출 및 특약 점검</td>
                  <td className="py-2.5 pl-3 text-ink-500">법률 자문 아님, 원본은 처리 종료 즉시 삭제</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div className="bg-white rounded-[24px] border border-border shadow-sm p-5 space-y-3">
          <h3 className="text-base font-extrabold text-foreground">세션 데이터 초기화</h3>
          <p className="text-xs text-ink-500">
            로그인 없이 현재 브라우저 세션에서만 동작합니다. 입력한 진단 값과 계약서 검토 내역을 즉시 비울 수 있습니다.
          </p>
          {confirming ? (
            <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-destructive-soft border border-destructive-line">
              <span className="text-xs font-bold text-destructive-700">
                모든 입력과 계약서 검토 내역을 초기화할까요?
              </span>
              <button
                type="button"
                onClick={() => {
                  resetAll();
                  setConfirming(false);
                  setMessage("현재 세션의 모든 데이터를 초기화했습니다.");
                }}
                className="px-3 py-1.5 rounded-lg bg-destructive text-white text-xs font-bold"
              >
                예, 초기화
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="px-3 py-1.5 rounded-lg bg-white border border-line-strong text-xs font-bold text-ink-600"
              >
                취소
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-destructive-line bg-destructive-soft text-xs font-extrabold text-destructive"
            >
              <Trash className="w-3.5 h-3.5" aria-hidden="true" />내 입력·계약서 데이터 모두 지우기
            </button>
          )}
          {message && <p className="text-xs font-bold text-success-500">{message}</p>}
        </div>
      </div>
    </PageShell>
  );
}
