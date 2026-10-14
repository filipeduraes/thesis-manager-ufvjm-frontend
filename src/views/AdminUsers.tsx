import { useState } from "react"
import { users } from "../data/mockData"
import type { User, Profile } from "../types"
import {
  Badge,
  Button,
  Card,
  Icon,
  Modal,
  PageTitle,
  SelectField,
} from "../components/common"

type UserAction = "edit" | "remove" | null

export default function AdminUsers() {
  // TODO: API Integration - GET /api/v1/admin/users?role=&status=&search=
  // Response: { users: User[], pagination: PaginationMeta }
  const [userList, setUserList] = useState<User[]>(users)
  const [modal, setModal] = useState(false)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [userAction, setUserAction] = useState<UserAction>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("")
  const [status, setStatus] = useState<User["status"]>("Ativo")
  const [notice, setNotice] = useState("")

  // TODO: API Integration - POST /api/v1/admin/users
  // Request: { name, email, role, courseId }

  // TODO: API Integration - PATCH /api/v1/admin/users/:userId
  // TODO: API Integration - DELETE /api/v1/admin/users/:userId
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

  const saveUser = () => {
    if (!selectedUser) return
    setUserList((current) =>
      current.map((user) =>
        user.id === selectedUser.id
          ? {
              ...user,
              name,
              email,
              role: role as Profile,
              status,
              initials: name
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase())
                .join(""),
            }
          : user,
      ),
    )
    setNotice("Usuário atualizado com sucesso.")
    closeUserAction()
  }

  const removeUser = () => {
    if (!selectedUser) return
    setUserList((current) =>
      current.filter((user) => user.id !== selectedUser.id),
    )
    setNotice("Usuário removido com sucesso.")
    closeUserAction()
  }

  return (
    <div className="page-content">
      <PageTitle
        eyebrow="Administração"
        title="Gestão de usuários"
        action={
          <Button icon="plus" onClick={() => setModal(true)}>
            Adicionar usuário
          </Button>
        }
      />
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
          <input placeholder="Buscar por nome ou e-mail" />
        </div>
        <select>
          <option>Todos os perfis</option>
          <option>Aluno</option>
          <option>Professor</option>
          <option>Coordenador</option>
        </select>
        <select>
          <option>Todos os status</option>
          <option>Ativo</option>
          <option>Pendente</option>
        </select>
        <Button variant="secondary" icon="filter">
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
          {userList.map((user) => (
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
            Mostrando {userList.length} de {userList.length} usuários
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
            <input placeholder="Nome do usuário" />
          </label>
          <label className="field">
            <span>E-mail institucional</span>
            <input placeholder="usuario@ufvjm.edu.br" />
          </label>
          <div className="two-col">
            <SelectField label="Perfil de acesso">
              Selecione o perfil
            </SelectField>
            <SelectField label="Curso vinculado">Selecione o curso</SelectField>
          </div>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setModal(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setModal(false)}>Enviar convite</Button>
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
              onChange={(event) => setEmail(event.target.value)}
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
                <option>Professor</option>
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
                <option>Pendente</option>
              </select>
            </label>
          </div>
          <div className="modal-actions">
            <Button variant="secondary" onClick={closeUserAction}>
              Cancelar
            </Button>
            <Button disabled={!name.trim() || !email.trim()} onClick={saveUser}>
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
            Esta ação removerá <strong>{selectedUser.name}</strong> do sistema.
            O usuário perderá o acesso imediatamente.
          </p>
          <div className="modal-actions">
            <Button variant="secondary" onClick={closeUserAction}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={removeUser}>
              Remover usuário
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
