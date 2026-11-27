"use client";

import {
  BookOpen,
  Calculator,
  ChevronRight,
  Compass,
  FileText,
  MapPin,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import type { ScreenName } from "@/components/screens/use-go-screen";
import { CATEGORIES, NEIGHBORHOODS, RADIUS_OPTIONS } from "@/lib/mock/startup/data";
import type { Category, Neighborhood, RadiusM } from "@/lib/mock/startup/types";
type EntryModalProps = {
  open: boolean;
  onClose: () => void;
  neighborhood: Neighborhood;
  onSelectNeighborhood: (neighborhood: Neighborhood) => void;
  category: Category;
  onSelectCategory: (category: Category) => void;
  radiusM: RadiusM;
  onSelectRadius: (radius: RadiusM) => void;
  onNavigate: (screen: ScreenName) => void;
  hasReport: boolean;
  hasContractApplied: boolean;
};
type Feature = {
  id: ScreenName;
  badge: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  accent: string;
  highlight?: boolean;
  actionLabel: string;
};

/** 첫 화면의 시작 선택 창 (S01 역할). 관심 상권·업종·반경을 고르고 기능으로 이동한다 */
export function EntryModal({
  open,
  onClose,
  neighborhood,
  onSelectNeighborhood,
  category,
  onSelectCategory,
  radiusM,
  onSelectRadius,
  onNavigate,
  hasReport,
  hasContractApplied,
}: EntryModalProps) {
  if (!open) return null;
  const features: Feature[] = [
    {
      id: "map",
      badge: "S02 · S03",
      title: "전체 지도에서 상권 탐색",
      desc: "선택한 동네·반경의 영업/폐업 매장과 행정동 유동·추정매출 확인",
      icon: Compass,
      accent: "from-background to-primary-soft border-brand-300 text-primary",
      actionLabel: "지도 바로 보기",
    },
    {
      id: "diagnose",
      badge: "S04 · S05",
      title: "생존확률 · 월세 손익 진단",
      desc: "1·2·3년 생존추정과 실시간 월세 슬라이더·중도종료 손실 계산",
      icon: Calculator,
      accent: "from-background to-white border-line-warm text-brand",
      actionLabel: hasReport ? "진단 결과 이어보기" : "이 자리 진단하기",
    },
    {
      id: "contract",
      badge: "S06~S08 · 핵심",
      title: "임대차 계약서 검토 · 손익 반영",
      desc: "계약서 OCR 추출, 숨은 인상률·위약금·특약 점검 및 손익 전후 비교",
      icon: FileText,
      accent: "from-brand to-primary border-brand text-white",
      highlight: true,
      actionLabel: hasContractApplied ? "반영 결과 보기" : "계약서 검토하기",
    },
    {
      id: "guide",
      badge: "S12 · 가이드",
      title: "외식업 창업 체크리스트",
      desc: "업종·영업조건별 인허가·위생교육·소방·세무 필수 절차 안내",
      icon: BookOpen,
      accent: "from-muted to-white border-input text-ink-600",
      actionLabel: "체크리스트 열기",
    },
  ];
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/55 backdrop-blur-[3px] p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="영역 및 기능 선택 모달"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-secondary rounded-t-[28px] sm:rounded-[28px] border border-border shadow-lifted"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-gradient-to-r from-brand to-brand-light text-white px-5 py-4 sm:px-6 sm:py-5 flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-[13px] font-bold mb-1.5">
              <span>서울 외식 9종</span>
              <span>·</span>
              <span>로그인 없음</span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold tracking-tight">
              계약서 도장 찍기 전, 어디서 시작할까요?
            </h2>
            <p className="text-xs text-white/80 mt-1">
              상권 영역을 먼저 고른 뒤, 원하는 핵심 기능으로 바로 이동할 수 있어요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="모달 닫고 지도 보기"
            className="p-2 rounded-full bg-white/15 hover:bg-white/25 text-white transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 sm:p-6 space-y-5">
          <div className="bg-white rounded-2xl border border-border p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-brand" />
                1. 관심 상권 · 업종 · 반경 선택
              </span>
              <span className="text-[13px] font-bold text-brand">
                {neighborhood.shortName} · {category.label} · {radiusM >= 1000 ? "1km" : `${radiusM}m`}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {NEIGHBORHOODS.map((e) => {
                const s = e.dongCode === neighborhood.dongCode;
                return (
                  <button
                    type="button"
                    onClick={() => onSelectNeighborhood(e)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${s ? "bg-foreground text-white border-foreground" : "bg-secondary text-ink-600 border-input hover:border-brand-light"}`}
                    key={e.dongCode}
                  >
                    {e.name}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((e) => {
                const s = e.id === category.id;
                return (
                  <button
                    type="button"
                    onClick={() => onSelectCategory(e)}
                    className={`px-2.5 py-1 rounded-full text-xs font-bold border transition ${s ? "bg-brand-light text-white border-brand-light" : "bg-white text-ink-600 border-input hover:bg-background"}`}
                    key={e.id}
                  >
                    {e.label}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-background border border-brand-200">
              {RADIUS_OPTIONS.map((e) => (
                <button
                  type="button"
                  onClick={() => onSelectRadius(e.value)}
                  className={`py-1.5 rounded-lg text-xs font-extrabold tabular-nums transition ${radiusM === e.value ? "bg-brand text-white shadow-sm" : "text-ink-600 hover:bg-primary-soft"}`}
                  key={e.value}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-extrabold text-foreground mb-2.5 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-brand" />
              2. 바로 이동할 기능 선택
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {features.map((e) => {
                const Icon = e.icon;
                return (
                  <button
                    type="button"
                    onClick={() => {
                      onNavigate(e.id);
                      onClose();
                    }}
                    className={`text-left p-4 rounded-2xl border bg-gradient-to-br transition-all hover:scale-[1.01] active:scale-[0.99] shadow-sm flex flex-col justify-between gap-3 ${e.accent}`}
                    key={e.id}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[12px] font-extrabold ${e.highlight ? "bg-white/20 text-white" : "bg-primary-soft text-primary"}`}
                        >
                          {e.badge}
                        </span>
                        <Icon className={`w-5 h-5 ${e.highlight ? "text-white" : "text-brand"}`} />
                      </div>
                      <h3 className={`mt-2 text-sm font-extrabold ${e.highlight ? "text-white" : "text-foreground"}`}>
                        {e.title}
                      </h3>
                      <p
                        className={`mt-1 text-[14px] leading-relaxed ${e.highlight ? "text-white/80" : "text-ink-500"}`}
                      >
                        {e.desc}
                      </p>
                    </div>
                    <div
                      className={`inline-flex items-center gap-1 text-xs font-extrabold ${e.highlight ? "text-white" : "text-brand"}`}
                    >
                      {e.actionLabel}
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center justify-between pt-1 text-[13px] text-ink-400">
            <span>배경 지도는 언제든 클릭해 중심 핀을 옮길 수 있습니다.</span>
            <button
              type="button"
              onClick={() => {
                onNavigate("about");
                onClose();
              }}
              className="font-bold text-ink-600 hover:text-brand underline"
            >
              데이터·한계 보기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
