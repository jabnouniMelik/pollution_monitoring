import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../Button/Button'
import { Select } from '../Select/Select'

interface PaginationProps {
  currentPage: number
  totalPages: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  pageSizeOptions?: number[]
}

export function Pagination({
  currentPage,
  totalPages,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
}: PaginationProps) {
  const startItem = total === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, total)

  const canGoPrevious = currentPage > 1
  const canGoNext = currentPage < totalPages

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
      {/* Info */}
      <div className="text-text-secondary">
        Affichage de <span className="font-medium text-text-primary">{startItem}</span> à{' '}
        <span className="font-medium text-text-primary">{endItem}</span> sur{' '}
        <span className="font-medium text-text-primary">{total}</span> résultat{total > 1 ? 's' : ''}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {/* Page size selector */}
        <div className="flex items-center gap-2">
          <span className="text-text-secondary whitespace-nowrap">Par page :</span>
          <Select
            value={String(pageSize)}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            options={pageSizeOptions.map((size) => ({
              value: String(size),
              label: String(size),
            }))}
            className="w-20"
          />
        </div>

        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={!canGoPrevious}
            leftIcon={<ChevronLeft className="h-4 w-4" />}
            aria-label="Page précédente"
          >
            Précédent
          </Button>

          <div className="px-3 py-1 text-sm font-medium text-text-primary">
            Page {currentPage} / {totalPages || 1}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!canGoNext}
            rightIcon={<ChevronRight className="h-4 w-4" />}
            aria-label="Page suivante"
          >
            Suivant
          </Button>
        </div>
      </div>
    </div>
  )
}
