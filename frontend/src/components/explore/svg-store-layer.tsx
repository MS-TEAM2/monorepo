import type { MapPoint } from "@/components/explore/map-canvas";
import { MAP_SPAN_M, MAP_VIEW } from "@/components/explore/map-canvas";
import type { StoreItem } from "@/lib/api/stores";
import { categoryLabel } from "@/lib/categories";
import { clusterPoints } from "@/lib/cluster";
import { latLngToOffset } from "@/lib/explore";

/** 임시 지도(MapCanvas) 위의 매장 핀과 묶음. 네이버지도가 없을 때만 쓴다 */
export function SvgStoreLayer({
  center,
  stores,
  onSelectStore,
}: {
  center: MapPoint;
  stores: readonly StoreItem[];
  onSelectStore: (store: StoreItem) => void;
}) {
  const unitsPerMeter = MAP_VIEW / MAP_SPAN_M;
  const points = stores.map((store) => {
    const { dxM, dyM } = latLngToOffset(center, store);
    return { x: dxM * unitsPerMeter, y: dyM * unitsPerMeter, item: store };
  });
  // 화면 폭 1000 단위 중 56 단위 칸으로 묶는다 (네이버지도의 56px 칸과 비슷한 밀도)
  const clusters = clusterPoints(points, 56);

  return (
    <g>
      {clusters.map((cluster) => {
        const first = cluster.items[0]!;
        if (cluster.items.length === 1) {
          return (
            <circle
              key={first.id}
              cx={cluster.x}
              cy={cluster.y}
              r="9"
              className="cursor-pointer fill-coral stroke-card"
              strokeWidth="3"
              onClick={() => onSelectStore(first)}
            >
              <title>{`${first.name ?? "이름 없음"} · ${categoryLabel(first.category_id)}`}</title>
            </circle>
          );
        }
        const r = cluster.items.length >= 100 ? 26 : cluster.items.length >= 10 ? 21 : 17;
        return (
          <g key={`${first.id}-c`} aria-hidden="true">
            <circle cx={cluster.x} cy={cluster.y} r={r} className="fill-primary stroke-card" strokeWidth="3" />
            <text
              x={cluster.x}
              y={cluster.y}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-primary-foreground text-[22px] font-bold"
            >
              {cluster.items.length}
            </text>
          </g>
        );
      })}
    </g>
  );
}
