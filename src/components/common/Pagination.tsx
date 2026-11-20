import Icon from "./Icon"

interface PaginationProps {
  page?: number
  totalPages?: number
  onPageChange?: (page: number) => void
  disabled?: boolean
}

function pageItems(page: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }
  const items: Array<number | "ellipsis"> = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(totalPages - 1, page + 1)
  if (start > 2) items.push("ellipsis")
  for (let current = start; current <= end; current += 1) items.push(current)
  if (end < totalPages - 1) items.push("ellipsis")
  items.push(totalPages)
  return items
}

export default function Pagination({ page, totalPages, onPageChange, disabled }: PaginationProps = {}) {
  if (typeof page === "number" && typeof totalPages === "number" && onPageChange) {
    if (totalPages <= 1) return null
    return (
      <nav className="pagination" aria-label="Paginação">
        <button
          type="button"
          aria-label="Página anterior"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <Icon name="arrow" size={15} />
        </button>
        {pageItems(page, totalPages).map((item, index) =>
          item === "ellipsis" ? (
            <span key={`ellipsis-${index}`} aria-hidden="true">…</span>
          ) : (
            <button
              type="button"
              key={item}
              className={item === page ? "active" : ""}
              aria-label={`Página ${item}`}
              aria-current={item === page ? "page" : undefined}
              disabled={disabled}
              onClick={() => onPageChange(item)}
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          aria-label="Próxima página"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <Icon name="arrow" size={15} />
        </button>
      </nav>
    )
  }

  return (
    <div className="pagination">
      <button type="button">
        <Icon name="arrow" size={15} />
      </button>
      <button type="button" className="active">
        1
      </button>
      <button type="button">2</button>
      <button type="button">3</button>
      <span>…</span>
      <button type="button">12</button>
      <button type="button">
        <Icon name="arrow" size={15} />
      </button>
    </div>
  )
}
