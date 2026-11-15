import { useCallback, useEffect, useRef, useState } from "react"
import {
  ApiError,
  COMMITTEE_ROLE_LABELS,
  DEFENSE_RESULT_LABELS,
  defenseApi,
  thesesApi,
  type DefenseCommitteeMember,
  type DefenseData,
} from "../api/client"
import {
  Badge,
  Button,
  Card,
  ExternalMemberModal,
  Icon,
  InstitutionalMemberModal,
  PageTitle,
} from "../components/common"
import { defenseStatusTone } from "../data/defenseStatus"
import type { ExternalMemberDraft, InstitutionalMemberDraft } from "../types"
import DefenseCancelModal from "./defense/DefenseCancelModal"
import DefenseEditModal from "./defense/DefenseEditModal"
import DefenseStatusConfirmModal from "./defense/DefenseStatusConfirmModal"
import DefenseStatusTimeline from "./defense/DefenseStatusTimeline"
import { statusActionErrorMessage } from "./defense/defenseErrors"
import { formatDefenseTimeRange, formatDuration } from "./defense/defenseSchedule"

const LONG_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
})

type AddModalKind = "institutional" | "external" | null
type StatusModalKind = "start" | "close" | "revert" | null

interface DefenseCommitteeProps {
  /** UUID da defesa cujos membros serão gerenciados. */
  defenseId: string
  goBack: () => void
  /** Usuário autenticado é administrador institucional (único que pode reverter status). */
  isAdmin?: boolean
  /**
   * Usuário é admin ou coordenador. Iniciar, encerrar, cancelar e editar também ficam
   * disponíveis ao orientador da própria tese, verificado nesta tela (_can_manage_defense).
   */
  canStartClose?: boolean
  /** Usuário tem o papel de orientador; só gerencia a banca se orientar a tese. */
  isAdvisor?: boolean
  /** Id do usuário autenticado, comparado ao orientador da tese. */
  currentUserId?: string
}

function evaluationStatusBadge(
  member: DefenseCommitteeMember,
): { label: string; tone: "success" | "light" | "neutral" } {
  if (member.role === "ALTERNATE") return { label: "Suplente", tone: "neutral" }
  if (member.evaluation)
    return {
      label: DEFENSE_RESULT_LABELS[member.evaluation.decision] ?? member.evaluation.decision,
      tone: "success",
    }
  return { label: "Aguardando avaliação", tone: "light" }
}

/**
 * Tela de gestão dos membros de uma banca de defesa.
 *
 * Permite listar, adicionar e remover membros. A remoção só está disponível
 * enquanto a banca estiver no status SCHEDULED. O backend retorna 403 quando
 * o usuário não tem permissão para gerenciar a banca; a mensagem é exibida
 * diretamente.
 *
 * Para adicionar membro institucional, o e-mail é resolvido via
 * GET /api/v1/admin/users/lookup (somente admin/coordenador na rede institucional).
 * Para adicionar membro externo, usa-se POST /defenses/{id}/members/external.
 */
export default function DefenseCommittee({
  defenseId,
  goBack,
  isAdmin = false,
  canStartClose = false,
  isAdvisor = false,
  currentUserId,
}: DefenseCommitteeProps) {
  const [defense, setDefense] = useState<DefenseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [addModal, setAddModal] = useState<AddModalKind>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState("")
  const [refreshing, setRefreshing] = useState(false)
  const firstLoadRef = useRef(true)
  const [scheduleModal, setScheduleModal] = useState<"edit" | "cancel" | null>(null)
  // Espelha _can_manage_defense: orientador só gerencia a banca da tese que orienta.
  const [isThesisAdvisor, setIsThesisAdvisor] = useState(false)
  const [permissionError, setPermissionError] = useState("")

  // Ações de status: iniciar, encerrar e reverter abrem confirmação antes da chamada.
  const [statusModal, setStatusModal] = useState<StatusModalKind>(null)
  const [startLoading, setStartLoading] = useState(false)
  const [closeLoading, setCloseLoading] = useState(false)
  const [actionError, setActionError] = useState("")
  const [revertLoading, setRevertLoading] = useState(false)
  const [revertError, setRevertError] = useState("")

  const mountedRef = useRef(true)

  const loadDefense = useCallback(() => {
    if (firstLoadRef.current) {
      setLoading(true)
      firstLoadRef.current = false
    } else {
      setRefreshing(true)
    }
    setLoadError("")
    setRemoveError("")
    defenseApi
      .get(defenseId)
      .then(({ defense: data }) => {
        if (mountedRef.current) setDefense(data)
      })
      .catch((reason: unknown) => {
        if (!mountedRef.current) return
        const msg =
          reason instanceof ApiError && reason.status === 403
            ? "Você não tem permissão para acessar esta banca."
            : reason instanceof Error
              ? reason.message
              : "Não foi possível carregar a banca."
        setLoadError(msg)
      })
      .finally(() => {
        if (mountedRef.current) {
          setLoading(false)
          setRefreshing(false)
        }
      })
  }, [defenseId])

  useEffect(() => {
    mountedRef.current = true
    loadDefense()
    return () => {
      mountedRef.current = false
    }
  }, [loadDefense])

  const thesisId = defense?.thesis
  useEffect(() => {
    if (!thesisId || canStartClose || !isAdvisor || !currentUserId) {
      setIsThesisAdvisor(false)
      return
    }
    let cancelled = false
    setPermissionError("")
    thesesApi
      .detail(thesisId)
      .then(({ thesis }) => {
        if (!cancelled) setIsThesisAdvisor(thesis.advisor.id === currentUserId)
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        setIsThesisAdvisor(false)
        // 403/404 significam apenas que o usuário não orienta esta tese.
        const expected = reason instanceof ApiError && (reason.status === 403 || reason.status === 404)
        if (!expected) {
          const detail = reason instanceof Error && reason.message ? reason.message : "erro desconhecido"
          setPermissionError(`Não foi possível verificar se você pode alterar esta banca: ${detail}`)
        }
      })
    return () => {
      cancelled = true
    }
  }, [thesisId, canStartClose, isAdvisor, currentUserId])

  const finishScheduleChange = () => {
    setScheduleModal(null)
    loadDefense()
  }

  // Erros são propagados para o modal, que exibe a mensagem do backend.
  const addInstitutionalMember = async (draft: InstitutionalMemberDraft) => {
    await defenseApi.addInstitutionalMember(defenseId, { role: draft.role, userId: draft.userId })
    loadDefense()
  }

  const addExternalMember = async (draft: ExternalMemberDraft) => {
    await defenseApi.addExternalMember(defenseId, {
      role: draft.role,
      name: draft.name,
      email: draft.email,
      institution: draft.institution || undefined,
    })
    loadDefense()
  }

  const startDefense = async () => {
    setStartLoading(true)
    setActionError("")
    try {
      await defenseApi.start(defenseId)
      // A resposta não traz statusHistory; recarrega o detalhe completo.
      setStatusModal(null)
      loadDefense()
    } catch (reason) {
      setActionError(statusActionErrorMessage(reason, "Não foi possível iniciar a banca."))
    } finally {
      setStartLoading(false)
    }
  }

  const closeDefense = async () => {
    setCloseLoading(true)
    setActionError("")
    try {
      await defenseApi.close(defenseId)
      setStatusModal(null)
      loadDefense()
    } catch (reason) {
      setActionError(statusActionErrorMessage(reason, "Não foi possível encerrar a banca."))
    } finally {
      setCloseLoading(false)
    }
  }

  const closeStatusModal = () => {
    setStatusModal(null)
    setActionError("")
    setRevertError("")
  }

  const doRevertStatus = async (revertReason: string) => {
    if (!revertReason) return
    setRevertLoading(true)
    setRevertError("")
    try {
      await defenseApi.revertStatus(defenseId, revertReason)
      setStatusModal(null)
      loadDefense()
    } catch (reason) {
      setRevertError(statusActionErrorMessage(reason, "Não foi possível reverter o status."))
    } finally {
      setRevertLoading(false)
    }
  }

  const removeMember = async (memberId: string) => {
    setRemoving(memberId)
    setRemoveError("")
    try {
      await defenseApi.removeMember(defenseId, memberId)
      loadDefense()
    } catch (reason) {
      setRemoveError(
        reason instanceof Error ? reason.message : "Não foi possível remover o membro.",
      )
    } finally {
      setRemoving(null)
    }
  }

  if (loading) {
    return (
      <div className="page-content">
        <PageTitle eyebrow="Banca de defesa" title="Carregando…" />
        <Card>
          <p aria-live="polite">Carregando dados da banca…</p>
        </Card>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="page-content">
        <PageTitle eyebrow="Banca de defesa" title="Gerenciar banca" />
        <Card>
          <div className="success-notice" role="alert">
            {loadError}
          </div>
          <div className="form-actions">
            <Button variant="ghost" onClick={goBack}>
              Voltar
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  if (!defense) return null

  const isScheduled = defense.status === "SCHEDULED"
  const isInProgress = defense.status === "IN_PROGRESS"
  const isCancelled = defense.status === "CANCELLED"
  const canManage = isScheduled
  // Espelha _can_manage_defense (iniciar, encerrar, cancelar, editar) e a regra de
  // revert-status (somente admin). O backend continua sendo quem decide.
  const canManageDefense = canStartClose || isThesisAdvisor
  const canStart = isScheduled && canManageDefense
  const canClose = isInProgress && canManageDefense
  const canCancel = isScheduled && canManageDefense
  const canRevert = isAdmin && (isInProgress || isCancelled)
  const canManageSchedule = isScheduled && canManageDefense
  const hasStatusActions = canStart || canClose || canCancel || canRevert
  const timeRange = formatDefenseTimeRange(defense.scheduledDatetime, defense.durationMinutes)
  const statusTone = defenseStatusTone(defense.status)

  const scheduledDate = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(defense.scheduledDatetime))

  return (
    <div className="page-content">
      <PageTitle eyebrow="Banca de defesa" title="Gerenciar banca" />

      <Card className="thesis-summary defense-summary">
        <div className="file-icon">
          <Icon name="calendar" />
        </div>
        <div>
          <h3>
            {scheduledDate} · {defense.modalityLabel}
          </h3>
          {defense.location && <span>{defense.location}</span>}
        </div>
        <div className="defense-actions">
          <Badge tone={statusTone}>{defense.statusLabel}</Badge>
          <Button variant="outline" disabled={refreshing} onClick={loadDefense}>
            {refreshing ? "Atualizando…" : "Atualizar"}
          </Button>
          <Button variant="ghost" onClick={goBack}>
            Voltar
          </Button>
        </div>
      </Card>

      <Card>
        <div className="section-head defense-section-head">
          <h2>Status da banca</h2>
          {hasStatusActions && (
            <div className="defense-actions">
              {canStart && (
                <Button variant="success" onClick={() => setStatusModal("start")}>
                  Iniciar banca
                </Button>
              )}
              {canClose && (
                <Button variant="success" onClick={() => setStatusModal("close")}>
                  Encerrar banca
                </Button>
              )}
              {canCancel && (
                <Button variant="danger" onClick={() => setScheduleModal("cancel")}>
                  Cancelar banca
                </Button>
              )}
              {canRevert && (
                <Button variant="danger" onClick={() => setStatusModal("revert")}>
                  Reverter status
                </Button>
              )}
            </div>
          )}
        </div>
        <DefenseStatusTimeline status={defense.status} history={defense.statusHistory ?? []} />
      </Card>

      <Card>
        <div className="section-head defense-section-head">
          <h2>Dados da banca</h2>
          {canManageSchedule && (
            <div className="defense-actions">
              <Button variant="outline" onClick={() => setScheduleModal("edit")}>
                Editar agendamento
              </Button>
            </div>
          )}
        </div>
        <dl className="meta-list defense-details">
          <div>
            <dt>Data</dt>
            <dd>{LONG_DATE_FORMATTER.format(new Date(defense.scheduledDatetime))}</dd>
          </div>
          <div>
            <dt>Horário</dt>
            <dd>{timeRange}</dd>
          </div>
          <div>
            <dt>Duração</dt>
            <dd>{formatDuration(defense.durationMinutes)}</dd>
          </div>
          <div>
            <dt>Modalidade</dt>
            <dd>{defense.modalityLabel}</dd>
          </div>
          <div>
            <dt>{defense.modality === "REMOTE" ? "Link" : "Local"}</dt>
            <dd>{defense.location || "Não informado"}</dd>
          </div>
          <div>
            <dt>Observações</dt>
            <dd>{defense.notes || "Nenhuma"}</dd>
          </div>
        </dl>
      </Card>

      {permissionError && (
        <div className="success-notice" role="alert">
          {permissionError}
        </div>
      )}

      {removeError && (
        <div className="success-notice" role="alert">
          {removeError}
        </div>
      )}

      <Card>
        <div className="section-head defense-section-head">
          <div>
            <h2>Comissão avaliadora</h2>
            <p>{defense.members.length} membro{defense.members.length !== 1 ? "s" : ""}</p>
          </div>
          {canManage && (
            <div className="defense-actions">
              <Button
                variant="outline"
                icon="plus"
                onClick={() => setAddModal("institutional")}
              >
                Membro institucional
              </Button>
              <Button
                variant="outline"
                icon="plus"
                onClick={() => setAddModal("external")}
              >
                Membro externo
              </Button>
            </div>
          )}
        </div>

        {defense.members.length === 0 ? (
          <p>Nenhum membro cadastrado.</p>
        ) : (
          <div className="member-list committee-member-list">
            {defense.members.map((member) => {
              const evalStatus = evaluationStatusBadge(member)
              return (
                <div key={member.id}>
                  <div className="avatar">
                    {member.name
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase())
                      .join("")}
                  </div>
                  <div>
                    <strong>{member.name}</strong>
                    <span>
                      {COMMITTEE_ROLE_LABELS[member.role] ?? member.role} ·{" "}
                      {member.isInstitutional ? "Institucional" : "Externo"}
                      {member.institution ? ` · ${member.institution}` : ""}
                    </span>
                    {member.hasConflict && (
                      <small className="conflict-note">
                        <Icon name="alert" size={12} /> Conflito de interesse
                        declarado
                      </small>
                    )}
                  </div>
                  <Badge tone={evalStatus.tone}>{evalStatus.label}</Badge>
                  {canManage && !member.evaluation && (
                    <Button
                      variant="secondary"
                      disabled={removing === member.id}
                      onClick={() => void removeMember(member.id)}
                    >
                      {removing === member.id ? "Removendo…" : "Remover"}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {addModal === "institutional" && (
        <InstitutionalMemberModal onClose={() => setAddModal(null)} onSubmit={addInstitutionalMember} />
      )}

      {addModal === "external" && (
        <ExternalMemberModal onClose={() => setAddModal(null)} onSubmit={addExternalMember} />
      )}

      {scheduleModal === "edit" && (
        <DefenseEditModal defense={defense} onClose={() => setScheduleModal(null)} onSaved={finishScheduleChange} />
      )}

      {scheduleModal === "cancel" && (
        <DefenseCancelModal
          defenseId={defense.id}
          onClose={() => setScheduleModal(null)}
          onCancelled={finishScheduleChange}
        />
      )}

      {statusModal === "start" && (
        <DefenseStatusConfirmModal
          title="Iniciar banca?"
          description="A banca passa para Em andamento e os membros já podem avaliar."
          confirmLabel="Iniciar banca"
          pendingLabel="Iniciando…"
          loading={startLoading}
          error={actionError}
          onConfirm={() => void startDefense()}
          onClose={closeStatusModal}
        />
      )}

      {statusModal === "close" && (
        <DefenseStatusConfirmModal
          title="Encerrar banca?"
          description="O resultado será calculado pelas avaliações registradas e a banca passa para Concluída."
          confirmLabel="Encerrar banca"
          pendingLabel="Encerrando…"
          loading={closeLoading}
          error={actionError}
          onConfirm={() => void closeDefense()}
          onClose={closeStatusModal}
        />
      )}

      {statusModal === "revert" && (
        <DefenseStatusConfirmModal
          title="Reverter status da banca?"
          description={
            isInProgress
              ? "A banca volta para Agendada e não será iniciada automaticamente até ser reagendada ou iniciada manualmente."
              : "A banca volta ao status anterior ao cancelamento."
          }
          confirmLabel="Reverter status"
          pendingLabel="Revertendo…"
          destructive
          reason={{ required: true }}
          loading={revertLoading}
          error={revertError}
          onConfirm={(revertReason) => void doRevertStatus(revertReason)}
          onClose={closeStatusModal}
        />
      )}
    </div>
  )
}
