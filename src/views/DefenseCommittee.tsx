import { useCallback, useEffect, useRef, useState } from "react"
import {
  ApiError,
  COMMITTEE_ROLE_LABELS,
  DEFENSE_RESULT_LABELS,
  defenseApi,
  NO_DEFENSE_PERMISSIONS,
  type DefenseCommitteeMember,
  type DefenseData,
  type ExternalMemberTokenResponse,
} from "../api/client"
import {
  AccessTokenModal,
  Avatar,
  Badge,
  Breadcrumb,
  Button,
  Card,
  ExternalMemberModal,
  Icon,
  InstitutionalMemberModal,
  PageTitle,
  type IssuedAccessToken,
} from "../components/common"
import { availabilityStatusBadge, defenseDecisionTone, defenseStatusTone } from "../data/defenseStatus"
import type { BadgeTone } from "../data/thesisStatus"
import type { ExternalMemberDraft, InstitutionalMemberDraft } from "../types"
import DefenseAvailabilityResponse from "./defense/DefenseAvailabilityResponse"
import DefenseCancelModal from "./defense/DefenseCancelModal"
import DefenseEditModal from "./defense/DefenseEditModal"
import DefenseStatusConfirmModal from "./defense/DefenseStatusConfirmModal"
import DefenseThesisCard from "./defense/DefenseThesisCard"
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
 * Para adicionar membro externo, usa-se POST /defenses/{id}/members/external.
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

  // Token do membro externo: fica só neste estado enquanto o modal está aberto.
  const [issuedTokens, setIssuedTokens] = useState<IssuedAccessToken[]>([])
  const [regenerateTarget, setRegenerateTarget] = useState<DefenseCommitteeMember | null>(null)
  const [regenerateLoading, setRegenerateLoading] = useState(false)
  const [regenerateError, setRegenerateError] = useState("")

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

  const finishScheduleChange = () => {
    setScheduleModal(null)
    loadDefense()
  }

  // Erros são propagados para o modal, que exibe a mensagem do backend.
  const addInstitutionalMember = async (draft: InstitutionalMemberDraft) => {
    await defenseApi.addInstitutionalMember(defenseId, { role: draft.role, userId: draft.userId })
    loadDefense()
  }

  const showIssuedToken = (response: ExternalMemberTokenResponse) => {
    setIssuedTokens([
      {
        memberId: response.member.id,
        memberName: response.member.name,
        token: response.accessToken,
        expiresAt: response.accessTokenExpiresAt,
      },
    ])
  }

  const addExternalMember = async (draft: ExternalMemberDraft) => {
    const response = await defenseApi.addExternalMember(defenseId, {
      role: draft.role,
      name: draft.name,
      email: draft.email,
      institution: draft.institution || undefined,
    })
    showIssuedToken(response)
    loadDefense()
  }

  const regenerateToken = async () => {
    if (!regenerateTarget) return
    setRegenerateLoading(true)
    setRegenerateError("")
    try {
      const response = await defenseApi.regenerateToken(defenseId, regenerateTarget.id)
      setRegenerateTarget(null)
      showIssuedToken(response)
      loadDefense()
    } catch (reason) {
      setRegenerateError(statusActionErrorMessage(reason, "Não foi possível gerar um novo token."))
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
          <div className="success-notice" role="alert">
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
              const canRegenerateToken = canManageMembers && !member.isInstitutional
              const canRemove = canRemoveMembers && !member.evaluation
              return (
                <div key={member.id}>
                  <Avatar name={member.name} imageUrl={member.isInstitutional ? member.avatarUrl : null} />
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
                    {showAvailability && member.availabilityStatus === "DECLINED" && member.availabilityNote && (
                      <small className="availability-note">Observação: {member.availabilityNote}</small>
                    )}
                  </div>
                  <div className="member-badges">
                    {showAvailability && <Badge tone={availability.tone}>{availability.label}</Badge>}
                    <Badge tone={evalStatus.tone}>{evalStatus.label}</Badge>
                  </div>
                  {(canRemove || canRegenerateToken) && (
                    <div className="defense-actions">
                      {canRegenerateToken && (
                        <Button variant="outline" onClick={() => setRegenerateTarget(member)}>
                          Gerar novo token
                        </Button>
                      )}
                      {canRemove && (
                        <Button
                          variant="danger"
                          disabled={removing === member.id}
                          onClick={() => void removeMember(member.id)}
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

      {regenerateTarget && (
        <DefenseStatusConfirmModal
          title="Gerar novo token?"
          description={`O token atual de ${regenerateTarget.name} deixa de funcionar e as sessões abertas com ele são encerradas. A disponibilidade e a avaliação já registradas são mantidas.`}
          confirmLabel="Gerar novo token"
          pendingLabel="Gerando…"
          destructive
          loading={regenerateLoading}
          error={regenerateError}
          onConfirm={() => void regenerateToken()}
          onClose={() => {
            setRegenerateTarget(null)
            setRegenerateError("")
          }}
        />
      )}

      {issuedTokens.length > 0 && <AccessTokenModal tokens={issuedTokens} onClose={() => setIssuedTokens([])} />}

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
