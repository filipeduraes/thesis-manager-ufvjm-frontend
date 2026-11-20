import { useCallback, useEffect, useState } from "react"
import {
  adminApi,
  type AdminCourse,
  type AdminDepartment,
  type PaginatedResponse,
  type UserLookupResult,
} from "../api/client"
import { Button, Card, Icon, Modal, PageTitle, UserFoundCard, UserSuggestInput } from "../components/common"
import { normalizeInstitutionalEmail, useUserLookup } from "../hooks/useUserLookup"

type CourseAction = "edit" | "delete" | null

const PAGE_SIZE = 10
const NEW_DEPARTMENT = "__new__"

function pageNumbers(current: number, total: number): number[] {
  const pages: number[] = []
  const start = Math.max(1, current - 2)
  const end = Math.min(total, start + 4)
  for (let page = Math.max(1, end - 4); page <= end; page += 1) pages.push(page)
  return pages
}

function coordinatorLabel(course: AdminCourse): string {
  if (course.coordinator?.name) return course.coordinator.name
  if (course.coordinatorEmail) return course.coordinatorEmail
  return "Sem coordenação"
}

function coordinatorHint(lookup: UserLookupResult | null, loading: boolean, error: string): string {
  if (loading) return "Verificando usuário…"
  if (error) return error
  if (!lookup) return ""
  return lookup.message
}

interface AdminCoursesProps {
  initialSearch?: string
  initialDepartmentId?: string
}

export default function AdminCourses({ initialSearch = "", initialDepartmentId = "" }: AdminCoursesProps) {
  const [coursePage, setCoursePage] = useState<PaginatedResponse<AdminCourse> | null>(null)
  const [departments, setDepartments] = useState<AdminDepartment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [search, setSearch] = useState(initialSearch)
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch)
  const [departmentFilter, setDepartmentFilter] = useState(initialDepartmentId)
  const [page, setPage] = useState(1)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [addModal, setAddModal] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState<AdminCourse | null>(null)
  const [courseAction, setCourseAction] = useState<CourseAction>(null)

  const [courseName, setCourseName] = useState("")
  const [courseCode, setCourseCode] = useState("")
  const [departmentId, setDepartmentId] = useState("")
  const [departmentName, setDepartmentName] = useState("")
  const [coordinatorEmail, setCoordinatorEmail] = useState("")
  const { lookup, loading: lookupLoading, error: lookupError } = useUserLookup(coordinatorEmail)
  const [saving, setSaving] = useState(false)

  const loadDepartments = useCallback(async () => {
    try {
      const response = await adminApi.departments()
      setDepartments(response.results)
    } catch {
      setDepartments([])
    }
  }, [])

  const loadCourses = useCallback(async (targetPage = page) => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set("search", debouncedSearch)
      if (departmentFilter) params.set("departmentId", departmentFilter)
      params.set("page", String(targetPage))
      params.set("page_size", String(PAGE_SIZE))
      const response = await adminApi.courses(`?${params.toString()}`)
      setCoursePage(response)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar os cursos.")
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, departmentFilter, page])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 400)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, departmentFilter])

  useEffect(() => { void loadDepartments() }, [loadDepartments])
  useEffect(() => { void loadCourses(page) }, [loadCourses, page])

  const courseList = coursePage?.results ?? []

  const resetForm = (course?: AdminCourse | null) => {
    setCourseName(course?.name ?? "")
    setCourseCode(course?.code ?? "")
    setDepartmentId(course?.departmentId ?? "")
    setDepartmentName("")
    setCoordinatorEmail(course?.coordinatorEmail ?? course?.coordinator?.email ?? "")
  }

  const closeModals = () => {
    setAddModal(false)
    setSelectedCourse(null)
    setCourseAction(null)
    setSaving(false)
    resetForm(null)
  }

  const openEdit = (course: AdminCourse) => {
    setSelectedCourse(course)
    resetForm(course)
    setCourseAction("edit")
    setActiveMenu(null)
  }

  const openDelete = (course: AdminCourse) => {
    setSelectedCourse(course)
    setCourseAction("delete")
    setActiveMenu(null)
  }

  const departmentPayload = () => {
    if (departmentId === NEW_DEPARTMENT) {
      return { departmentName: departmentName.trim() }
    }
    return { departmentId }
  }

  const createCourse = async () => {
    try {
      setSaving(true)
      setError("")
      await adminApi.createCourse({
        name: courseName.trim(),
        code: courseCode.trim().toUpperCase(),
        coordinatorEmail: normalizeInstitutionalEmail(coordinatorEmail),
        ...departmentPayload(),
      })
      setNotice("Curso criado com sucesso.")
      closeModals()
      await Promise.all([loadDepartments(), loadCourses(1)])
      setPage(1)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível criar o curso.")
      setSaving(false)
    }
  }

  const saveCourse = async () => {
    if (!selectedCourse) return
    try {
      setSaving(true)
      setError("")
      await adminApi.updateCourse(selectedCourse.id, {
        name: courseName.trim(),
        code: courseCode.trim().toUpperCase(),
        coordinatorEmail: normalizeInstitutionalEmail(coordinatorEmail),
        ...departmentPayload(),
      })
      setNotice("Curso atualizado com sucesso.")
      closeModals()
      await Promise.all([loadDepartments(), loadCourses(page)])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível atualizar o curso.")
      setSaving(false)
    }
  }

  const removeCourse = async () => {
    if (!selectedCourse) return
    try {
      setSaving(true)
      setError("")
      await adminApi.deleteCourse(selectedCourse.id)
      setNotice("Curso excluído com sucesso.")
      closeModals()
      const nextPage = courseList.length <= 1 && page > 1 ? page - 1 : page
      setPage(nextPage)
      await Promise.all([loadDepartments(), loadCourses(nextPage)])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível excluir o curso.")
      setSaving(false)
    }
  }

  const canSaveCourse =
    courseName.trim() &&
    courseCode.trim() &&
    (departmentId && (departmentId !== NEW_DEPARTMENT || departmentName.trim()))

  return (
    <div className="page-content">
      <PageTitle
        eyebrow="Administração"
        title="Gestão de cursos"
        action={
          <Button icon="plus" onClick={() => { resetForm(null); setAddModal(true) }}>
            Adicionar curso
          </Button>
        }
      />
      {error && <div className="success-notice" role="alert">{error}</div>}
      {notice && (
        <div className="success-notice" role="status">
          <Icon name="check" />
          <span>{notice}</span>
          <button className="icon-btn" onClick={() => setNotice("")} aria-label="Fechar aviso">
            <Icon name="close" size={15} />
          </button>
        </div>
      )}
      <Card className="course-controls">
        <div className="top-search">
          <Icon name="search" />
          <input
            placeholder="Buscar curso ou código"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
          <option value="">Todos os departamentos</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>{department.name}</option>
          ))}
        </select>
      </Card>

      {loading ? <Card><p>Carregando cursos…</p></Card> : (
        <div className="course-grid">
          {courseList.map((course) => (
            <Card className="course-card" key={course.id}>
              <div className="course-card-head">
                <div className="course-code">{course.code}</div>
                <div className="row-action">
                  <button
                    className="icon-btn"
                    aria-label={`Ações de ${course.name}`}
                    aria-expanded={activeMenu === course.id}
                    onClick={() => setActiveMenu((current) => (current === course.id ? null : course.id))}
                  >
                    <Icon name="more" />
                  </button>
                  {activeMenu === course.id && (
                    <div className="action-menu">
                      <button onClick={() => openEdit(course)}>
                        <Icon name="edit" size={15} />
                        Editar curso
                      </button>
                      <button className="danger" onClick={() => openDelete(course)}>
                        <Icon name="trash" size={15} />
                        Excluir curso
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <h2>{course.name}</h2>
              <div className="coordinator">
                <span>Departamento</span>
                <strong>{course.department?.name}</strong>
              </div>
              <div className="coordinator">
                <span>Coordenação</span>
                <strong>{coordinatorLabel(course)}</strong>
                {course.coordinatorEmail && (
                  <span>
                    {course.coordinatorStatus === "FOUND_ACTIVE" && "Usuário ativo no sistema"}
                    {course.coordinatorStatus === "FOUND_INACTIVE" && "Usuário encontrado, mas inativo"}
                    {course.coordinatorStatus === "PENDING" && "Usuário ainda não entrou no sistema"}
                  </span>
                )}
              </div>
              <div className="course-metrics">
                <div>
                  <strong>{course.activeStudents}</strong>
                  <span>Alunos associados</span>
                </div>
                <div>
                  <strong>{course.publishedTheses}</strong>
                  <span>TCCs publicados</span>
                </div>
              </div>
              <div className="course-actions">
                <Button variant="outline" onClick={() => openEdit(course)}>Editar curso</Button>
              </div>
            </Card>
          ))}
          {courseList.length === 0 && <Card><p>Nenhum curso encontrado.</p></Card>}
        </div>
      )}

      {coursePage && coursePage.totalPages > 1 && (
        <Card className="admin-table-card">
          <div className="pagination">
            <span>
              {coursePage.count} cursos · página {coursePage.page} de {coursePage.totalPages}
              {coursePage.page === coursePage.totalPages ? ` · ${coursePage.lastPageCount} nesta página` : ""}
            </span>
            <div>
              <Button variant="secondary" disabled={coursePage.page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Anterior</Button>
              {pageNumbers(coursePage.page, coursePage.totalPages).map((item) => (
                <button key={item} className={`page-number ${item === coursePage.page ? "active" : ""}`} onClick={() => setPage(item)}>{item}</button>
              ))}
              <Button variant="secondary" disabled={coursePage.page >= coursePage.totalPages} onClick={() => setPage((current) => current + 1)}>Próxima</Button>
            </div>
          </div>
        </Card>
      )}

      {(addModal || courseAction === "edit") && (
        <Modal className="admin-modal">
          <div className="section-head">
            <div><h2>{courseAction === "edit" ? "Editar curso" : "Adicionar curso"}</h2></div>
            <button className="icon-btn" onClick={closeModals} aria-label="Fechar"><Icon name="close" /></button>
          </div>
          <div className="two-col">
            <label className="field">
              <span>Nome do curso</span>
              <input value={courseName} onChange={(event) => setCourseName(event.target.value)} placeholder="Ex.: Engenharia de Sistemas" />
            </label>
            <label className="field">
              <span>Código</span>
              <input value={courseCode} onChange={(event) => setCourseCode(event.target.value.toUpperCase())} placeholder="Ex.: ESI" />
            </label>
          </div>
          <label className="field">
            <span>Departamento</span>
            <select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
              <option value="">Selecione o departamento</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>{department.name}</option>
              ))}
              <option value={NEW_DEPARTMENT}>Adicionar novo departamento…</option>
            </select>
          </label>
          {departmentId === NEW_DEPARTMENT && (
            <label className="field">
              <span>Novo departamento</span>
              <input value={departmentName} onChange={(event) => setDepartmentName(event.target.value)} placeholder="Nome do departamento" />
            </label>
          )}
          <div className="field">
            <label htmlFor="coordinatorEmail">
              <span>E-mail do coordenador responsável</span>
            </label>
            <UserSuggestInput
              id="coordinatorEmail"
              value={coordinatorEmail}
              onChange={setCoordinatorEmail}
              onBlur={() => {
                if (coordinatorEmail.trim()) setCoordinatorEmail(normalizeInstitutionalEmail(coordinatorEmail))
              }}
              onSelect={(user) => setCoordinatorEmail(user.email)}
              placeholder="nome.sobrenome ou nome.sobrenome@ufvjm.edu.br"
              autoComplete="email"
            />
            {coordinatorEmail.trim() && (
              <span className="field-hint" aria-live="polite">{coordinatorHint(lookup, lookupLoading, lookupError)}</span>
            )}
            {lookup?.found && lookup.user && (
              <UserFoundCard name={lookup.user.name} email={lookup.user.email} avatarUrl={lookup.user.avatarUrl} />
            )}
          </div>
          <div className="modal-actions">
            <Button variant="secondary" onClick={closeModals}>Cancelar</Button>
            <Button disabled={!canSaveCourse || saving} onClick={() => void (courseAction === "edit" ? saveCourse() : createCourse())}>
              {courseAction === "edit" ? "Salvar alterações" : "Criar curso"}
            </Button>
          </div>
        </Modal>
      )}

      {courseAction === "delete" && selectedCourse && (
        <Modal className="admin-modal confirmation-modal">
          <div className="modal-icon danger"><Icon name="trash" /></div>
          <h2>Excluir curso?</h2>
          <p>Esta ação removerá <strong>{selectedCourse.name} ({selectedCourse.code})</strong>. Associações de usuários com este curso serão removidas.</p>
          <div className="modal-actions">
            <Button variant="secondary" onClick={closeModals}>Cancelar</Button>
            <Button variant="danger" disabled={saving} onClick={() => void removeCourse()}>Excluir curso</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
