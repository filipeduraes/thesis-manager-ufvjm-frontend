import { Button, Field, SelectField, UserFoundCard, UserSuggestInput } from "../../components/common"
import type { RepositoryCoursesState } from "../../hooks/useRepositoryCourses"
import {
  REPOSITORY_MAX_AUTHORS,
  THESIS_TYPE_OPTIONS,
  newAuthorDraft,
  personFromSuggestion,
  type RepositoryAuthorDraft,
  type RepositoryMetadataDraft,
  type RepositoryThesisType,
} from "./repositoryForm"

interface RepositoryMetadataFieldsProps {
  idPrefix: string
  draft: RepositoryMetadataDraft
  onChange: (draft: RepositoryMetadataDraft) => void
  courses: RepositoryCoursesState
  disabled?: boolean
}

/**
 * Bibliographic fields shared by the legacy registration and the published edit.
 *
 * Authors are typed by name or linked to an existing user through the autocomplete;
 * the first row is the main author. The advisor must be picked from the suggestions
 * (users with the advisor role).
 */
export default function RepositoryMetadataFields({ idPrefix, draft, onChange, courses, disabled }: RepositoryMetadataFieldsProps) {
  const update = (changes: Partial<RepositoryMetadataDraft>) => onChange({ ...draft, ...changes })
  const updateAuthor = (key: string, changes: Partial<RepositoryAuthorDraft>) =>
    update({ authors: draft.authors.map((author) => (author.key === key ? { ...author, ...changes } : author)) })
  const removeAuthor = (key: string) => update({ authors: draft.authors.filter((author) => author.key !== key) })
  const abstractId = `${idPrefix}-abstract`
  const advisorId = `${idPrefix}-advisor`

  return (
    <>
      <Field label="Título" value={draft.title} onChange={(title) => update({ title })} required disabled={disabled} maxLength={500} />
      <div className="field">
        <label htmlFor={abstractId}>
          <span>Resumo</span>
        </label>
        <textarea
          id={abstractId}
          className="feedback-area"
          value={draft.abstract}
          required
          disabled={disabled}
          onChange={(event) => update({ abstract: event.target.value })}
        />
      </div>
      <Field
        label="Palavras-chave"
        hint="Separe as palavras-chave por vírgula."
        value={draft.keywords}
        onChange={(keywords) => update({ keywords })}
        required
        disabled={disabled}
      />
      <div className="two-col">
        <SelectField
          label="Tipo de trabalho"
          options={THESIS_TYPE_OPTIONS}
          value={draft.type}
          onChange={(type) => update({ type: type === "ARTICLE" ? "ARTICLE" : ("MONOGRAPH" as RepositoryThesisType) })}
          disabled={disabled}
        />
        {draft.type === "ARTICLE" && (
          <Field label="Periódico" value={draft.journal} onChange={(journal) => update({ journal })} disabled={disabled} maxLength={200} />
        )}
      </div>

      <fieldset className="repository-authors">
        <legend>Autores</legend>
        {draft.authors.map((author, index) => {
          const inputId = `${idPrefix}-author-${author.key}`
          return (
            <div className="field repository-author" key={author.key}>
              <label htmlFor={inputId}>
                <span>{index === 0 ? "Autor 1 (principal)" : `Autor ${index + 1}`}</span>
              </label>
              <div className="repository-author-row">
                <UserSuggestInput
                  id={inputId}
                  value={author.name}
                  onChange={(name) => updateAuthor(author.key, { name, user: null })}
                  onSelect={(user) => updateAuthor(author.key, { name: user.name, user: personFromSuggestion(user) })}
                  placeholder="Nome como impresso no trabalho ou busca de usuário"
                  disabled={disabled}
                />
                {draft.authors.length > 1 && (
                  <Button
                    variant="ghost"
                    disabled={disabled}
                    onClick={() => removeAuthor(author.key)}
                  >
                    <span className="sr-only">{`Remover autor ${index + 1}`}</span>
                    <span aria-hidden="true">Remover</span>
                  </Button>
                )}
              </div>
              <small className="field-hint">
                {author.user ? `Vinculado ao usuário ${author.user.name} (${author.user.email}).` : "Sem vínculo com usuário do sistema."}
              </small>
            </div>
          )
        })}
        <Button
          variant="outline"
          icon="plus"
          disabled={disabled || draft.authors.length >= REPOSITORY_MAX_AUTHORS}
          onClick={() => update({ authors: [...draft.authors, newAuthorDraft()] })}
        >
          Adicionar autor
        </Button>
      </fieldset>

      <div className="field">
        <label htmlFor={advisorId}>
          <span>Orientador</span>
        </label>
        <UserSuggestInput
          id={advisorId}
          role="ADVISOR"
          value={draft.advisorQuery}
          onChange={(advisorQuery) => update({ advisorQuery, advisor: null })}
          onSelect={(user) => update({ advisorQuery: user.name, advisor: personFromSuggestion(user) })}
          placeholder="Digite o nome ou o e-mail do orientador"
          disabled={disabled}
        />
      </div>
      {draft.advisor && (
        <UserFoundCard name={draft.advisor.name} email={draft.advisor.email} avatarUrl={draft.advisor.avatarUrl} badgeLabel="Selecionado" />
      )}

      <SelectField
        label="Curso"
        options={courses.options}
        placeholder={courses.loading ? "Carregando cursos…" : "Selecione o curso"}
        value={draft.courseId}
        onChange={(courseId) => update({ courseId })}
        required
        disabled={disabled || courses.loading}
        hint="A coordenação só pode gerenciar monografias dos cursos que coordena."
      />
      {courses.error && (
        <div className="form-error" role="alert">
          <span>{courses.error}</span>
          <Button variant="secondary" onClick={courses.retry}>
            Tentar novamente
          </Button>
        </div>
      )}
      <div className="two-col">
        <Field
          label="Ano de defesa"
          type="number"
          value={draft.defenseYear}
          onChange={(defenseYear) => update({ defenseYear })}
          required
          disabled={disabled}
        />
        <Field
          label="Data de defesa (opcional)"
          type="date"
          value={draft.defenseDate}
          onChange={(defenseDate) => update({ defenseDate })}
          disabled={disabled}
        />
      </div>
    </>
  )
}
