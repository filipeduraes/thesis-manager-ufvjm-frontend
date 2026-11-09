import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import Icon from "./Icon"

export interface RoleMultiSelectOption {
  value: string
  label: string
}

interface RoleMultiSelectProps {
  options: RoleMultiSelectOption[]
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  disabled?: boolean
  ariaLabel?: string
}

const EXCLUSIVE_ROLE_VALUES = new Set(["STUDENT", "Aluno"])

function isExclusive(value: string): boolean {
  return EXCLUSIVE_ROLE_VALUES.has(value)
}

function toggleRoleValue(current: string[], value: string): string[] {
  if (isExclusive(value)) {
    return current.includes(value) ? [] : [value]
  }
  const withoutExclusive = current.filter((item) => !isExclusive(item))
  if (withoutExclusive.includes(value)) {
    return withoutExclusive.filter((item) => item !== value)
  }
  return [...withoutExclusive, value]
}

/**
 * Dropdown com checkboxes para seleção de papéis.
 * O papel Aluno é exclusivo e não pode ser combinado com outros.
 */
export default function RoleMultiSelect({
  options,
  value,
  onChange,
  placeholder = "Selecionar papéis…",
  disabled = false,
  ariaLabel,
}: RoleMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const updatePanelPosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const panelHeight = Math.min(220, options.length * 42 + 12)
    const openUp = spaceBelow < panelHeight && rect.top > spaceBelow
    setPanelStyle({
      top: openUp ? Math.max(8, rect.top - panelHeight - 4) : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    })
  }, [options.length])

  useLayoutEffect(() => {
    if (!open) return
    updatePanelPosition()
  }, [open, updatePanelPosition])

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    const handleReposition = () => updatePanelPosition()
    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    window.addEventListener("resize", handleReposition)
    window.addEventListener("scroll", handleReposition, true)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("resize", handleReposition)
      window.removeEventListener("scroll", handleReposition, true)
    }
  }, [open, updatePanelPosition])

  useEffect(() => {
    if (disabled && open) setOpen(false)
  }, [disabled, open])

  const selectedLabels = options
    .filter((option) => value.includes(option.value))
    .map((option) => option.label)
  const triggerLabel = selectedLabels.length > 0 ? selectedLabels.join(", ") : placeholder

  return (
    <div
      className={`role-multiselect ${open ? "open" : ""} ${disabled ? "disabled" : ""}`}
      ref={rootRef}
    >
      <button
        ref={triggerRef}
        type="button"
        className="role-multiselect-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={selectedLabels.length === 0 ? "placeholder" : ""}>
          {triggerLabel}
        </span>
        <Icon name="arrow" size={14} />
      </button>
      {open && panelStyle && (
        <div
          ref={panelRef}
          className="role-multiselect-panel"
          role="listbox"
          aria-multiselectable="true"
          aria-label={ariaLabel}
          style={{
            position: "fixed",
            top: panelStyle.top,
            left: panelStyle.left,
            width: panelStyle.width,
            right: "auto",
          }}
        >
          {options.map((option) => {
            const checked = value.includes(option.value)
            return (
              <label key={option.value} className="role-multiselect-option">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onChange(toggleRoleValue(value, option.value))}
                />
                <span>{option.label}</span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

export { toggleRoleValue }
