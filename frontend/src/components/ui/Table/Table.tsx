import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

export interface TableColumn<T> {
  key: string
  header: ReactNode
  accessor: (row: T) => ReactNode
  className?: string
  align?: 'left' | 'right' | 'center'
}

interface TableProps<T> {
  columns: TableColumn<T>[]
  data: T[]
  getRowKey: (row: T, index: number) => string
  emptyMessage?: string
  caption?: string
  compact?: boolean
  onRowClick?: (row: T) => void
}

export function Table<T>({
  columns,
  data,
  getRowKey,
  emptyMessage = 'Aucune donnée',
  caption,
  compact,
  onRowClick,
}: TableProps<T>) {
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full border-collapse text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-border bg-bg">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  'whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary',
                  col.align === 'right' && 'text-right',
                  col.align === 'center' && 'text-center',
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-text-tertiary">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, idx) => (
              <tr
                key={getRowKey(row, idx)}
                className={cn(
                  'border-b border-border/60 last:border-b-0',
                  idx % 2 === 1 && 'bg-[color:var(--altrow)]',
                  onRowClick && 'cursor-pointer hover:bg-[color:var(--ltblue)]',
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      compact ? 'px-3 py-1.5' : 'px-3 py-2.5',
                      'text-text-primary',
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center',
                      col.className,
                    )}
                  >
                    {col.accessor(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
