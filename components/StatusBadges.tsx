import { EXEC_MAP, REPORT_MAP, RESULT_MAP } from "@/lib/constants";
import type { Item } from "@/lib/types";

type StatusBadgesProps = {
  item: Pick<Item, "execStatus" | "resultStatus" | "reportStatus">;
};

export function StatusBadges({ item }: StatusBadgesProps) {
  const statuses = [
    { label: "การดำเนินการ", value: EXEC_MAP[item.execStatus] },
    { label: "ผลลัพธ์", value: RESULT_MAP[item.resultStatus] },
    { label: "รีพอร์ต", value: REPORT_MAP[item.reportStatus] },
  ];

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {statuses.map(({ label, value }) => (
        <span
          key={label}
          title={`${label}: ${value.label}`}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ring-black/5 ${value.badge}`}
        >
          <span
            className="size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: value.dot }}
            aria-hidden="true"
          />
          {value.label}
        </span>
      ))}
    </span>
  );
}
