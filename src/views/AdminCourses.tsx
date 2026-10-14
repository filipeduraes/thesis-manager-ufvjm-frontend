import { useState } from "react"
import { courses } from "../data/mockData"
import type { Course } from "../types"
import {
  Button,
  Card,
  Field,
  Icon,
  Modal,
  PageTitle,
  SelectField,
} from "../components/common"

type CourseAction = "edit" | "coordinator" | null

export default function AdminCourses() {
  // TODO: API Integration - GET /api/v1/admin/courses
  // Response: { courses: Course[], total: number }
  const [courseList, setCourseList] = useState<Course[]>(courses)
  const [addModal, setAddModal] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [courseAction, setCourseAction] = useState<CourseAction>(null)
  const [courseName, setCourseName] = useState("")
  const [courseCode, setCourseCode] = useState("")
  const [coordinator, setCoordinator] = useState("")
  const [notice, setNotice] = useState("")

  // TODO: API Integration - POST /api/v1/admin/courses
  // Request: { name, code, departmentId, coordinatorId }

  // TODO: API Integration - PATCH /api/v1/admin/courses/:courseCode
  // Request: { name?, code?, coordinatorId? }; Response: { course: Course }
  const openCourseAction = (
    course: Course,
    action: Exclude<CourseAction, null>,
  ) => {
    setSelectedCourse(course)
    setCourseName(course.name)
    setCourseCode(course.code)
    setCoordinator(course.coordinator)
    setCourseAction(action)
  }

  const closeCourseAction = () => {
    setSelectedCourse(null)
    setCourseAction(null)
  }

  const saveCourseDetails = () => {
    if (!selectedCourse) return
    setCourseList((current) =>
      current.map((course) =>
        course.code === selectedCourse.code
          ? { ...course, name: courseName, code: courseCode }
          : course,
      ),
    )
    setNotice("Dados do curso atualizados com sucesso.")
    closeCourseAction()
  }

  const saveCoordinator = () => {
    if (!selectedCourse) return
    setCourseList((current) =>
      current.map((course) =>
        course.code === selectedCourse.code
          ? { ...course, coordinator }
          : course,
      ),
    )
    setNotice("Coordenação reatribuída com sucesso.")
    closeCourseAction()
  }

  return (
    <div className="page-content">
      <PageTitle
        eyebrow="Administração"
        title="Gestão de cursos"
        action={
          <Button icon="plus" onClick={() => setAddModal(true)}>
            Adicionar curso
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
      <Card className="course-controls">
        <div className="top-search">
          <Icon name="search" />
          <input placeholder="Buscar curso ou código" />
        </div>
        <select>
          <option>Todos os departamentos</option>
          <option>Computação</option>
          <option>Ciências Básicas</option>
          <option>Humanidades</option>
        </select>
        <Button variant="secondary" icon="filter">
          Filtrar
        </Button>
      </Card>
      <div className="course-grid">
        {courseList.map((course) => (
          <Card className="course-card" key={course.code}>
            <div className="course-card-head">
              <div className="course-code">{course.code}</div>
              <button
                className="icon-btn"
                aria-label={`Editar ${course.name}`}
                onClick={() => openCourseAction(course, "edit")}
              >
                <Icon name="more" />
              </button>
            </div>
            <h2>{course.name}</h2>
            <div className="coordinator">
              <span>Coordenação</span>
              <strong>{course.coordinator}</strong>
            </div>
            <div className="course-metrics">
              <div>
                <strong>{course.activeStudents}</strong>
                <span>Alunos ativos</span>
              </div>
              <div>
                <strong>{course.publishedTheses}</strong>
                <span>TCCs publicados</span>
              </div>
            </div>
            <div className="course-actions">
              <Button
                variant="outline"
                onClick={() => openCourseAction(course, "edit")}
              >
                Editar curso
              </Button>
              <Button
                variant="ghost"
                onClick={() => openCourseAction(course, "coordinator")}
              >
                Reatribuir coordenação
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {addModal && (
        <Modal className="admin-modal">
          <div className="section-head">
            <div>
              <h2>Adicionar curso</h2>
            </div>
            <button
              className="icon-btn"
              onClick={() => setAddModal(false)}
              aria-label="Fechar"
            >
              <Icon name="close" />
            </button>
          </div>
          <div className="two-col">
            <Field
              label="Nome do curso"
              placeholder="Ex.: Engenharia de Sistemas"
            />
            <Field label="Código" placeholder="Ex.: ESI" />
          </div>
          <SelectField label="Departamento">
            Selecione o departamento
          </SelectField>
          <SelectField label="Coordenador responsável">
            Selecione um servidor
          </SelectField>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setAddModal(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setAddModal(false)}>Criar curso</Button>
          </div>
        </Modal>
      )}

      {courseAction === "edit" && selectedCourse && (
        <Modal className="admin-modal">
          <div className="section-head">
            <div>
              <h2>Editar curso</h2>
            </div>
            <button
              className="icon-btn"
              onClick={closeCourseAction}
              aria-label="Fechar"
            >
              <Icon name="close" />
            </button>
          </div>
          <div className="two-col">
            <label className="field">
              <span>Nome do curso</span>
              <input
                value={courseName}
                onChange={(event) => setCourseName(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Código</span>
              <input
                value={courseCode}
                onChange={(event) =>
                  setCourseCode(event.target.value.toUpperCase())
                }
              />
            </label>
          </div>
          <label className="field">
            <span>Coordenador atual</span>
            <input value={selectedCourse.coordinator} disabled />
          </label>
          <div className="modal-actions">
            <Button variant="secondary" onClick={closeCourseAction}>
              Cancelar
            </Button>
            <Button
              disabled={!courseName.trim() || !courseCode.trim()}
              onClick={saveCourseDetails}
            >
              Salvar alterações
            </Button>
          </div>
        </Modal>
      )}

      {courseAction === "coordinator" && selectedCourse && (
        <Modal className="admin-modal">
          <div className="section-head">
            <div>
              <h2>Reatribuir coordenação</h2>
            </div>
            <button
              className="icon-btn"
              onClick={closeCourseAction}
              aria-label="Fechar"
            >
              <Icon name="close" />
            </button>
          </div>
          <div className="selected-entity">
            <span>{selectedCourse.code}</span>
            <strong>{selectedCourse.name}</strong>
          </div>
          <label className="field">
            <span>Novo coordenador</span>
            <select
              value={coordinator}
              onChange={(event) => setCoordinator(event.target.value)}
            >
              <option>Prof. Ricardo Souza</option>
              <option>Profa. Helena Prado</option>
              <option>Profa. Carla Freitas</option>
              <option>Prof. Lucas Monteiro</option>
              <option>Profa. Júlia Mendes</option>
              <option>Prof. Mauro Lima</option>
            </select>
          </label>
          <div className="modal-actions">
            <Button variant="secondary" onClick={closeCourseAction}>
              Cancelar
            </Button>
            <Button onClick={saveCoordinator}>Confirmar reatribuição</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
