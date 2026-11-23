import { useCallback, useEffect, useRef, useState } from "react"
import {
  ApiError,
  COMMITTEE_ROLE_LABELS,
  DEFENSE_RESULT_LABELS,
  defenseApi,
  NO_DEFENSE_PERMISSIONS,
  type DefenseCommitteeMember,
  type DefenseData,
} from "../api/client"
import {
  Avatar,
  Badge,
  Breadcrumb,
  Button,
  Card,
  ExternalMemberModal,
  Icon,
  InstitutionalMemberModal,
  PageTitle,
} from "../components/common"
import { availabilityStatusBadge, defenseDecisionTone, defenseStatusTone } from "../data/defenseStatus"
import type { BadgeTone } from "../data/thesisStatus"
import type { ExternalMemberDraft, InstitutionalMemberDraft } from "../types"
import DefenseAvailabilityResponse from "./defense/DefenseAvailabilityResponse"
import { LONG_DATE_FORMATTER } from "../data/dateFormat"
import DefenseCancelModal from "./defense/DefenseCancelModal"
import DefenseEditModal from "./defense/DefenseEditModal"
import DefenseStatusConfirmModal from "./defense/DefenseStatusConfirmModal"
import DefenseThesisCard from "./defense/DefenseThesisCard"
import DefenseStatusTimeline from "./defense/DefenseStatusTimeline"
import { statusActionErrorMessage } from "./defense/defenseErrors"
import { formatDefenseTimeRange, formatDuration } from "./defense/defenseSchedule"
import { invitationActionErrorMessage, invitationStatusText } from "./defense/invitationStatus"

type AddModalKind = "institutional" | "external" | null
type StatusModalKind = "start" | "close" | "revert" | null

interface DefenseCommitteeProps {
  /** UUID da defesa cujos membros serão gerenciados. */
  defenseId: string
  goBack: () => void
}

function evaluationStatusBadge(
  member: DefenseCommitteeMember,
): { label: string; tone: BadgeTone } {
  if (member.role === "ALTERNATE") return { label: "Suplente", tone: "neutral" }
  if (member.evaluation)
    return {
      label: DEFENSE_RESULT_LABELS[member.evaluation.decision] ?? member.evaluation.decision,
      tone: defenseDecisionTone(member.evaluation.decision),
    }
  // Pendência usa neutral, como documentStatusTones.PENDING.
  return { label: "Aguardando avaliação", tone: "neutral" }
}

/**
 * Tela de gestão dos membros de uma banca de defesa.
 *
 * Which actions are shown (edit, cancel, start, close, revert, member management) and
 * whether the pending summary and the other members' availability appear follow only
 * `viewerPermissions` from `GET /defenses/{id}`; no role is inferred here. The flags do
 * not include business preconditions, so "Iniciar banca" stays disabled while
 * `allMembersConfirmed` is false and a refused close shows the backend message. Member
 * removal is also limited to SCHEDULED defenses, as in `remove_member`.
 *
 * Para adicionar membro institucional, o e-mail é resolvido via
 * GET /api/v1/admin/users/lookup (somente admin/coordenador na rede institucional).
 * Para adicionar membro externo, usa-se POST /defenses/{id}/members/external. O código de
 * acesso do membro externo nunca chega ao navegador: o backend o envia por e-mail, e a tela
 * mostra só para onde o convite foi e se o envio já saiu, com "Reenviar convite" (convite
 * ainda válido) ou "Gerar novo convite" (usado, expirado ou revogado).
 */
export default function DefenseCommittee({ defenseId, goBack }: DefenseCommitteeProps) {
  const [defense, setDefense] = useState<DefenseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [addModal, setAddModal] = useState<AddModalKind>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState("")
  const [refreshing, setRefreshing] = useState(false)
  const firstLoadRef = useRef(true)
  const [scheduleModal, setScheduleModal] = useState<"edit" | "cancel" | null>(null)

  // Ações de status: iniciar, encerrar e reverter abrem confirmação antes da chamada.
  const [statusModal, setStatusModal] = useState<StatusModalKind>(null)
  const [startLoading, setStartLoading] = useState(false)
  const [closeLoading, setCloseLoading] = useState(false)
  const [actionError, setActionError] = useState("")
  const [revertLoading, setRevertLoading] = useState(false)
  const [revertError, setRevertError] = useState("")

  // Convites de membros externos: o código vai só por e-mail; aqui ficam o andamento e os avisos.
  const [regenerateTarget, setRegenerateTarget] = useState<DefenseCommitteeMember | null>(null)
  const [removeTarget, setRemoveTarget] = useState<DefenseCommitteeMember | null>(null)
  const [regenerateLoading, setRegenerateLoading] = useState(false)
  const [regenerateError, setRegenerateError] = useState("")
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [invitationNotice, setInvitationNotice] = useState("")
  const [invitationError, setInvitationError] = useState("")

  // Identificador por requisição: respostas de uma banca anterior não podem
  // sobrescrever o estado da banca atualmente aberta.
  const requestSeqRef = useRef(0)
  // Muda só quando a banca aberta muda ou a tela é desmontada; ações como "Reenviar
  // convite" não podem usar requestSeqRef, que também avança a cada recarga.
  const viewSeqRef = useRef(0)

  const loadDefense = useCallback(() => {
    const requestId = ++requestSeqRef.current
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
        if (requestId === requestSeqRef.current) setDefense(data)
      })
      .catch((reason: unknown) => {
        if (requestId !== requestSeqRef.current) return
        const msg =
          reason instanceof ApiError && reason.status === 403
            ? "Você não tem permissão para acessar esta banca."
            : reason instanceof Error
              ? reason.message
              : "Não foi possível carregar a banca."
        setLoadError(msg)
      })
      .finally(() => {
        if (requestId === requestSeqRef.current) {
          setLoading(false)
          setRefreshing(false)
        }
      })
  }, [defenseId])

  useEffect(() => {
    loadDefense()
    return () => {
      requestSeqRef.current += 1
      viewSeqRef.current += 1
    }
  }, [loadDefense])

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
    const response = await defenseApi.addExternalMember(defenseId, {
      role: draft.role,
      name: draft.name,
      email: draft.email,
      institution: draft.institution || undefined,
    })
    setInvitationError("")
    setInvitationNotice(`Membro adicionado. O convite com o código de acesso será enviado para ${response.member.email}.`)
    loadDefense()
  }

  const resendInvitation = async (member: DefenseCommitteeMember) => {
    if (resendingId) return
    setResendingId(member.id)
    setInvitationNotice("")
    setInvitationError("")
    const viewId = viewSeqRef.current
    try {
      await defenseApi.resendInvitation(defenseId, member.id)
      if (viewId !== viewSeqRef.current) return
      setInvitationNotice(`Convite reenviado para ${member.email}. O código anterior deixou de funcionar.`)
      loadDefense()
    } catch (reason) {
      if (viewId === viewSeqRef.current) setInvitationError(invitationActionErrorMessage(reason, "Não foi possível reenviar o convite."))
    } finally {
      if (viewId === viewSeqRef.current) setResendingId(null)
    }
  }

  const regenerateInvitation = async () => {
    if (!regenerateTarget) return
    setRegenerateLoading(true)
    setRegenerateError("")
    try {
      await defenseApi.regenerateInvitation(defenseId, regenerateTarget.id)
      setInvitationError("")
      setInvitationNotice(`Novo convite enviado para ${regenerateTarget.email}. O código anterior deixou de funcionar.`)
      setRegenerateTarget(null)
      loadDefense()
    } catch (reason) {
      setRegenerateError(invitationActionErrorMessage(reason, "Não foi possível gerar um novo convite."))
    } finally {
      setRegenerateLoading(false)
    }
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
      setRemoveTarget(null)
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
        <Breadcrumb
          items={[{ label: "Bancas", onClick: goBack }, { label: "Gerenciar banca" }]}
        />
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
        <Breadcrumb
          items={[{ label: "Bancas", onClick: goBack }, { label: "Gerenciar banca" }]}
        />
        <PageTitle eyebrow="Banca de defesa" title="Gerenciar banca" />
        <Card>
          <div className="form-error" role="alert">
            {loadError}
          </div>
        </Card>
      </div>
    )
  }

  if (!defense) return null

  const isScheduled = defense.status === "SCHEDULED"
  const isInProgress = defense.status === "IN_PROGRESS"
  // As flags já combinam o direito do usuário e o status da banca; sem o campo, nada aparece.
  const permissions = defense.viewerPermissions ?? NO_DEFENSE_PERMISSIONS
  const { canStart, canClose, canCancel, canRevert, canEdit, canManageMembers } = permissions
  // remove_member só aceita bancas agendadas, condição de status que canManageMembers não cobre.
  const canRemoveMembers = canManageMembers && isScheduled
  const hasStatusActions = canStart || canClose || canCancel || canRevert
  // canStart ignora as confirmações de disponibilidade; allMembersConfirmed decide se o
  // botão fica habilitado. pendingConfirmations null quer dizer lista oculta, não vazia.
  const startBlocked = canStart && defense.allMembersConfirmed !== true
  const visiblePending = permissions.canManage ? defense.pendingConfirmations ?? [] : []
  const pendingNames = visiblePending.map((pending) => pending.name)
  const myMemberId = defense.viewerMembership?.memberId ?? null
  const myMember = myMemberId ? defense.members.find((member) => member.id === myMemberId) : undefined
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
      <Breadcrumb
        items={[{ label: "Bancas", onClick: goBack }, { label: "Gerenciar banca" }]}
      />
      <PageTitle eyebrow="Banca de defesa" title="Gerenciar banca" />

      <DefenseThesisCard summary={defense.thesisSummary} />

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
        </div>
      </Card>

      <Card>
        <div className="section-head defense-section-head">
          <h2>Status da banca</h2>
          {hasStatusActions && (
            <div className="defense-actions">
              {canStart && (
                <Button
                  variant="success"
                  disabled={startBlocked}
                  describedBy={startBlocked ? "defense-pending-confirmations" : undefined}
                  onClick={() => setStatusModal("start")}
                >
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
        {startBlocked && (
          <div className="conflict-message availability-pending" id="defense-pending-confirmations" role="status">
            <Icon name="clock" />
            <div>
              <strong>
                {pendingNames.length > 0
                  ? `Aguardando confirmação de: ${pendingNames.join(", ")}`
                  : "Aguardando a confirmação dos membros titulares"}
              </strong>
              <span>
                A banca só pode ser iniciada depois que todos os membros titulares confirmarem a disponibilidade.
              </span>
            </div>
          </div>
        )}
        <DefenseStatusTimeline status={defense.status} history={defense.statusHistory ?? []} />
      </Card>

      {myMember && isScheduled && (
        <Card>
          <div className="section-head defense-section-head">
            <h2>Sua disponibilidade</h2>
          </div>
          <DefenseAvailabilityResponse defenseId={defense.id} member={myMember} onResponded={loadDefense} />
        </Card>
      )}

      <Card>
        <div className="section-head defense-section-head">
          <h2>Dados da banca</h2>
          {canEdit && (
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

      {removeError && (
        <div className="form-error" role="alert">
          {removeError}
        </div>
      )}

      <div aria-live="polite">
        {invitationNotice && (
          <div className="success-notice" role="status">
            {invitationNotice}
          </div>
        )}
      </div>
      {invitationError && (
        <div className="success-notice" role="alert">
          {invitationError}
        </div>
      )}

      <Card>
        <div className="section-head defense-section-head">
          <div>
            <h2>Comissão avaliadora</h2>
            <p>{defense.members.length} membro{defense.members.length !== 1 ? "s" : ""}</p>
          </div>
          {canManageMembers && (
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
              const availability = availabilityStatusBadge(member.availabilityStatus)
              // O backend já anula a disponibilidade dos outros para quem não gerencia; a
              // condição evita exibir um selo "pendente" no lugar de um dado oculto.
              const canSeeAvailability = permissions.canManage || member.id === myMemberId
              const showAvailability = canSeeAvailability && member.availabilityStatus !== null
              const isExternal = !member.isInstitutional
              const canResend = canManageMembers && isExternal && member.canResendInvitation === true
              const canRegenerate = canManageMembers && isExternal && !canResend
              const invitationText = permissions.canManage ? invitationStatusText(member) : null
              const canRemove = canRemoveMembers && !member.evaluation
              return (
                <div key={member.id}>
                  <Avatar name={member.name} imageUrl={member.isInstitutional ? member.avatarUrl : null} />
                  <div>
                    <strong id={`committee-member-${member.id}`}>{member.name}</strong>
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
                    {showAvailability && member.availabilityStatus === "DECLINED" && member.availabilityNote && (
                      <small className="availability-note">Observação: {member.availabilityNote}</small>
                    )}
                    {invitationText && <small className="invitation-status">{invitationText}</small>}
                  </div>
                  <div className="member-badges">
                    {showAvailability && <Badge tone={availability.tone}>{availability.label}</Badge>}
                    <Badge tone={evalStatus.tone}>{evalStatus.label}</Badge>
                  </div>
                  {(canRemove || canResend || canRegenerate) && (
                    <div className="defense-actions">
                      {canResend && (
                        <Button
                          variant="outline"
                          disabled={resendingId !== null}
                          describedBy={`committee-member-${member.id}`}
                          onClick={() => void resendInvitation(member)}
                        >
                          {resendingId === member.id ? "Reenviando…" : "Reenviar convite"}
                        </Button>
                      )}
                      {canRegenerate && (
                        <Button
                          variant="outline"
                          describedBy={`committee-member-${member.id}`}
                          onClick={() => setRegenerateTarget(member)}
                        >
                          Gerar novo convite
                        </Button>
                      )}
                      {canRemove && (
                        <Button
                          variant="danger"
                          disabled={removing === member.id}
                          onClick={() => setRemoveTarget(member)}
                        >
                          {removing === member.id ? "Removendo…" : "Remover"}
                        </Button>
                      )}
                    </div>
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

      {removeTarget && (
        <DefenseStatusConfirmModal
          title="Remover membro da banca?"
          description={`${removeTarget.name} será removido da banca e seu convite/token deixará de funcionar.`}
          confirmLabel="Remover membro"
          pendingLabel="Removendo…"
          destructive
          loading={removing === removeTarget.id}
          error={removeError}
          onConfirm={() => void removeMember(removeTarget.id)}
          onClose={() => {
            setRemoveTarget(null)
            setRemoveError("")
          }}
        />
      )}

      {regenerateTarget && (
        <DefenseStatusConfirmModal
          title="Gerar novo convite?"
          description={`O convite atual de ${regenerateTarget.name} será revogado e as sessões abertas com ele serão encerradas. Um novo código de acesso será enviado para ${regenerateTarget.email}. A disponibilidade e a avaliação já registradas são mantidas.`}
          confirmLabel="Gerar novo convite"
          pendingLabel="Gerando…"
          destructive
          loading={regenerateLoading}
          error={regenerateError}
          onConfirm={() => void regenerateInvitation()}
          onClose={() => {
            setRegenerateTarget(null)
            setRegenerateError("")
          }}
        />
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
