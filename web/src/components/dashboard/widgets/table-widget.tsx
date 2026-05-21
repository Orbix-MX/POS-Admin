import type { WidgetDisplayConfig, WidgetMeta } from '@/services/core/dashboards-service'

interface TableColumn {
  key: string
  label: string
  type?: 'string' | 'currency' | 'number' | 'percent' | 'datetime' | 'date' | 'badge'
  align?: 'left' | 'center' | 'right'
}

interface BadgeValue {
  value: string
  label: string
  color: 'green' | 'yellow' | 'red' | 'blue' | 'gray'
}

interface TableData {
  columns: TableColumn[]
  rows: Record<string, unknown>[]
}

interface Props {
  data: TableData
  meta: WidgetMeta
  config: WidgetDisplayConfig
}

const BADGE_STYLES: Record<string, { bg: string; text: string }> = {
  green:  { bg: '#dcfce7', text: '#166534' },
  yellow: { bg: '#fef9c3', text: '#854d0e' },
  red:    { bg: '#fee2e2', text: '#991b1b' },
  blue:   { bg: '#dbeafe', text: '#1e40af' },
  gray:   { bg: '#f3f4f6', text: '#6b7280' },
}

function numericType(type?: string) {
  return type === 'currency' || type === 'number' || type === 'percent'
}

function CellValue({ value, col }: { value: unknown; col: TableColumn }) {
  if (value == null) return <span className="text-muted-foreground">—</span>

  switch (col.type) {
    case 'currency': {
      const n = Number(value)
      return (
        <span className="font-semibold">
          ${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
        </span>
      )
    }
    case 'percent':
      return <>{value}%</>
    case 'number':
      return <>{Number(value).toLocaleString('es-MX')}</>
    case 'datetime': {
      const d = new Date(String(value))
      return (
        <>
          {d.toLocaleDateString('es-MX', {
            day: '2-digit', month: '2-digit', year: '2-digit',
          })}{' '}
          <span className="text-muted-foreground">
            {d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </>
      )
    }
    case 'date': {
      const d = new Date(String(value))
      return <>{d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' })}</>
    }
    case 'badge': {
      const b = value as BadgeValue
      const s = BADGE_STYLES[b.color] ?? BADGE_STYLES.gray
      return (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
          style={{ background: s.bg, color: s.text }}
        >
          {b.label ?? b.value}
        </span>
      )
    }
    default:
      return <>{String(value)}</>
  }
}

export function TableWidget({ data, meta, config: _config }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="overflow-auto flex-1">
        <table className="w-full text-[12px] border-collapse">
          <thead className="sticky top-0 bg-card z-10">
            <tr className="border-b border-border">
              {data.columns.map(col => (
                <th
                  key={col.key}
                  className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                  style={{
                    textAlign: col.align ?? (numericType(col.type) ? 'right' : 'left'),
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, ri) => (
              <tr
                key={ri}
                className="border-b border-border hover:bg-muted/40 transition-colors"
              >
                {data.columns.map(col => (
                  <td
                    key={col.key}
                    className="px-3 py-2.5 text-foreground whitespace-nowrap"
                    style={{
                      textAlign: col.align ?? (numericType(col.type) ? 'right' : 'left'),
                    }}
                  >
                    <CellValue value={row[col.key]} col={col} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {meta.pagination && (
        <div className="px-3 py-2 text-[10px] text-muted-foreground border-t border-border shrink-0">
          Mostrando {data.rows.length} de {meta.pagination.total.toLocaleString('es-MX')} registros
        </div>
      )}
    </div>
  )
}
