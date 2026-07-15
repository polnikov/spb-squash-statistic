import * as React from "react";
import { SortHeaderButton } from "@/components/ui/sort-header";

/**
 * One table-header cell. Centralizes the `<th>` + optional sort-button wiring so
 * columns stop hand-rolling (and re-introducing centering bugs) each time.
 *
 * Layout is intentionally left to `className` (widths, sticky offsets, padding,
 * text-align vary per table), so migrating an existing header keeps its exact
 * markup. Pass `sort` to make the cell sortable; `arrowAbsolute` for narrow
 * columns (e.g. "#") where the reserved arrow slot skews a short label.
 */
export function Th({
  children,
  className,
  sort,
  buttonClassName = "inline-flex w-full",
  arrowAbsolute = false,
}: {
  children: React.ReactNode;
  className?: string;
  sort?: { label: string; active: boolean; direction: "asc" | "desc"; onSort: () => void };
  buttonClassName?: string;
  arrowAbsolute?: boolean;
}) {
  return (
    <th className={className}>
      {sort ? (
        <SortHeaderButton
          label={sort.label}
          active={sort.active}
          direction={sort.direction}
          onClick={sort.onSort}
          className={buttonClassName}
          arrowAbsolute={arrowAbsolute}
        />
      ) : (
        children
      )}
    </th>
  );
}
