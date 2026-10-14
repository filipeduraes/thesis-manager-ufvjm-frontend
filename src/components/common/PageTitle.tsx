import type { ReactNode } from "react"
interface PageTitleProps {
  eyebrow: string
  title: string
  subtitle?: string
  action?: ReactNode
}
export default function PageTitle({
  eyebrow,
  title,
  subtitle,
  action,
}: PageTitleProps) {
  return (
    <div className="page-title">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
