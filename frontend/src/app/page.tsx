import { HealthStatus } from "@/components/health-status";
import { RuntimeBadge } from "@/components/runtime-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-16">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>AX Service</CardTitle>
          <RuntimeBadge />
        </CardHeader>
        <CardContent>
          <HealthStatus />
        </CardContent>
      </Card>
    </main>
  );
}
