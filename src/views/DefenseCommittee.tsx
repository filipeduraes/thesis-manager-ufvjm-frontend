import { useCallback, useEffect, useRef, useState } from "react"
import {
  ApiError,
  adminApi,
  COMMITTEE_ROLE_LABELS,
  COMMITTEE_ROLE_OPTIONS,
  DEFENSE_RESULT_LABELS,
  defenseApi,
  type DefenseCommitteeMember,
  type DefenseData,
} from "../api/client"
import { Badge, Button, Card, Icon, Modal, PageTitle } from "../components/common"

type AddModalKind = "institutional" | "external" | null

interface DefenseCommitteeProps {
  /** UUID da defesa cujos membros serão gerenciados. */
  defenseId: string
  goBack: () => void
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
}: DefenseCommitteeProps) {
  const [defense, setDefense] = useState<DefenseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [addModal, setAddModal] = useState<AddModalKind>(null)
  const [addError, setAddError] = useState("")
  const [addLoading, setAddLoading] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState("")

  // Estado do formulário — membro institucional
  const [instEmail, setInstEmail] = useState("")
  const [instRole, setInstRole] = useState("MEMBER")
  const [instLookupLoading, setInstLookupLoading] = useState(false)
  const [instLookupResult, setInstLookupResult] = useState<{
    id: string
    name: string
    email: string
  } | null>(null)
  const [instLookupError, setInstLookupError] = useState("")

  // Estado do formulário — membro externo
  const [extName, setExtName] = useState("")
  const [extEmail, setExtEmail] = useState("")
  const [extInstitution, setExtInstitution] = useState("")
  const [extRole, setExtRole] = useState("MEMBER")

  const mountedRef = useRef(true)

  const loadDefense = useCallback(() => {
    setLoading(true)
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
        if (mountedRef.current) setLoading(false)
      })
  }, [defenseId])

  useEffect(() => {
    mountedRef.current = true
    loadDefense()
    return () => {
      mountedRef.current = false
    }
  }, [loadDefense])

  const closeAddModal = () => {
    setAddModal(null)
    setAddError("")
    setInstEmail("")
    setInstRole("MEMBER")
    setInstLookupResult(null)
    setInstLookupError("")
    setExtName("")
    setExtEmail("")
    setExtInstitution("")
    setExtRole("MEMBER")
  }

  const lookupUser = async () => {
    if (!instEmail.trim()) return
    setInstLookupLoading(true)
    setInstLookupError("")
    setInstLookupResult(null)
    try {
      const result = await adminApi.lookupUser(instEmail.trim().toLowerCase())
      if (result.found && result.user) {
        setInstLookupResult(result.user)
      } else {
        setInstLookupError(result.message || "Usuário não encontrado.")
      }
    } catch (reason) {
      setInstLookupError(
        reason instanceof ApiError && reason.status === 403
          ? "Busca de usuários disponível apenas para administradores na rede institucional."
          : reason instanceof Error
            ? reason.message
            : "Não foi possível buscar o usuário.",
      )
    } finally {
      setInstLookupLoading(false)
    }
  }

  const addInstitutionalMember = async () => {
    if (!instLookupResult) return
    setAddLoading(true)
    setAddError("")
    try {
      await defenseApi.addInstitutionalMember(defenseId, {
        role: instRole,
        userId: instLookupResult.id,
      })
      closeAddModal()
      loadDefense()
    } catch (reason) {
      setAddError(
        reason instanceof Error ? reason.message : "Não foi possível adicionar o membro.",
      )
    } finally {
      setAddLoading(false)
    }
  }

  const addExternalMember = async () => {
    if (!extName.trim() || !extEmail.trim()) return
    setAddLoading(true)
    setAddError("")
    try {
      await defenseApi.addExternalMember(defenseId, {
        role: extRole,
        name: extName.trim(),
        email: extEmail.trim().toLowerCase(),
        institution: extInstitution.trim() || undefined,
      })
      closeAddModal()
      loadDefense()
    } catch (reason) {
      setAddError(
        reason instanceof Error ? reason.message : "Não foi possível adicionar o membro.",
      )
    } finally {
      setAddLoading(false)
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
  const canManage = isScheduled
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
        <Button variant="ghost" onClick={goBack}>
          Voltar
        </Button>
      </Card>

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

      {/* Modal — membro institucional */}
      {addModal === "institutional" && (
        <Modal className="admin-modal invite-modal">
          <div className="section-head">
            <div>
              <h2>Adicionar membro institucional</h2>
            </div>
            <button
              className="icon-btn"
              onClick={closeAddModal}
              aria-label="Fechar"
            >
              <Icon name="close" />
            </button>
          </div>

          {addError && (
            <div className="success-notice" role="alert">
              {addError}
            </div>
          )}

          <label className="field">
            <span>E-mail institucional</span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                type="email"
                value={instEmail}
                onChange={(e) => {
                  setInstEmail(e.target.value)
                  setInstLookupResult(null)
                  setInstLookupError("")
                }}
                placeholder="professor@ufvjm.edu.br"
              />
              <Button
                disabled={!instEmail.trim() || instLookupLoading}
                onClick={() => void lookupUser()}
              >
                {instLookupLoading ? "Buscando…" : "Buscar"}
              </Button>
            </div>
          </label>

          {instLookupError && (
            <div className="success-notice" role="alert">
              {instLookupError}
            </div>
          )}

          {instLookupResult && (
            <div className="institutional-banner session-banner">
              <div className="avatar">{instLookupResult.name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")}</div>
              <div>
                <strong>{instLookupResult.name}</strong>
                <span>{instLookupResult.email}</span>
              </div>
              <Badge tone="success">Encontrado</Badge>
            </div>
          )}

          <label className="field">
            <span>Papel na banca</span>
            <select
              value={instRole}
              onChange={(e) => setInstRole(e.target.value)}
            >
              {COMMITTEE_ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <div className="modal-actions">
            <Button variant="secondary" onClick={closeAddModal}>
              Cancelar
            </Button>
            <Button
              disabled={!instLookupResult || addLoading}
              onClick={() => void addInstitutionalMember()}
            >
              {addLoading ? "Adicionando…" : "Adicionar membro"}
            </Button>
          </div>
        </Modal>
      )}

      {/* Modal — membro externo */}
      {addModal === "external" && (
        <Modal className="admin-modal invite-modal">
          <div className="section-head">
            <div>
              <h2>Adicionar membro externo</h2>
            </div>
            <button
              className="icon-btn"
              onClick={closeAddModal}
              aria-label="Fechar"
            >
              <Icon name="close" />
            </button>
          </div>

          {addError && (
            <div className="success-notice" role="alert">
              {addError}
            </div>
          )}

          <label className="field">
            <span>Nome completo</span>
            <input
              value={extName}
              onChange={(e) => setExtName(e.target.value)}
              placeholder="Nome do avaliador"
            />
          </label>

          <label className="field">
            <span>E-mail</span>
            <input
              type="email"
              value={extEmail}
              onChange={(e) => setExtEmail(e.target.value)}
              placeholder="avaliador@email.com"
            />
          </label>

          <label className="field">
            <span>Instituição <small>(opcional)</small></span>
            <input
              value={extInstitution}
              onChange={(e) => setExtInstitution(e.target.value)}
              placeholder="Nome da instituição"
            />
          </label>

          <label className="field">
            <span>Papel na banca</span>
            <select
              value={extRole}
              onChange={(e) => setExtRole(e.target.value)}
            >
              {COMMITTEE_ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <div className="modal-actions">
            <Button variant="secondary" onClick={closeAddModal}>
              Cancelar
            </Button>
            <Button
              disabled={
                !extName.trim() || !extEmail.trim() || addLoading
              }
              onClick={() => void addExternalMember()}
            >
              {addLoading ? "Adicionando…" : "Adicionar e enviar convite"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
