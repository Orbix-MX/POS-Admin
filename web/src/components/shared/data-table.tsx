import { MoreHorizontal, ChevronLeft, ChevronRight } from 'lucide-react'

export interface Column<T> {
  label: string
  key?: keyof T
  align?: 'left' | 'center' | 'right'
  render?: (row: T) => React.ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  onRowClick?: (row: T) => void
}

export function DataTable<T>({ columns, rows, onRowClick }: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col, i) => (
              <th
                key={i}
                className="px-3.5 py-2.5 font-semibold text-[11px] text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                style={{ textAlign: col.align || 'left' }}
              >
                {col.label}
              </th>
            ))}
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              onClick={() => onRowClick?.(row)}
              className={`border-b border-border transition-colors hover:bg-muted/50 ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              {columns.map((col, ci) => (
                <td
                  key={ci}
                  className="px-3.5 py-3 text-foreground whitespace-nowrap"
                  style={{ textAlign: col.align || 'left' }}
                >
                  {col.render ? col.render(row) : (col.key ? String(row[col.key]) : '')}
                </td>
              ))}
              <td className="px-2 py-3 text-right">
                <button className="text-muted-foreground bg-transparent border-none cursor-pointer p-1 rounded hover:text-foreground">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface PaginationProps {
  page: number
  total: number
  perPage?: number
  onChange: (page: number) => void
}

export function Pagination({ page, total, perPage = 8, onChange }: PaginationProps) {
  const pages = Math.ceil(total / perPage)
  return (
    <div className="flex items-center justify-end gap-1.5 px-4 py-3 border-t border-border">
      <button
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="px-3 py-1.5 border border-border rounded-md bg-card text-xs cursor-pointer text-muted-foreground disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
      >
        <ChevronLeft className="w-3 h-3" /> Anterior
      </button>
      {Array.from({ length: Math.min(pages, 5) }, (_, i) => i + 1).map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`w-[30px] h-[30px] border rounded-md text-xs cursor-pointer font-medium
            ${p === page
              ? 'border-primary bg-primary text-primary-foreground font-semibold'
              : 'border-border bg-card text-muted-foreground'
            }`}
        >
          {p}
        </button>
      ))}
      <button
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
        className="px-3 py-1.5 border border-border rounded-md bg-card text-xs cursor-pointer text-muted-foreground disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
      >
        Siguiente <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  )
}
