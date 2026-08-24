import * as React from "react";

/** Navigate bounded pages of a large record set, with page-size and range summary. */
export interface PaginationProps {
  page?: number;
  pageCount?: number;
  pageSize?: number;
  /** Total record count (shows "X–Y of N"). */
  total?: number;
  pageSizeOptions?: number[];
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  className?: string;
}
export function Pagination(props: PaginationProps): JSX.Element;
