import { ExploreScreen } from "@/components/screens/app-screens";

/** S01 홈. 화면 시안대로 상권 지도 위에 시작 선택 창(동네·업종·반경, 바로 이동할 기능)을 띄운다. */
export default function HomePage() {
  return <ExploreScreen withEntryModal />;
}
