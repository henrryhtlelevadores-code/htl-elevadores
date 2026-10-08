"use client";

import * as React from "react";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type Header,
  type Row,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  X,
} from "lucide-react";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchPlaceholder?: string;
  searchKey?: string;
  extraActions?: React.ReactNode;
  hideSearch?: boolean;
  emptyState?: React.ReactNode;
  mobileCard?: (row: Row<TData>) => React.ReactNode;
}

const ACTION_COLUMN_IDS = new Set(["actions", "acciones"]);

/**
 * Card genérica para móvil cuando la vista no define `mobileCard`: la primera
 * columna es el título, el resto se lista como etiqueta/valor y la columna de
 * acciones va al pie. Reutiliza los renderers de celda de la tabla.
 */
function DefaultMobileCard<TData>({
  row,
  headers,
}: {
  row: Row<TData>;
  headers: Header<TData, unknown>[];
}) {
  const cells = row.getVisibleCells();
  const actionCell = cells.find((cell) => ACTION_COLUMN_IDS.has(cell.column.id));
  const [titleCell, ...detailCells] = cells.filter((cell) => cell !== actionCell);

  function renderLabel(columnId: string) {
    const header = headers.find((h) => h.column.id === columnId);
    if (!header) return null;
    const def = header.column.columnDef.header;
    if (typeof def === "string") return def;
    // Los headers con botón de orden se muestran solo como texto.
    return (
      <span className="pointer-events-none [&_button]:h-auto [&_button]:p-0 [&_button]:text-xs [&_button]:font-normal [&_svg]:hidden">
        {flexRender(def, header.getContext()) as React.ReactNode}
      </span>
    );
  }

  return (
    <article className="min-w-0 overflow-hidden rounded-xl border border-border bg-card p-4 shadow-xs">
      {titleCell && (
        <div className="min-w-0 text-sm font-semibold">
          {flexRender(titleCell.column.columnDef.cell, titleCell.getContext())}
        </div>
      )}
      {detailCells.length > 0 && (
        <dl className="mt-3 space-y-2 border-t border-border pt-3">
          {detailCells.map((cell) => (
            <div key={cell.id} className="flex items-start justify-between gap-3 text-xs">
              <dt className="shrink-0 text-muted-foreground">{renderLabel(cell.column.id)}</dt>
              <dd className="flex min-w-0 justify-end text-right">
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {actionCell && (
        <div className="mt-3 border-t border-border pt-3">
          {flexRender(actionCell.column.columnDef.cell, actionCell.getContext())}
        </div>
      )}
    </article>
  );
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = "Buscar registros...",
  searchKey,
  extraActions,
  hideSearch = false,
  emptyState,
  mobileCard,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = React.useState<string>("");
  const [rowSelection, setRowSelection] = React.useState({});

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      rowSelection,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  return (
    <div className="space-y-4">
      {/* Top Controls: Search & Extra Actions */}
      {(!hideSearch || extraActions) && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {!hideSearch && (
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={
                  searchKey
                    ? (table.getColumn(searchKey)?.getFilterValue() as string) ?? ""
                    : globalFilter ?? ""
                }
                onChange={(e) => {
                  if (searchKey) {
                    table.getColumn(searchKey)?.setFilterValue(e.target.value);
                  } else {
                    setGlobalFilter(e.target.value);
                  }
                }}
                className="pl-9 pr-8 bg-card border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
              />
              {Boolean(globalFilter || (searchKey && table.getColumn(searchKey)?.getFilterValue())) && (
                <button
                  onClick={() => {
                    if (searchKey) {
                      table.getColumn(searchKey)?.setFilterValue("");
                    } else {
                      setGlobalFilter("");
                    }
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          )}

          {extraActions && (
            <div className="flex items-center gap-2 shrink-0">{extraActions}</div>
          )}
        </div>
      )}

      {/* Table Container */}
      <div className="grid gap-3 lg:hidden">
        {table.getRowModel().rows.length > 0 ? (
          table.getRowModel().rows.map((row) => (
            <React.Fragment key={row.id}>
              {mobileCard ? mobileCard(row) : <DefaultMobileCard row={row} headers={table.getFlatHeaders()} />}
            </React.Fragment>
          ))
        ) : (
          emptyState ?? (
            <div className="rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center text-xs text-muted-foreground">
              No se encontraron registros.
            </div>
          )
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-border bg-card shadow-xs lg:block">
        <Table className="min-w-[1200px]">
          <TableHeader className="bg-muted/50 border-b border-border">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-border hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                       className={`select-none py-3 text-xs font-semibold text-muted-foreground ${header.column.id === "quotationNumber" ? "sticky left-0 z-20 w-[120px] min-w-[120px] bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.12)] dark:bg-gray-900" : header.column.id === "client_name" ? "sticky left-[120px] z-20 w-[180px] min-w-[180px] bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.12)] dark:bg-gray-900" : header.column.id === "actions" ? "sticky right-0 z-20 bg-white dark:bg-gray-900" : ""}`}
                      style={{ width: header.column.getSize() }}
                    >
                      {header.isPlaceholder
                        ? null
                        : (flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          ) as React.ReactNode)}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="border-border hover:bg-muted/40 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                       className={`py-2.5 text-xs ${cell.column.id === "quotationNumber" ? "sticky left-0 z-10 w-[120px] min-w-[120px] bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.12)] dark:bg-gray-900" : cell.column.id === "client_name" ? "sticky left-[120px] z-10 w-[180px] min-w-[180px] bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.12)] dark:bg-gray-900" : cell.column.id === "actions" ? "sticky right-0 z-10 bg-white dark:bg-gray-900" : ""}`}
                      style={{ width: cell.column.getSize() }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="border-border">
                <TableCell
                  colSpan={columns.length}
                  className={emptyState ? "p-0" : "h-32 text-center text-xs text-muted-foreground"}
                >
                  {emptyState ?? "No se encontraron registros."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-1 py-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Mostrando</span>
          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => {
              table.setPageSize(Number(e.target.value));
            }}
            className="h-8 rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground focus:ring-1 focus:ring-[#0066CC] focus:outline-none"
          >
            {[5, 10, 20, 50].map((size) => (
              <option key={size} value={size}>
                {size} filas
              </option>
            ))}
          </select>
          <span>de {table.getFilteredRowModel().rows.length} registros</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">
            Página {table.getState().pagination.pageIndex + 1} de{" "}
            {Math.max(1, table.getPageCount())}
          </span>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-xs"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              className="size-8 border-border hover:bg-muted disabled:opacity-40"
              title="Primera página"
            >
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-xs"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="size-8 border-border hover:bg-muted disabled:opacity-40"
              title="Página anterior"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-xs"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="size-8 border-border hover:bg-muted disabled:opacity-40"
              title="Página siguiente"
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-xs"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
              className="size-8 border-border hover:bg-muted disabled:opacity-40"
              title="Última página"
            >
              <ChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
