import { useEffect, useRef } from "react"
import type { KeyboardEvent, ReactNode } from "react"

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface ModalProps {
  children: ReactNode
  className?: string
  /** Called on Escape; when omitted, Escape does nothing (legacy behavior). */
  onClose?: () => void
  /** Id of the element that names the dialog (usually its h2). */
  labelledBy?: string
}

/**
 * Modal dialog with `role="dialog"`, initial focus, Tab focus trap, and Escape to close.
 *
 * Focus returns to the previously focused element when the modal unmounts.
 */
export default function Modal({ children, className = "", onClose, labelledBy }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current
    const firstFocusable = dialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    firstFocusable?.focus()
    return () => {
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus()
      } else {
        dialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus()
      }
    }
  }, [])

  const trapKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && onClose) {
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== "Tab" || !dialogRef.current) return
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (!first || !last) return
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="modal-backdrop">
      <div
        ref={dialogRef}
        className={`modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onKeyDown={trapKeyboard}
      >
        {children}
      </div>
    </div>
  )
}
