import { useState } from "react"
import { adminApi } from "../api/client"
import {
  approvedTheses,
  committeeMembers,
  presentedDefenses,
} from "../data/mockData"
import type { CommitteeMember, Thesis } from "../types"
import {
  Badge,
  Button,
  Card,
  Field,
  Icon,
  Modal,
  PageTitle,
} from "../components/common"

type InviteStep = "form" | "sent" | null

interface DefenseSchedulingProps {
  canEvaluate?: boolean
  onEvaluate?: (defenseId: string) => void
  onOpenCommittee?: (defenseId: string) => void
  evaluatedDefenseIds?: string[]
}

export default function DefenseScheduling({
  canEvaluate = false,
  onEvaluate,
  onOpenCommittee,
  evaluatedDefenseIds = [],
}: DefenseSchedulingProps) {
  // TODO: API Integration - GET /api/v1/defenses/availability
  // Response: { members: CommitteeMember[], conflicts: ScheduleConflict[] }
  const [remote, setRemote] = useState(false)
  const [valid, setValid] = useState(false)
  const [selectedThesis, setSelectedThesis] = useState<Thesis | null>(null)
  const [selectionOpen, setSelectionOpen] = useState(false)
  const [committee, setCommittee] =
    useState<CommitteeMember[]>(committeeMembers)
  const [inviteStep, setInviteStep] = useState<InviteStep>(null)
  const [inviteName, setInviteName] = useState("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [generatedToken, setGeneratedToken] = useState("")
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState("")
  const [activeView, setActiveView] = useState<"schedule" | "presented">(
    "schedule",
  )

  // TODO: API Integration - POST /api/v1/defenses
  // Request: { thesisId, date, time, mode, location, committeeIds }

  const [defenseUuid, setDefenseUuid] = useState("")

  // Integração parcial: criação de token externo (vínculo com banca/defesa virá no fluxo de bancas).
  const sendExternalInvite = async () => {
    setInviteLoading(true)
    setInviteError("")
    try {
      const result = await adminApi.createInvitation({
        name: inviteName.trim(),
        email: inviteEmail.trim().toLowerCase(),
        institution: "",
      })
      const initials = inviteName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("")

      setGeneratedToken(result.token)
      setCommittee((current) => [
        ...current,
        {
          initials: initials || "EX",
          name: inviteName.trim(),
          role: `Membro externo · convite criado para ${inviteEmail.trim().toLowerCase()}`,
          status: "Pendente",
        },
      ])
      setInviteStep("sent")
    } catch (reason) {
      setInviteError(reason instanceof Error ? reason.message : "Não foi possível gerar o token.")
    } finally {
      setInviteLoading(false)
    }
  }

  const closeInvite = () => {
    setInviteStep(null)
    setInviteName("")
    setInviteEmail("")
    setGeneratedToken("")
    setInviteError("")
  }

  return (
    <div className="page-content">
      <PageTitle
        eyebrow="Gestão de bancas"
        title={
          activeView === "schedule"
            ? "Agendar banca de defesa"
            : "Bancas apresentadas"
        }
      />
      {canEvaluate && (
        <div className="defense-tabs" role="tablist">
          <button
            className={activeView === "schedule" ? "active" : ""}
            onClick={() => setActiveView("schedule")}
            role="tab"
            aria-selected={activeView === "schedule"}
          >
            Agendamento
          </button>
          <button
            className={activeView === "presented" ? "active" : ""}
            onClick={() => setActiveView("presented")}
            role="tab"
            aria-selected={activeView === "presented"}
          >
            Bancas apresentadas
            <Badge tone="light">
              {
                presentedDefenses.filter(
                  (defense) =>
                    !defense.evaluated &&
                    !evaluatedDefenseIds.includes(defense.id),
                ).length
              }
            </Badge>
          </button>
        </div>
      )}

      {activeView === "presented" ? (
        <div className="presented-defense-list">
          <Card className="presented-intro">
            <div>
              <Icon name="check" />
            </div>
            <span>
              Consulte as defesas das quais você participou e registre seu
              parecer individual.
            </span>
          </Card>
          {presentedDefenses.map((defense) => {
            const evaluated =
              defense.evaluated || evaluatedDefenseIds.includes(defense.id)

            return (
              <Card className="presented-defense" key={defense.id}>
                <div className="defense-date">
                  <Icon name="calendar" />
                  <span>{defense.date}</span>
                </div>
                <div className="presented-defense-copy">
                  <span className="course">{defense.course}</span>
                  <h3>{defense.thesis}</h3>
                  <p>
                    {defense.student} · Participação: {defense.role}
                  </p>
                </div>
                <Badge tone={evaluated ? "success" : "light"}>
                  {evaluated ? "Avaliação registrada" : "Avaliação pendente"}
                </Badge>
                <Button
                  variant={evaluated ? "secondary" : "outline"}
                  disabled={evaluated}
                  onClick={() => onEvaluate?.(defense.id)}
                >
                  {evaluated ? "Parecer enviado" : "Adicionar avaliação"}
                </Button>
                {onOpenCommittee && (
                  <Button
                    variant="ghost"
                    onClick={() => onOpenCommittee(defense.id)}
                  >
                    Membros
                  </Button>
                )}
              </Card>
            )
          })}

          {/* Acesso direto a uma banca pelo UUID — para integração e testes com o backend */}
          <Card>
            <div className="section-head">
              <div>
                <p className="eyebrow">Acesso direto</p>
                <h3>Abrir banca pelo ID</h3>
              </div>
            </div>
            <label className="field">
              <span>UUID da banca</span>
              <input
                value={defenseUuid}
                onChange={(e) => setDefenseUuid(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </label>
            <div className="form-actions">
              <Button
                variant="outline"
                disabled={!defenseUuid.trim()}
                onClick={() => onEvaluate?.(defenseUuid.trim())}
              >
                Avaliar
              </Button>
              {onOpenCommittee && (
                <Button
                  variant="outline"
                  disabled={!defenseUuid.trim()}
                  onClick={() => onOpenCommittee(defenseUuid.trim())}
                >
                  Gerenciar membros
                </Button>
              )}
            </div>
          </Card>
        </div>
      ) : (
        <>
          <Card className="thesis-summary">
            <div className="file-icon">
              <Icon name="file" />
            </div>
            <div>
              {selectedThesis ? (
                <>
                  <h3>{selectedThesis.title}</h3>
                  <span>
                    {selectedThesis.student} · {selectedThesis.course}
                  </span>
                </>
              ) : (
                <>
                  <h3>Selecione uma monografia aprovada</h3>
                  <span>{approvedTheses.length} trabalhos disponíveis</span>
                </>
              )}
            </div>
            {selectedThesis && (
              <Badge tone="success">
                <Icon name="check" size={12} /> Aprovada pelo orientador
              </Badge>
            )}
            <Button
              variant={selectedThesis ? "ghost" : "outline"}
              onClick={() => setSelectionOpen(true)}
            >
              {selectedThesis ? "Alterar" : "Selecionar"}
            </Button>
          </Card>

          <div className="schedule-layout">
            <div className="stack">
              <Card>
                <h2>Dados da defesa</h2>
                <div className="three-col schedule-fields">
                  <Field label="Data" type="date" value="2025-06-27" />
                  <Field
                    label="Horário"
                    type="time"
                    value={valid ? "15:30" : "14:00"}
                  />
                  <label className="field">
                    <span>Modalidade</span>
                    <div className="segmented">
                      <button
                        className={!remote ? "active" : ""}
                        onClick={() => setRemote(false)}
                      >
                        Presencial
                      </button>
                      <button
                        className={remote ? "active" : ""}
                        onClick={() => setRemote(true)}
                      >
                        Remota
                      </button>
                    </div>
                  </label>
                </div>
                <Field
                  label={
                    remote ? "Link da videoconferência" : "Local da defesa"
                  }
                  placeholder={
                    remote ? "https://meet.google.com/..." : "Sala / prédio"
                  }
                  value={remote ? "" : "Sala 204 · Prédio 2"}
                />
              </Card>

              <Card>
                <div className="section-head">
                  <div>
                    <h2>Comissão avaliadora</h2>
                  </div>
                  <Button
                    variant="outline"
                    icon="plus"
                    onClick={() => setInviteStep("form")}
                  >
                    Convidar externo
                  </Button>
                </div>
                <div className="member-list">
                  {committee.map((member) => (
                    <div key={`${member.name}-${member.role}`}>
                      <div className="avatar">{member.initials}</div>
                      <div>
                        <strong>{member.name}</strong>
                        <span>{member.role}</span>
                      </div>
                      <Badge
                        tone={
                          member.status === "Confirmado" ? "success" : "light"
                        }
                      >
                        {member.status}
                      </Badge>
                      <button
                        className="icon-btn"
                        aria-label={`Opções de ${member.name}`}
                      >
                        <Icon name="more" />
                      </button>
                    </div>
                  ))}
                </div>
                <Button variant="secondary" icon="plus">
                  Adicionar membro interno
                </Button>
              </Card>
            </div>

            <aside className="conflict-panel">
              <Card className="sticky-panel">
                <p className="eyebrow">Verificação em tempo real</p>
                <h2>{valid ? "Horário disponível" : "Conflito detectado"}</h2>
                <div className={`conflict-message ${valid ? "resolved" : ""}`}>
                  <Icon name={valid ? "check" : "alert"} />
                  <div>
                    <strong>
                      {valid
                        ? "Todos os membros disponíveis"
                        : "Prof. Ricardo está indisponível"}
                    </strong>
                    <span>
                      {valid
                        ? "27 jun, 15:30"
                        : "Banca de Júlia Mendes · 27 jun, 14:00–15:00"}
                    </span>
                  </div>
                </div>
                {!valid && (
                  <div className="alternatives">
                    <strong>Horários sugeridos</strong>
                    <button onClick={() => setValid(true)}>
                      <span>27 jun · 15:30</span>
                      <Badge tone="success">Todos disponíveis</Badge>
                    </button>
                    <button onClick={() => setValid(true)}>
                      <span>28 jun · 09:00</span>
                      <Badge tone="light">Sala 105</Badge>
                    </button>
                  </div>
                )}
                <div className="validation-list">
                  <div className={selectedThesis ? "ok" : ""}>
                    <Icon name={selectedThesis ? "check" : "clock"} />
                    <span>
                      <strong>Trabalho aprovado</strong>
                      <small>
                        {selectedThesis
                          ? selectedThesis.id
                          : "Selecione uma monografia"}
                      </small>
                    </span>
                  </div>
                  <div className="ok">
                    <Icon name="check" />
                    <span>
                      <strong>Local disponível</strong>
                      <small>Sala 204</small>
                    </span>
                  </div>
                  <div className={valid ? "ok" : ""}>
                    <Icon name={valid ? "check" : "clock"} />
                    <span>
                      <strong>Disponibilidade da banca</strong>
                      <small>
                        {valid
                          ? `${committee.length} membros disponíveis`
                          : "Conflito pendente"}
                      </small>
                    </span>
                  </div>
                </div>
                <Button disabled={!valid || !selectedThesis} variant="success">
                  Confirmar agendamento
                </Button>
                <Button variant="ghost">Cancelar</Button>
              </Card>
            </aside>
          </div>
        </>
      )}

      {selectionOpen && (
        <Modal className="admin-modal selection-modal">
          <div className="section-head">
            <div>
              <h2>Selecionar monografia</h2>
            </div>
            <button
              className="icon-btn"
              onClick={() => setSelectionOpen(false)}
              aria-label="Fechar"
            >
              <Icon name="close" />
            </button>
          </div>
          <div className="selection-list">
            {approvedTheses.map((thesis) => (
              <button
                key={thesis.id}
                className={selectedThesis?.id === thesis.id ? "selected" : ""}
                onClick={() => {
                  setSelectedThesis(thesis)
                  setSelectionOpen(false)
                }}
              >
                <div>
                  <strong>{thesis.title}</strong>
                  <span>
                    {thesis.student} · {thesis.course}
                  </span>
                </div>
                <Badge tone="success">Aprovada</Badge>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {inviteStep && (
        <Modal className="admin-modal invite-modal">
          {inviteStep === "form" ? (
            <>
              <div className="section-head">
                <div>
                  <h2>Convidar membro externo</h2>
                </div>
                <button
                  className="icon-btn"
                  onClick={closeInvite}
                  aria-label="Fechar"
                >
                  <Icon name="close" />
                </button>
              </div>
              {inviteError && <div className="success-notice" role="alert">{inviteError}</div>}
              <label className="field">
                <span>Nome completo</span>
                <input
                  value={inviteName}
                  onChange={(event) => setInviteName(event.target.value)}
                  placeholder="Nome do avaliador"
                />
              </label>
              <label className="field">
                <span>E-mail</span>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="avaliador@email.com"
                />
              </label>
              <div className="modal-actions">
                <Button variant="secondary" onClick={closeInvite}>
                  Cancelar
                </Button>
                <Button
                  disabled={!inviteName.trim() || !inviteEmail.trim() || inviteLoading}
                  onClick={() => void sendExternalInvite()}
                >
                  {inviteLoading ? "Gerando…" : "Gerar token de acesso"}
                </Button>
              </div>
            </>
          ) : (
            <div className="invite-success">
              <div className="modal-icon">
                <Icon name="check" />
              </div>
              <h2>Token gerado</h2>
              <p>
                Copie e entregue este token ao membro externo (<strong>{inviteEmail}</strong>). Ele será exibido apenas uma vez.
              </p>
              <div className="token-result">
                <span>Token de acesso</span>
                <code>{generatedToken}</code>
              </div>
              <Button onClick={closeInvite}>Concluir</Button>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
