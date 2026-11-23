import { CATEGORY_COLORS } from "../../data/auditCategories"

interface CategoryChipProps {
  category?: string
  label?: string
}

export default function CategoryChip({ category, label }: CategoryChipProps) {
  const background = CATEGORY_COLORS[(category ?? "").toLowerCase()] ?? "var(--line)"
  return (
    <span style={{ background, color: "#fff", padding: "2px 8px", borderRadius: 999, fontWeight: 700, fontSize: 12 }}>
      {label ?? category ?? "—"}
    </span>
  )
}
