/** Números de página exibidos na paginação administrativa. */
export function pageNumbers(current: number, total: number): number[] {
  const pages: number[] = []
  const start = Math.max(1, current - 2)
  const end = Math.min(total, start + 4)
  for (let page = Math.max(1, end - 4); page <= end; page += 1) pages.push(page)
  return pages
}
