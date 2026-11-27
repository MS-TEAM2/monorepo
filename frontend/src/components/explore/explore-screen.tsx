"use client";

import { useSyncExternalStore } from "react";

import { ExploreView } from "@/components/explore/explore-view";
import { parseExploreQuery } from "@/lib/explore";

const noSubscribe = () => () => {};

/**
 * 주소의 선택값(exploreHref)으로 탐색 화면을 연다. 정적 HTML 은 기본값으로 그리고,
 * 브라우저에서 쿼리를 읽으면 그 값으로 다시 시작한다(key 로 상태를 새로 만든다).
 */
export function ExploreScreen() {
  const search = useSyncExternalStore(
    noSubscribe,
    () => window.location.search,
    () => "",
  );
  return <ExploreView key={search} initial={parseExploreQuery(new URLSearchParams(search))} />;
}
