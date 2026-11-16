import type { ReactNode } from "react"
import Icon from "./Icon"
export interface ButtonProps {
  children: ReactNode
  variant?: "primary" | "secondary" | "success" | "outline" | "ghost" | "danger"
  icon?: string
  className?: string
  disabled?: boolean
  onClick?: () => void
  type?: "button" | "submit"
  /** Id of the element that explains the button, e.g. why it is disabled. */
  describedBy?: string
}
export default function Button({
  children,
  variant = "primary",
  icon,
  className = "",
  disabled,
  onClick,
  type = "button",
  describedBy,
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`btn btn-${variant}${className ? ` ${className}` : ""}`}
      disabled={disabled}
      aria-describedby={describedBy}
      onClick={onClick}
    >
      {icon && <Icon name={icon} size={16} />} {children}
    </button>
  )
}
