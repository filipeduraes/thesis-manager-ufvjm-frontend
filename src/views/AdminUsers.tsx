import { useCallback, useEffect, useState } from "react"
import {
  adminApi,
  codeToProfile,
  profileToCode,
  type ExternalInvitationRecord,
} from "../api/client"
import type { User, Profile } from "../types"
import {
  Badge,
  Button,
  Card,
  Icon,
  Modal,
  PageTitle,
} from "../components/common"

type UserAction = "edit" | "remove" | null

export default function AdminUsers() {
  const [userList, setUserList] = useState<User[]>([])
  const [invitations, setInvitations] = useState<ExternalInvitationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [modal, setModal] = useState(false)
  const [inviteModal, setInviteModal] = useState(false)
  const [inviteToken, setInviteToken] = useState("")
  const [institution, setInstitution] = useState("")
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [userAction, setUserAction] = useState<UserAction>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("")
  const [status, setStatus] = useState<User["status"]>("Ativo")
  const [notice, setNotice] = useState("")

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (roleFilter) params.set("role", roleFilter)
      if (statusFilter) params.set("status", statusFilter)
      const query = params.size ? `?${params.toString()}` : ""
      const [usersResponse, invitationResponse] = await Promise.all([
        adminApi.users(query),
        adminApi.invitations(),
      ])
      setUserList(usersResponse.results.map((user) => ({
        ...user,
        role: codeToProfile(user.roleCode),
        status: user.status,
        course: user.course ?? undefined,
        lastAccess: user.lastAccess ?? undefined,
        affiliation: "",
      })))
      setInvitations(invitationResponse.results)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar os usuários.")
    } finally {
      setLoading(false)
    }
  }, [search, roleFilter, statusFilter])

  useEffect(() => { void loadData() }, [loadData])

  const openUserAction = (user: User, action: Exclude<UserAction, null>) => {
    setSelectedUser(user)
    setName(user.name)
    setEmail(user.email)
    setRole(user.role)
    setStatus(user.status)
    setUserAction(action)
    setActiveMenu(null)
  }

  const closeUserAction = () => {
    setSelectedUser(null)
    setUserAction(null)
  }

  const saveUser = async () => {
    try {
      if (modal) {
        await adminApi.createUser({ name, email, roles: [profileToCode[role as Profile]] })
        setModal(false)
        setNotice("Usuário criado com sucesso.")
      } else if (selectedUser) {
        await adminApi.updateUser(selectedUser.id, {
          name,
          roles: [profileToCode[role as Profile]],
          is_active: status === "Ativo",
        })
        setNotice("Usuário atualizado com sucesso.")
        closeUserAction()
      }
      await loadData()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar o usuário.")
    }
  }

  const removeUser = async () => {
    if (!selectedUser) return
    try {
      await adminApi.deactivateUser(selectedUser.id)
      setNotice("Usuário desativado com sucesso.")
      closeUserAction()
      await loadData()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível desativar o usuário.")
    }
  }

  const createExternalInvitation = async () => {
    try {
      const result = await adminApi.createInvitation({ name, email, institution })
      setInviteToken(result.token)
      await loadData()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível criar o convite.")
    }
  }

  const revokeInvitation = async (id: string) => {
    try {
      await adminApi.revokeInvitation(id)
      await loadData()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível revogar o convite.")
    }
  }

  return (
    <div className="page-content">
      <PageTitle
        eyebrow="Administração"
        title="Gestão de usuários"
        action={
          <div>
            <Button icon="plus" onClick={() => { setName(""); setEmail(""); setRole("Aluno"); setModal(true) }}>
              Adicionar usuário
            </Button>
            <Button variant="secondary" onClick={() => { setName(""); setEmail(""); setInstitution(""); setInviteToken(""); setInviteModal(true) }}>
              Convidar membro externo
            </Button>
          </div>
        }
      />
      {error && <div className="success-notice" role="alert">{error}</div>}
      {notice && (
        <div className="success-notice" role="status">
          <Icon name="check" />
          <span>{notice}</span>
          <button
            className="icon-btn"
            onClick={() => setNotice("")}
            aria-label="Fechar aviso"
          >
            <Icon name="close" size={15} />
          </button>
        </div>
      )}
      <Card className="user-filters">
        <div className="top-search">
          <Icon name="search" />
          <input placeholder="Buscar por nome ou e-mail" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
          <option value="">Todos os perfis</option>
          <option value="Aluno">Aluno</option>
          <option value="Orientador">Orientador</option>
          <option value="Coordenador">Coordenador</option>
          <option value="Administrador">Administrador</option>
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">Todos os status</option>
          <option value="Ativo">Ativo</option>
          <option value="Inativo">Inativo</option>
        </select>
        <Button variant="secondary" icon="filter" onClick={() => void loadData()}>
          Filtrar
        </Button>
      </Card>
      <Card className="admin-table-card">
        <div className="admin-table users-table">
          <div className="admin-row admin-head">
            <span>Usuário</span>
            <span>Perfil</span>
            <span>Curso</span>
            <span>Status</span>
            <span>Último acesso</span>
            <span />
          </div>
          {loading ? <p>Carregando usuários…</p> : userList.map((user) => (
            <div className="admin-row" key={user.id}>
              <div className="user-cell">
                <div className="avatar small">{user.initials}</div>
                <div>
                  <strong>{user.name}</strong>
                  <span>{user.email}</span>
                </div>
              </div>
              <span data-label="Perfil">{user.role}</span>
              <span data-label="Curso">{user.course}</span>
              <div className="user-status" data-label="Status">
                <Badge tone={user.status === "Ativo" ? "success" : "light"}>
                  {user.status}
                </Badge>
              </div>
              <span data-label="Último acesso">{user.lastAccess}</span>
              <div className="row-action">
                <button
                  className="icon-btn"
                  aria-label={`Ações de ${user.name}`}
                  aria-expanded={activeMenu === user.id}
                  onClick={() =>
                    setActiveMenu((current) =>
                      current === user.id ? null : user.id,
                    )
                  }
                >
                  <Icon name="more" />
                </button>
                {activeMenu === user.id && (
                  <div className="action-menu">
                    <button onClick={() => openUserAction(user, "edit")}>
                      <Icon name="edit" size={15} />
                      Editar usuário
                    </button>
                    <button
                      className="danger"
                      onClick={() => openUserAction(user, "remove")}
                    >
                      <Icon name="trash" size={15} />
                      Remover usuário
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="pagination">
          <span>
            {userList.length} usuários
          </span>
          <div>
            <Button variant="secondary">Anterior</Button>
            <button className="page-number active">1</button>
            <Button variant="secondary">Próxima</Button>
          </div>
        </div>
      </Card>

      {modal && (
        <Modal className="admin-modal">
          <div className="section-head">
            <div>
              <h2>Adicionar usuário</h2>
            </div>
            <button
              className="icon-btn"
              onClick={() => setModal(false)}
              aria-label="Fechar"
            >
              <Icon name="close" />
            </button>
          </div>
          <label className="field">
            <span>Nome completo</span>
            <input placeholder="Nome do usuário" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="field">
            <span>E-mail institucional</span>
            <input type="email" placeholder="usuario@ufvjm.edu.br" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <div className="two-col">
            <label className="field"><span>Perfil de acesso</span><select value={role} onChange={(event) => setRole(event.target.value)}><option>Aluno</option><option>Orientador</option><option>Coordenador</option><option>Administrador</option></select></label>
          </div>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setModal(false)}>
              Cancelar
            </Button>
            <Button disabled={!name.trim() || !email.trim()} onClick={() => void saveUser()}>Criar usuário</Button>
          </div>
        </Modal>
      )}

      {userAction === "edit" && selectedUser && (
        <Modal className="admin-modal">
          <div className="section-head">
            <div>
              <h2>Editar usuário</h2>
            </div>
            <button
              className="icon-btn"
              onClick={closeUserAction}
              aria-label="Fechar"
            >
              <Icon name="close" />
            </button>
          </div>
          <label className="field">
            <span>Nome completo</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="field">
            <span>E-mail</span>
            <input
              type="email"
              value={email}
              readOnly
            />
          </label>
          <div className="two-col">
            <label className="field">
              <span>Perfil de acesso</span>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
              >
                <option>Aluno</option>
                <option>Orientador</option>
                <option>Coordenador</option>
                <option>Administrador</option>
              </select>
            </label>
            <label className="field">
              <span>Status</span>
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as User["status"])
                }
              >
                <option>Ativo</option>
                <option>Inativo</option>
              </select>
            </label>
          </div>
          <div className="modal-actions">
            <Button variant="secondary" onClick={closeUserAction}>
              Cancelar
            </Button>
            <Button disabled={!name.trim()} onClick={() => void saveUser()}>
              Salvar alterações
            </Button>
          </div>
        </Modal>
      )}

      {userAction === "remove" && selectedUser && (
        <Modal className="admin-modal confirmation-modal">
          <div className="modal-icon danger">
            <Icon name="trash" />
          </div>
          <h2>Remover usuário?</h2>
          <p>
            Esta ação desativará <strong>{selectedUser.name}</strong>. O usuário perderá o acesso imediatamente.
          </p>
          <div className="modal-actions">
            <Button variant="secondary" onClick={closeUserAction}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => void removeUser()}>
              Desativar usuário
            </Button>
          </div>
        </Modal>
      )}

      {inviteModal && (
        <Modal className="admin-modal">
          <div className="section-head"><h2>Convite para membro externo</h2><button className="icon-btn" onClick={() => setInviteModal(false)} aria-label="Fechar"><Icon name="close" /></button></div>
          {!inviteToken ? <>
            <label className="field"><span>Nome completo</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label className="field"><span>E-mail</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label className="field"><span>Instituição</span><input value={institution} onChange={(event) => setInstitution(event.target.value)} /></label>
            <div className="modal-actions"><Button variant="secondary" onClick={() => setInviteModal(false)}>Cancelar</Button><Button disabled={!name.trim() || !email.trim()} onClick={() => void createExternalInvitation()}>Gerar token</Button></div>
          </> : <>
            <p>Copie e entregue este token ao membro. Ele só será exibido nesta tela.</p>
            <strong>{inviteToken}</strong>
            <div className="modal-actions"><Button onClick={() => setInviteModal(false)}>Concluir</Button></div>
          </>}
        </Modal>
      )}

      {invitations.length > 0 && <Card className="admin-table-card"><h2>Convites externos</h2>{invitations.map((invitation) => <div className="admin-row" key={invitation.id}><strong>{invitation.name}</strong><span>{invitation.email}</span><span>{invitation.status}</span><span>{new Date(invitation.expiresAt).toLocaleDateString("pt-BR")}</span>{invitation.status !== "REVOKED" && <Button variant="danger" onClick={() => void revokeInvitation(invitation.id)}>Revogar</Button>}</div>)}</Card>}
    </div>
  )
}
