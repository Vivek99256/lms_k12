"use client";

import { LoaderCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ClassFilters,
  type ClassSelection,
} from "@/components/erp/ClassFilters";
import { ErpSection } from "@/components/erp/erp-ui";
import type { ClassOptions } from "@/lib/class-options";

/**
 * Filter form shared by Delete consent master and Consent report — the two
 * Laravel controllers accept the identical grade/standard/division + date range
 * parameter set.
 */
export function ConsentFilterForm({
  idPrefix,
  classOptions,
  selection,
  onSelectionChange,
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  onSubmit,
  loading,
}: {
  idPrefix: string;
  classOptions: ClassOptions;
  selection: ClassSelection;
  onSelectionChange: (next: ClassSelection) => void;
  fromDate: string;
  toDate: string;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  loading: boolean;
}) {
  return (
    <form onSubmit={onSubmit}>
      <ErpSection
        title="Filters"
        description="The date range is applied only when both bounds are set. Leave a class filter blank to widen the search."
        icon={<Search className="size-5" />}
        footer={
          <Button type="submit" disabled={loading}>
            {loading ? <LoaderCircle className="size-4 animate-spin" /> : <Search className="size-4" />}
            {loading ? "Searching…" : "Search"}
          </Button>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          <ClassFilters
            idPrefix={idPrefix}
            options={classOptions}
            value={selection}
            onChange={onSelectionChange}
            required={false}
          />
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-from`}>From date</Label>
            <Input
              id={`${idPrefix}-from`}
              type="date"
              value={fromDate}
              onChange={(event) => onFromDateChange(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-to`}>To date</Label>
            <Input
              id={`${idPrefix}-to`}
              type="date"
              value={toDate}
              onChange={(event) => onToDateChange(event.target.value)}
            />
          </div>
        </div>
      </ErpSection>
    </form>
  );
}
