"use client";

import { useState } from "react";
import { FieldDayClients } from "@/components/bos/FieldDayClients";
import { FieldDayMap, type FieldMapPin } from "@/components/bos/FieldDayMap";
import type { FieldJob } from "@/lib/field/days";

type Props = {
  jobs: FieldJob[];
  pins: FieldMapPin[];
};

export function FieldDayBoard({ jobs, pins }: Props) {
  const [focusId, setFocusId] = useState<string | null>(null);

  return (
    <div className="field-day-board">
      <div className="field-day-board__clients">
        <FieldDayClients jobs={jobs} onHoverJob={setFocusId} />
      </div>
      <FieldDayMap pins={pins} focusId={focusId} />
    </div>
  );
}
