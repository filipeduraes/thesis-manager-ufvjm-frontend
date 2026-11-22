import { useCallback, useEffect, useRef, useState } from "react"
import {
  adminApi,
  codeToProfile,
  profileToCode,
  type AdminCourse,
  type AdminUser,
  type ExternalInvitationRecord,
  type PaginatedResponse,
} from "../api/client"
import type { Profile, User } from "../types"
import { pageNumbers } from "../components/common/pagination"
import { Badge, Button, Card, Icon, Modal, PageTitle, RoleMultiSelect } from "../components/common"

type UserAction = "edit" | "remove" | null

const PAGE_SIZE = 10
const ROLE_OPTIONS: Profile[] = ["Aluno", "Orientador", "Coordenador", "Administrador"]

function toUser(user: AdminUser): User & { avatarUrl?: string | null; roles?: Array<{ code: string; label: string }> } {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: codeToProfile(user.roleCode),
    status: user.status,
    initials: user.initials,
    avatarUrl: user.avatarUrl,
    course: user.course ?? undefined,
    courseId: user.courseId ?? undefined,
    lastAccess: user.lastAccess ?? undefined,
    affiliation: "",
    roles: user.roles,
  }
}

function rolesFromUser(user: User & { roles?: Array<{ code: string; label: string }> }): Profile[] {
  const roles = (user.roles ?? [])
    .map((item) => codeToProfile(item.code))
    .filter((item, index, list) => list.indexOf(item) === index)
  return roles.length > 0 ? roles : [user.role]
}

function UserListAvatar({ url, initials }: { url?: string | null; initials: string }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    setFailed(false)
  }, [url])
  return (
    <div className="avatar small">
      {url && !failed ? (
        <img src={url} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      ) : (
        initials
      )}
    </div>
  )
}

interface AdminUsersProps {
  initialSearch?: string
}

export default function AdminUsers({ initialSearch = "" }: AdminUsersProps) {
  const [userPage, setUserPage] = useState<PaginatedResponse<AdminUser> | null>(null)
  const [courses, setCourses] = useState<AdminCourse[]>([])
  const [invitations, setInvitations] = useState<ExternalInvitationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState(initialSearch)
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch)
  const [roleFilter, setRoleFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(false)
  const [inviteModal, setInviteModal] = useState(false)
  const [inviteToken, setInviteToken] = useState("")
  const [institution, setInstitution] = useState("")
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<(User & { avatarUrl?: string | null; roles?: Array<{ code: string; label: string }> }) | null>(null)
  const [userAction, setUserAction] = useState<UserAction>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [selectedRoles, setSelectedRoles] = useState<Profile[]>(["Aluno"])
  const [status, setStatus] = useState<User["status"]>("Ativo")
  const [courseId, setCourseId] = useState("")
  const [notice, setNotice] = useState("")

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 400)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, roleFilter, statusFilter])

  const loadCourses = useCallback(async () => {
    try {
      const response = await adminApi.courses("?page_size=100")
      setCourses(response.results)
    } catch {
      setCourses([])
    }
  }, [])

  const loadRequestRef = useRef(0)

  const loadData = useCallback(async () => {
    const requestId = ++loadRequestRef.current
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set("search", debouncedSearch)
      if (roleFilter) params.set("role", roleFilter)
      if (statusFilter) params.set("status", statusFilter)
      params.set("page", String(page))
      params.set("page_size", String(PAGE_SIZE))
      const [usersResponse, invitationResponse] = await Promise.all([
        adminApi.users(`?${params.toString()}`),
        adminApi.invitations(),
      ])
      if (requestId !== loadRequestRef.current) return
      setUserPage(usersResponse)
      setInvitations(invitationResponse.results)
    } catch (reason) {
      if (requestId !== loadRequestRef.current) return
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar os usuários.")
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false)
    }
  }, [debouncedSearch, page, roleFilter, statusFilter])

  useEffect(() => { void loadCourses() }, [loadCourses])
  useEffect(() => {
    void loadData()
    return () => {
      loadRequestRef.current += 1
    }
  }, [loadData])

  const userList = (userPage?.results ?? []).map(toUser)

  const openUserAction = (user: User & { avatarUrl?: string | null; roles?: Array<{ code: string; label: string }> }, action: Exclude<UserAction, null>) => {
    setSelectedUser(user)
    setName(user.name)
    setEmail(user.email)
    setSelectedRoles(rolesFromUser(user))
    setStatus(user.status)
    setCourseId(user.courseId ?? "")
    setUserAction(action)
    setActiveMenu(null)
  }

  const closeUserAction = () => {
    setSelectedUser(null)
    setUserAction(null)
  }

  const saveUser = async () => {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    try {
      setError("")
      if (selectedRoles.length === 0) {
        setError("Selecione ao menos um perfil.")
        return
      }
      const roles = selectedRoles.map((item) => profileToCode[item])
      if (modal) {
        await adminApi.createUser({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          roles,
          courseId: courseId || null,
        })
        setModal(false)
        setNotice("Usuário criado com sucesso.")
        setPage(1)
        await loadData()
        return
      }
      if (selectedUser) {
        await adminApi.updateUser(selectedUser.id, {
          roles,
          is_active: status === "Ativo",
          courseId: courseId || null,
        })
        setNotice("Usuário atualizado com sucesso.")
        closeUserAction()
        await loadData()
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar o usuário.")
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const removeUser = async () => {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    if (!selectedUser) return
    try {
      setError("")
      await adminApi.deactivateUser(selectedUser.id)
      setNotice("Usuário desativado com sucesso.")
      closeUserAction()
      const nextPage = userList.length <= 1 && page > 1 ? page - 1 : page
      setPage(nextPage)
      if (nextPage === page) await loadData()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível desativar o usuário.")
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const createExternalInvitation = async () => {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    try {
      setError("")
      const result = await adminApi.createInvitation({ name, email, institution })
      setInviteToken(result.token)
      await loadData()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível criar o convite.")
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const revokeInvitation = async (id: string) => {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    try {
      setError("")
      await adminApi.revokeInvitation(id)
      await loadData()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível revogar o convite.")
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <div className="page-content">
      <PageTitle
        eyebrow="Administração"
        title="Gestão de usuários"
        action={
          <div>
            <Button icon="plus" onClick={() => { setName(""); setEmail(""); setSelectedRoles(["Aluno"]); setCourseId(""); setModal(true) }}>
              Adicionar usuário
            </Button>
            <Button variant="secondary" onClick={() => { setName(""); setEmail(""); setInstitution(""); setInviteToken(""); setInviteModal(true) }}>
              Convidar membro externo
            </Button>
          </div>
        }
      />
      {error && <div className="form-error" role="alert">{error}</div>}
      {notice && (
        <div className="success-notice" role="status">
          <Icon name="check" />
          <span>{notice}</span>
          <button className="icon-btn" onClick={() => setNotice("")} aria-label="Fechar aviso">
            <Icon name="close" size={15} />
          </button>
        </div>
      )}
      <Card className="user-filters">
        <div className="top-search">
          <Icon name="search" />
          <input
            placeholder="Buscar por nome ou e-mail"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
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
      </Card>
      <Card className="admin-table-card">
        <div className="admin-table users-table">
          <div className="admin-row admin-head">
            <span>Usuário</span>
            <span style={{ textAlign: "center" }}>Perfil</span>
            <span style={{ textAlign: "center" }}>Curso</span>
            <span>Status</span>
            <span>Último acesso</span>
            <span />
          </div>
          {loading ? <p>Carregando usuários…</p> : userList.map((user) => (
            <div className="admin-row" key={user.id}>
              <div className="user-cell">
                <UserListAvatar url={user.avatarUrl} initials={user.initials ?? "?"} />
                <div>
                  <strong>{user.name}</strong>
                  <span>{user.email}</span>
                </div>
              </div>
              <span data-label="Perfil" style={{ textAlign: "center" }}>
                {(user.roles?.length ? user.roles.map((item) => item.label) : [user.role]).join(", ")}
              </span>
              <span data-label="Curso" style={{ textAlign: "center" }}>{user.course || "—"}</span>
              <div className="user-status" data-label="Status">
                <Badge tone={user.status === "Ativo" ? "success" : "light"}>{user.status}</Badge>
              </div>
              <span data-label="Último acesso">{user.lastAccess ? new Date(user.lastAccess).toLocaleString("pt-BR") : "—"}</span>
              <div className="row-action">
                <button
                  className="icon-btn"
                  aria-label={`Ações de ${user.name}`}
                  aria-expanded={activeMenu === user.id}
                  onClick={() => setActiveMenu((current) => (current === user.id ? null : user.id))}
                >
                  <Icon name="more" />
                </button>
                {activeMenu === user.id && (
                  <div className="action-menu">
                    <button onClick={() => openUserAction(user, "edit")}>
                      <Icon name="edit" size={15} />
                      Editar usuário
                    </button>
                    <button className="danger" onClick={() => openUserAction(user, "remove")}>
                      <Icon name="trash" size={15} />
                      Remover usuário
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {!loading && userList.length === 0 && <p>Nenhum usuário encontrado.</p>}
        </div>
        <div className="pagination">
          <span>
            {userPage?.count ?? 0} usuários · página {userPage?.page ?? 1} de {Math.max(userPage?.totalPages ?? 1, 1)}
            {userPage && userPage.totalPages > 0 && userPage.page === userPage.totalPages
              ? ` · ${userPage.lastPageCount} nesta página`
              : ""}
          </span>
          <div>
            <Button variant="secondary" disabled={(userPage?.page ?? 1) <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
              Anterior
            </Button>
            {pageNumbers(userPage?.page ?? 1, Math.max(userPage?.totalPages ?? 1, 1)).map((item) => (
              <button
                key={item}
                className={`page-number ${item === (userPage?.page ?? 1) ? "active" : ""}`}
                onClick={() => setPage(item)}
              >
                {item}
              </button>
            ))}
            <Button variant="secondary" disabled={(userPage?.page ?? 1) >= (userPage?.totalPages ?? 1)} onClick={() => setPage((current) => current + 1)}>
              Próxima
            </Button>
          </div>
        </div>
      </Card>

      {modal && (
        <Modal className="admin-modal" labelledBy="user-modal-title" onClose={() => setModal(false)}>
          <div className="section-head">
            <div><h2 id="user-modal-title">Adicionar usuário</h2></div>
            <button className="icon-btn" onClick={() => setModal(false)} aria-label="Fechar"><Icon name="close" /></button>
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
            <div className="field">
              <span>Perfis de acesso</span>
              <RoleMultiSelect
                options={ROLE_OPTIONS.map((option) => ({ value: option, label: option }))}
                value={selectedRoles}
                onChange={(next) => setSelectedRoles(next as Profile[])}
                ariaLabel="Perfis de acesso"
              />
            </div>
            <label className="field">
              <span>Curso</span>
              <select value={courseId} onChange={(event) => setCourseId(event.target.value)}>
                <option value="">Sem curso</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.name} ({course.code})</option>
                ))}
              </select>
            </label>
          </div>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
            <Button disabled={saving || !name.trim() || !email.trim() || selectedRoles.length === 0} onClick={() => void saveUser()}>Criar usuário</Button>
          </div>
        </Modal>
      )}

      {userAction === "edit" && selectedUser && (
        <Modal className="admin-modal" labelledBy="user-modal-title" onClose={closeUserAction}>
          <div className="section-head">
            <div><h2 id="user-modal-title">Editar usuário</h2></div>
            <button className="icon-btn" onClick={closeUserAction} aria-label="Fechar"><Icon name="close" /></button>
          </div>
          <label className="field" title="Nome e e-mail são sincronizados pelo login institucional.">
            <span>Nome completo</span>
            <input
              value={name}
              readOnly
              disabled
              title="Nome e e-mail são sincronizados pelo login institucional."
              style={{ backgroundColor: "var(--line, #e5e7eb)", color: "var(--slate, #6b7280)", cursor: "not-allowed" }}
            />
          </label>
          <label className="field" title="Nome e e-mail são sincronizados pelo login institucional.">
            <span>E-mail</span>
            <input
              type="email"
              value={email}
              readOnly
              disabled
              title="Nome e e-mail são sincronizados pelo login institucional."
              style={{ backgroundColor: "var(--line, #e5e7eb)", color: "var(--slate, #6b7280)", cursor: "not-allowed" }}
            />
          </label>
          <div className="two-col">
            <div className="field">
              <span>Perfis de acesso</span>
              <RoleMultiSelect
                options={ROLE_OPTIONS.map((option) => ({ value: option, label: option }))}
                value={selectedRoles}
                onChange={(next) => setSelectedRoles(next as Profile[])}
                ariaLabel="Perfis de acesso"
              />
            </div>
            <label className="field">
              <span>Status</span>
              <select value={status} onChange={(event) => setStatus(event.target.value as User["status"])}>
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
              </select>
            </label>
          </div>
          <label className="field">
            <span>Curso</span>
            <select value={courseId} onChange={(event) => setCourseId(event.target.value)}>
              <option value="">Sem curso</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>{course.name} ({course.code})</option>
              ))}
            </select>
          </label>
          <div className="modal-actions">
            <Button variant="secondary" onClick={closeUserAction}>Cancelar</Button>
            <Button disabled={saving || selectedRoles.length === 0} onClick={() => void saveUser()}>Salvar alterações</Button>
          </div>
        </Modal>
      )}

      {userAction === "remove" && selectedUser && (
        <Modal className="admin-modal confirmation-modal" labelledBy="confirm-user-title" onClose={closeUserAction}>
          <div className="modal-icon danger"><Icon name="trash" /></div>
          <h2 id="confirm-user-title">Desativar usuário?</h2>
          <p>Esta ação desativará <strong>{selectedUser.name}</strong>. O usuário perderá o acesso imediatamente.</p>
          <div className="modal-actions">
            <Button variant="secondary" onClick={closeUserAction}>Cancelar</Button>
            <Button variant="danger" onClick={() => void removeUser()} disabled={saving}>Desativar usuário</Button>
          </div>
        </Modal>
      )}

      {inviteModal && (
        <Modal className="admin-modal" labelledBy="invite-modal-title" onClose={() => setInviteModal(false)}>
          <div className="section-head"><h2 id="invite-modal-title">Convite para membro externo</h2><button className="icon-btn" onClick={() => setInviteModal(false)} aria-label="Fechar"><Icon name="close" /></button></div>
          {!inviteToken ? <>
            <label className="field"><span>Nome completo</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label className="field"><span>E-mail</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label className="field"><span>Instituição</span><input value={institution} onChange={(event) => setInstitution(event.target.value)} /></label>
            <div className="modal-actions"><Button variant="secondary" onClick={() => setInviteModal(false)}>Cancelar</Button><Button disabled={saving || !name.trim() || !email.trim()} onClick={() => void createExternalInvitation()}>Gerar token</Button></div>
          </> : <>
            <p>Copie e entregue este token ao membro. Ele só será exibido nesta tela.</p>
            <strong>{inviteToken}</strong>
            <div className="modal-actions"><Button onClick={() => setInviteModal(false)}>Concluir</Button></div>
          </>}
        </Modal>
      )}

      {invitations.length > 0 && <Card className="admin-table-card"><h2>Convites externos</h2>{invitations.map((invitation) => <div className="admin-row" key={invitation.id}><strong>{invitation.name}</strong><span>{invitation.email}</span><span>{invitation.status}</span><span>{new Date(invitation.expiresAt).toLocaleDateString("pt-BR")}</span>{invitation.status !== "REVOKED" && <Button variant="danger" onClick={() => void revokeInvitation(invitation.id)} disabled={saving}>Revogar</Button>}</div>)}</Card>}
    </div>
  )
}
