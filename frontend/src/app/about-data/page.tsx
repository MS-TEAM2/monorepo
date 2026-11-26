import type { Metadata } from "next";

import { AboutDataView } from "@/components/about-data/about-data-view";
import { AccountSection } from "@/components/about-data/account-section";
import { DeleteMyData } from "@/components/about-data/delete-my-data";

export const metadata: Metadata = { title: "데이터·한계 안내" };

/** S11. 로그인 전에도 읽을 수 있고, 로그인하면 계정·삭제 영역이 함께 보인다 (기획서 S11) */
export default function Page() {
  return (
    <AboutDataView
      account={
        <div className="flex flex-col gap-3">
          <AccountSection />
          <DeleteMyData />
        </div>
      }
    />
  );
}
