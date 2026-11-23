import { useId, useState } from "react"
import type { UserSuggestion } from "../../api/client"
import Icon from "./Icon"
import UserSuggestInput from "./UserSuggestInput"

export interface CoauthorPickerProps {
  value: UserSuggestion[]
  onChange: (value: UserSuggestion[]) => void
  maxAuthors: number
  disabled?: boolean
}

/**
 * Picker for the other students in a thesis group (the requester is the main author).
 */
export default function CoauthorPicker({ value, onChange, maxAuthors, disabled = false }: CoauthorPickerProps) {
  const id = useId()
  const [query, setQuery] = useState("")
  const maxCoauthors = Math.max(0, maxAuthors - 1)
  const full = value.length >= maxCoauthors

  function add(user: UserSuggestion) {
    if (disabled || full || value.some((item) => item.id === user.id)) return
    onChange([...value, user])
    setQuery("")
  }

  function remove(userId: string) {
    if (disabled) return
    onChange(value.filter((item) => item.id !== userId))
  }

  return (
    <div className="coauthor-picker">
      <label className="field" htmlFor={`${id}-input`}>
        <span>Coautores</span>
        <small className="field-hint">
          Grupo de até {maxAuthors} alunos, incluindo você. {value.length}/{maxCoauthors} coautores selecionados.
        </small>
      </label>
      {!full && !disabled && (
        <div className="coauthor-picker-input">
          <UserSuggestInput
            id={`${id}-input`}
            value={query}
            onChange={setQuery}
            onSelect={add}
            role="STUDENT"
            placeholder="Nome ou e-mail do colega"
          />
        </div>
      )}
      {value.length > 0 && (
        <ul className="coauthor-list">
          {value.map((user) => (
            <li key={user.id}>
              <span>{user.name}</span>
              <small>{user.email}</small>
              {!disabled && (
                <button type="button" className="icon-button" aria-label={`Remover ${user.name}`} onClick={() => remove(user.id)}>
                  <Icon name="close" size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
