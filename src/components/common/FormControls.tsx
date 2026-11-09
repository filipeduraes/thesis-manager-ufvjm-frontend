import type { ReactNode } from "react"
import Icon from "./Icon"

interface FieldProps {
  label: string
  placeholder?: string
  type?: string
  hint?: string
  value?: string
  onChange?: (value: string) => void
  name?: string
  required?: boolean
  disabled?: boolean
  maxLength?: number
  autoComplete?: string
}

export function Field({
  label,
  placeholder,
  type = "text",
  hint,
  value,
  onChange,
  name,
  required,
  disabled,
  maxLength,
  autoComplete,
}: FieldProps) {
  const controlled = typeof onChange === "function"
  return (
    <label className="field">
      <span>{label}</span>
      <div className="input-wrap">
        <input
          type={type}
          placeholder={placeholder}
          name={name}
          required={required}
          disabled={disabled}
          maxLength={maxLength}
          autoComplete={autoComplete}
          value={controlled ? value ?? "" : undefined}
          defaultValue={controlled ? undefined : value}
          onChange={controlled ? (event) => onChange(event.target.value) : undefined}
        />
        {type === "password" && <Icon name="search" size={15} />}
      </div>
      {hint && <small>{hint}</small>}
    </label>
  )
}

interface SelectOption {
  value: string
  label: string
}

interface SelectFieldProps {
  label: string
  children?: ReactNode
  options?: SelectOption[]
  value?: string
  onChange?: (value: string) => void
  name?: string
  placeholder?: string
  hint?: string
  required?: boolean
  disabled?: boolean
}

export function SelectField({
  label,
  children,
  options,
  value,
  onChange,
  name,
  placeholder,
  hint,
  required,
  disabled,
}: SelectFieldProps) {
  const controlled = typeof onChange === "function"
  return (
    <label className="field">
      <span>{label}</span>
      {options ? (
        <select
          name={name}
          required={required}
          disabled={disabled}
          value={controlled ? value ?? "" : undefined}
          defaultValue={controlled ? undefined : value}
          onChange={controlled ? (event) => onChange(event.target.value) : undefined}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option value={option.value} key={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <select
          name={name}
          required={required}
          disabled={disabled}
          value={controlled ? value ?? "" : undefined}
          defaultValue={controlled ? undefined : ""}
          onChange={controlled ? (event) => onChange(event.target.value) : undefined}
        >
          <option value="" disabled>
            {children}
          </option>
          <option>Engenharia de Sistemas</option>
          <option>Administração</option>
          <option>Ciências Biológicas</option>
        </select>
      )}
      {hint && <small>{hint}</small>}
    </label>
  )
}
