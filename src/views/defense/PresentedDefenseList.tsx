import { useState } from "react"
import type { DefenseListItem } from "../../api/client"
import { Badge, Button, Card, Icon } from "../../components/common"

/** Loading state of `GET /api/v1/defenses`, owned by the parent so the tab can show `count`. */
export type DefenseListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; defenses: DefenseListItem[]; count: number }

const STATUS_BADGE_TONE: Record<string, "light" | "active" | "success" | "dark"> = {
  SCHEDULED: "light",
  IN_PROGRESS: "active",
  COMPLETED: "success",
  CANCELLED: "dark",
}

const DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
})

interface PresentedDefenseListProps {
  listState: DefenseListState
  onRetry: () => void
  onEvaluate: (defenseId: string) => void
  onOpenCommittee: (defenseId: string) => void
}

/**
 * List of defenses visible to the current user, as returned by `GET /api/v1/defenses`.
 *
 * Evaluation actions follow `viewerMembership` from the backend; the UI does not decide
 * who may evaluate.
 */
export default function PresentedDefenseList({
  listState,
  onRetry,
  onEvaluate,
  onOpenCommittee,
}: PresentedDefenseListProps) {
  const [defenseUuid, setDefenseUuid] = useState("")
  const trimmedUuid = defenseUuid.trim()

  return (
    <div className="presented-defense-list">
      <Card className="presented-intro">
        <div>
          <Icon name="check" />
        </div>
        <span>Consulte as bancas visíveis para o seu perfil e registre seu parecer nas bancas das quais participa.</span>
      </Card>

      {listState.status === "loading" && (
        <Card>
          <p aria-live="polite">Carregando bancas…</p>
        </Card>
      )}

      {listState.status === "error" && (
        <Card>
          <div className="success-notice" role="alert">
            {listState.message}
          </div>
          <div className="form-actions">
            <Button variant="outline" onClick={onRetry}>
              Tentar novamente
            </Button>
          </div>
        </Card>
      )}

      {listState.status === "ready" && listState.defenses.length === 0 && (
        <div className="empty-state">
          <div>
            <Icon name="calendar" />
          </div>
          <h3>Nenhuma banca encontrada</h3>
          <p>As bancas agendadas que você pode acompanhar aparecerão aqui.</p>
        </div>
      )}

      {listState.status === "ready" &&
        listState.defenses.map((defense) => {
          const membership = defense.viewerMembership
          const participation = membership.isMember ? ` · Participação: ${membership.roleLabel ?? ""}` : ""
          return (
            <Card className="presented-defense" key={defense.id}>
              <div className="defense-date">
                <Icon name="calendar" />
                <span>{DATE_FORMATTER.format(new Date(defense.scheduledDatetime))}</span>
              </div>
              <div className="presented-defense-copy">
                <span className="course">{defense.thesisReferenceCode}</span>
                <h3>{defense.thesisTitle}</h3>
                <p>
                  {defense.student?.name ?? "Autor não informado"}
                  {participation}
                </p>
              </div>
              <Badge tone={STATUS_BADGE_TONE[defense.status] ?? "neutral"}>{defense.statusLabel}</Badge>
              {membership.hasEvaluated && (
                <Button variant="secondary" disabled>
                  Parecer enviado
                </Button>
              )}
              {membership.canEvaluate && !membership.hasEvaluated && (
                <Button variant="outline" onClick={() => onEvaluate(defense.id)}>
                  Avaliar
                </Button>
              )}
              <Button variant="ghost" onClick={() => onOpenCommittee(defense.id)}>
                Membros
              </Button>
            </Card>
          )
        })}

      {listState.status === "ready" && listState.count > listState.defenses.length && (
        <p className="immutable-note">
          Exibindo as {listState.defenses.length} bancas mais recentes de {listState.count}.
        </p>
      )}

      <details className="direct-defense-access">
        <summary>Abrir banca pelo ID</summary>
        <label className="field">
          <span>UUID da banca</span>
          <input
            value={defenseUuid}
            onChange={(event) => setDefenseUuid(event.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
        </label>
        <div className="form-actions">
          <Button variant="outline" disabled={!trimmedUuid} onClick={() => onEvaluate(trimmedUuid)}>
            Avaliar
          </Button>
          <Button variant="outline" disabled={!trimmedUuid} onClick={() => onOpenCommittee(trimmedUuid)}>
            Gerenciar membros
          </Button>
        </div>
      </details>
    </div>
  )
}
