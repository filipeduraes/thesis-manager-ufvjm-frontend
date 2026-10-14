import type { ReactNode } from "react"
import Icon from "./Icon"
interface FieldProps {
  label: string
  placeholder?: string
  type?: string
  hint?: string
  value?: string
}
export function Field({
  label,
  placeholder,
  type = "text",
  hint,
  value,
}: FieldProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="input-wrap">
        <input type={type} placeholder={placeholder} defaultValue={value} />
        {type === "password" && <Icon name="search" size={15} />}
      </div>
      {hint && <small>{hint}</small>}
    </label>
  )
}
interface SelectFieldProps {
  label: string
  children: ReactNode
}
export function SelectField({ label, children }: SelectFieldProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <select defaultValue="">
        <option value="" disabled>
          {children}
        </option>
        <option>Engenharia de Sistemas</option>
        <option>Administração</option>
        <option>Ciências Biológicas</option>
      </select>
    </label>
  )
}
