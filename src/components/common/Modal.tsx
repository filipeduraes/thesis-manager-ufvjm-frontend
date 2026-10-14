import type { ReactNode } from "react"
interface ModalProps {
  children: ReactNode
  className?: string
}
export default function Modal({ children, className = "" }: ModalProps) {
  return (
    <div className="modal-backdrop">
      <div className={`modal ${className}`}>{children}</div>
    </div>
  )
}
