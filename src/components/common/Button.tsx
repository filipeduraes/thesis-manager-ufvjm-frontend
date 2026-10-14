import type { ReactNode } from "react"
import Icon from "./Icon"
export interface ButtonProps {
  children: ReactNode
  variant?: "primary" | "secondary" | "success" | "outline" | "ghost" | "danger"
  icon?: string
  disabled?: boolean
  onClick?: () => void
  type?: "button" | "submit"
}
export default function Button({
  children,
  variant = "primary",
  icon,
  disabled,
  onClick,
  type = "button",
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`btn btn-${variant}`}
      disabled={disabled}
      onClick={onClick}
    >
      {icon && <Icon name={icon} size={16} />} {children}
    </button>
  )
}
