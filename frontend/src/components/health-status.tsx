"use client";

import { useEffect, useState } from "react";

import { getHealth } from "@/lib/api/client";
import { statusText, type HealthState } from "@/lib/health";

export function HealthStatus() {
  const [state, setState] = useState<HealthState>({ kind: "loading" });

  useEffect(() => {
    getHealth()
      .then((health) => setState({ kind: "ok", health }))
      .catch((error: Error) => setState({ kind: "error", message: error.message }));
  }, []);

  return (
    <p role="status" className="text-muted-foreground">
      {statusText(state)}
    </p>
  );
}
