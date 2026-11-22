import type { ReactNode } from "react"
interface BadgeProps {
  children: ReactNode
  tone?: "neutral" | "active" | "success" | "dark" | "light" | "danger"
}
export default function Badge({ children, tone = "neutral" }: BadgeProps) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}
