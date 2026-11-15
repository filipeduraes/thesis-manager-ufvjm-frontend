import { useCallback, useEffect, useRef, useState } from "react"
import {
  ApiError,
  COMMITTEE_ROLE_LABELS,
  DEFENSE_RESULT_LABELS,
  defenseApi,
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
  Modal,
  PageTitle,
} from "../components/common"
import type { ExternalMemberDraft, InstitutionalMemberDraft } from "../types"

type AddModalKind = "institutional" | "external" | null

interface DefenseCommitteeProps {
  /** UUID da defesa cujos membros serão gerenciados. */
  defenseId: string
  goBack: () => void
  /** Usuário autenticado é administrador institucional (único que pode reverter status). */
  isAdmin?: boolean
  /** Usuário pode iniciar/encerrar a banca (admin ou coordenador). */
  canStartClose?: boolean
}

const STATUS_BADGE_TONE: Record<string, "light" | "active" | "success" | "dark"> = {
  SCHEDULED: "light",
  IN_PROGRESS: "active",
  COMPLETED: "success",
  CANCELLED: "dark",
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
}: DefenseCommitteeProps) {
  const [defense, setDefense] = useState<DefenseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [addModal, setAddModal] = useState<AddModalKind>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState("")
  const [refreshing, setRefreshing] = useState(false)
  const firstLoadRef = useRef(true)

  // Item C — start / close
  const [startLoading, setStartLoading] = useState(false)
  const [closeLoading, setCloseLoading] = useState(false)
  const [actionError, setActionError] = useState("")

  // Item A — revert status
  const [revertOpen, setRevertOpen] = useState(false)
  const [revertReason, setRevertReason] = useState("")
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
      const { defense: data } = await defenseApi.start(defenseId)
      setDefense(data)
    } catch (reason) {
      setActionError(
        reason instanceof Error ? reason.message : "Não foi possível iniciar a banca.",
      )
    } finally {
      setStartLoading(false)
    }
  }

  const closeDefense = async () => {
    setCloseLoading(true)
    setActionError("")
    try {
      const { defense: data } = await defenseApi.close(defenseId)
      setDefense(data)
    } catch (reason) {
      setActionError(
        reason instanceof Error ? reason.message : "Não foi possível encerrar a banca.",
      )
    } finally {
      setCloseLoading(false)
    }
  }

  const closeRevertModal = () => {
    setRevertOpen(false)
    setRevertReason("")
    setRevertError("")
  }

  const doRevertStatus = async () => {
    if (!revertReason.trim()) return
    setRevertLoading(true)
    setRevertError("")
    try {
      const { defense: data } = await defenseApi.revertStatus(defenseId, revertReason.trim())
      setDefense(data)
      closeRevertModal()
    } catch (reason) {
      setRevertError(
        reason instanceof Error ? reason.message : "Não foi possível reverter o status.",
      )
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
        <PageTitle eyebrow="Banca de defesa" title="Membros da banca" />
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
  const canRevert = isAdmin && (isInProgress || isCancelled)
  const statusTone = STATUS_BADGE_TONE[defense.status] ?? "neutral"

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
      <PageTitle eyebrow="Banca de defesa" title="Membros da banca" />

      <Card className="thesis-summary">
        <div className="file-icon">
          <Icon name="calendar" />
        </div>
        <div>
          <h3>
            {scheduledDate} · {defense.modalityLabel}
          </h3>
          {defense.location && <span>{defense.location}</span>}
        </div>
        <Badge tone={statusTone}>{defense.statusLabel}</Badge>
        <Button variant="outline" disabled={refreshing} onClick={loadDefense}>
          {refreshing ? "Atualizando…" : "Atualizar"}
        </Button>
        {canStartClose && isScheduled && (
          <Button
            variant="success"
            disabled={startLoading}
            onClick={() => void startDefense()}
          >
            {startLoading ? "Iniciando…" : "Iniciar banca"}
          </Button>
        )}
        {canStartClose && isInProgress && (
          <Button
            variant="secondary"
            disabled={closeLoading}
            onClick={() => void closeDefense()}
          >
            {closeLoading ? "Encerrando…" : "Encerrar banca"}
          </Button>
        )}
        {canRevert && (
          <Button variant="danger" onClick={() => setRevertOpen(true)}>
            Reverter status
          </Button>
        )}
        <Button variant="ghost" onClick={goBack}>
          Voltar
        </Button>
      </Card>

      {actionError && (
        <div className="success-notice" role="alert">
          {actionError}
        </div>
      )}

      {removeError && (
        <div className="success-notice" role="alert">
          {removeError}
        </div>
      )}

      <Card>
        <div className="section-head">
          <div>
            <h2>Comissão avaliadora</h2>
            <p>{defense.members.length} membro{defense.members.length !== 1 ? "s" : ""}</p>
          </div>
          {canManage && (
            <div style={{ display: "flex", gap: "0.5rem" }}>
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
          <div className="member-list">
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
                      variant="danger"
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

      {/* Modal — reverter status (admin only) */}
      {revertOpen && (
        <Modal className="admin-modal invite-modal" onClose={closeRevertModal} labelledBy="revert-status-title">
          <div className="section-head">
            <div>
              <h2 id="revert-status-title">Reverter status da banca</h2>
              <p>
                Status atual: <strong>{defense.statusLabel}</strong>
              </p>
            </div>
            <button
              className="icon-btn"
              onClick={closeRevertModal}
              aria-label="Fechar"
            >
              <Icon name="close" />
            </button>
          </div>

          {revertError && (
            <div className="success-notice" role="alert">
              {revertError}
            </div>
          )}

          <label className="field">
            <span>
              Motivo <small>(obrigatório)</small>
            </span>
            <textarea
              className="feedback-area"
              value={revertReason}
              onChange={(e) => setRevertReason(e.target.value)}
              placeholder="Descreva o motivo da reversão"
              rows={3}
            />
          </label>

          <div className="modal-actions">
            <Button variant="secondary" onClick={closeRevertModal}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              disabled={!revertReason.trim() || revertLoading}
              onClick={() => void doRevertStatus()}
            >
              {revertLoading ? "Revertendo…" : "Reverter"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
