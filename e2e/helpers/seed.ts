import { expect, type APIRequestContext } from "@playwright/test"
import { uniqueEmail } from "./auth"

const API_ROOT = process.env.E2E_API_URL ?? "http://localhost:8001/api/v1"

/** PDF com bytes únicos por teste: o cadastro de acervo recusa PDFs já usados. */
export async function uniquePdfBuffer(): Promise<Buffer> {
  const base = await readFixture()
  return Buffer.concat([base, Buffer.from(`\n% e2e-${Date.now()}-${Math.random().toString(36).slice(2)}\n`)])
}

export interface SeededThesis {
  courseId: string
  courseCode: string
  advisorEmail: string
  studentEmail: string
  coordinatorEmail: string
  thesisId: string
  title: string
}

interface SessionBody {
  csrfToken: string
  user: { id: string }
}

export async function devLogin(request: APIRequestContext, name: string, email: string, role: string): Promise<{ csrfToken: string; userId: string }> {
  let lastError = ""
  for (let attempt = 0; attempt < 3; attempt += 1) {
    // Ao trocar de usuário no mesmo contexto, a sessão anterior ainda está ativa
    // e o DRF exige CSRF; a leitura de /session fornece o token atual.
    const sessionResponse = await request.get(`${API_ROOT}/session`)
    expect(sessionResponse.ok()).toBeTruthy()
    const current = (await sessionResponse.json()) as SessionBody

    const response = await request.post(`${API_ROOT}/auth/dev-login`, {
      headers: { "X-CSRFToken": current.csrfToken },
      data: { name, email, roles: [role] },
    })
    if (response.ok()) {
      const body = (await response.json()) as SessionBody
      return { csrfToken: body.csrfToken, userId: body.user.id }
    }
    lastError = await response.text()
  }
  throw new Error(`Falha no dev-login de ${email}: ${lastError}`)
}

/**
 * Prepara o mínimo de dados relacionais necessário para os fluxos de TCC.
 *
 * A criação de usuários/cursos é feita via API apenas como pré-condição; os
 * testes validam as operações pela interface. Cada chamada usa identificadores
 * únicos para permitir execução paralela e repetida.
 */
export interface InProgressDefense {
  thesis: SeededThesis
  defenseId: string
  memberId: string
  evaluatorEmail: string
}

/**
 * Schedule a defense and leave it IN_PROGRESS with one non-alternate evaluator.
 */
export async function seedInProgressDefense(request: APIRequestContext, title: string): Promise<InProgressDefense> {
  const thesis = await seedApprovedThesis(request, title)
  const advisor = await devLogin(request, "Orientador E2E Defesa", thesis.advisorEmail, "ADVISOR")
  const review = await request.post(`${API_ROOT}/theses/${thesis.thesisId}/reviews`, {
    headers: { "X-CSRFToken": advisor.csrfToken },
    data: { decision: "APPROVED", comments: "Aprovado para banca." },
  })
  expect(review.ok(), await review.text()).toBeTruthy()

  const coordinator = await devLogin(request, "Coord E2E Defesa", thesis.coordinatorEmail, "COORDINATOR")
  const coordinatorHeaders = { "X-CSRFToken": coordinator.csrfToken }
  const when = new Date()
  when.setDate(when.getDate() + 1)
  const defenseResponse = await request.post(`${API_ROOT}/theses/${thesis.thesisId}/defenses`, {
    headers: coordinatorHeaders,
    data: {
      scheduledDatetime: when.toISOString(),
      durationMinutes: 90,
      modality: "IN_PERSON",
      location: "Sala E2E",
    },
  })
  expect(defenseResponse.ok(), await defenseResponse.text()).toBeTruthy()
  const defense = (await defenseResponse.json()) as { defense: { id: string } }

  const evaluatorEmail = uniqueEmail("evaluator")
  const evaluator = await devLogin(request, "Avaliador E2E", evaluatorEmail, "ADVISOR")
  const coordinatorAgain = await devLogin(request, "Coord E2E Defesa", thesis.coordinatorEmail, "COORDINATOR")
  const memberResponse = await request.post(`${API_ROOT}/defenses/${defense.defense.id}/members`, {
    headers: { "X-CSRFToken": coordinatorAgain.csrfToken },
    data: { userId: evaluator.userId, role: "MEMBER" },
  })
  expect(memberResponse.ok(), await memberResponse.text()).toBeTruthy()
  const member = (await memberResponse.json()) as { member: { id: string } }

  const evaluatorAgain = await devLogin(request, "Avaliador E2E", evaluatorEmail, "ADVISOR")
  const availability = await request.post(`${API_ROOT}/defenses/${defense.defense.id}/members/${member.member.id}/availability`, {
    headers: { "X-CSRFToken": evaluatorAgain.csrfToken },
    data: { status: "CONFIRMED" },
  })
  expect(availability.ok(), await availability.text()).toBeTruthy()
  const coordinatorForStart = await devLogin(request, "Coord E2E Defesa", thesis.coordinatorEmail, "COORDINATOR")
  const start = await request.post(`${API_ROOT}/defenses/${defense.defense.id}/start`, { headers: { "X-CSRFToken": coordinatorForStart.csrfToken } })
  expect(start.ok(), await start.text()).toBeTruthy()

  return { thesis, defenseId: defense.defense.id, memberId: member.member.id, evaluatorEmail }
}

export interface AcademicContext {
  courseId: string
  courseCode: string
  advisorEmail: string
  advisorId: string
  coordinatorEmail: string
}

export async function seedAcademicContext(request: APIRequestContext): Promise<AcademicContext> {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`

  const adminEmail = uniqueEmail("seed-admin")
  const adminSession = await devLogin(request, "Seed Admin E2E", adminEmail, "ADMIN")
  const adminHeaders = { "X-CSRFToken": adminSession.csrfToken }

  const departmentResponse = await request.post(`${API_ROOT}/admin/departments`, {
    headers: adminHeaders,
    data: { name: `Departamento E2E ${suffix}` },
  })
  expect(departmentResponse.ok(), await departmentResponse.text()).toBeTruthy()
  const department = (await departmentResponse.json()) as { id: string }

  // O código é único sem distinção de maiúsculas e tem no máximo 20 caracteres.
  // Usar só o fim do sufixo deixava apenas a parte aleatória e repetia códigos
  // na mesma execução; o carimbo de tempo em base 36 mais o sorteio evita isso.
  const randomPart = Math.floor(Math.random() * 36 ** 4).toString(36).padStart(4, "0")
  const courseCode = `E2E${Date.now().toString(36)}${randomPart}`.toUpperCase()
  const courseResponse = await request.post(`${API_ROOT}/admin/courses`, {
    headers: adminHeaders,
    data: {
      name: `Curso E2E ${suffix}`,
      code: courseCode,
      departmentId: department.id,
      coordinatorEmail: "",
    },
  })
  expect(courseResponse.ok(), await courseResponse.text()).toBeTruthy()
  const course = (await courseResponse.json()) as { id: string }

  const advisorEmail = uniqueEmail("advisor")
  const advisorSession = await devLogin(request, "Orientador E2E", advisorEmail, "ADVISOR")

  const coordinatorEmail = uniqueEmail("coordinator")
  await devLogin(request, "Coordenador E2E", coordinatorEmail, "COORDINATOR")
  const freshAdmin = await devLogin(request, "Seed Admin E2E", adminEmail, "ADMIN")
  const assignResponse = await request.patch(`${API_ROOT}/admin/courses/${course.id}`, {
    headers: { "X-CSRFToken": freshAdmin.csrfToken },
    data: {
      name: `Curso E2E ${suffix}`,
      code: courseCode,
      departmentId: department.id,
      coordinatorEmail,
    },
  })
  expect(assignResponse.ok(), await assignResponse.text()).toBeTruthy()

  return {
    courseId: course.id,
    courseCode,
    advisorEmail,
    advisorId: advisorSession.userId,
    coordinatorEmail,
  }
}

export async function seedApprovedThesis(request: APIRequestContext, title: string): Promise<SeededThesis> {
  const academic = await seedAcademicContext(request)
  const studentEmail = uniqueEmail("student")
  const studentSession = await devLogin(request, "Aluno E2E", studentEmail, "STUDENT")
  const studentHeaders = { "X-CSRFToken": studentSession.csrfToken }

  const metadataResponse = await request.put(`${API_ROOT}/theses/me`, {
    headers: studentHeaders,
    data: {
      title,
      abstract: "Resumo do trabalho de teste end-to-end.",
      courseId: academic.courseId,
      advisorId: academic.advisorId,
      keywords: ["teste", "e2e"],
    },
  })
  expect(metadataResponse.ok(), await metadataResponse.text()).toBeTruthy()
  const metadata = (await metadataResponse.json()) as { thesis: { id: string } }

  const uploadResponse = await request.post(`${API_ROOT}/theses/me/files`, {
    headers: studentHeaders,
    multipart: {
      file: {
        name: "tcc-e2e.pdf",
        mimeType: "application/pdf",
        buffer: await readFixture(),
      },
    },
  })
  expect(uploadResponse.ok(), await uploadResponse.text()).toBeTruthy()
  await waitForTextExtraction(request, studentHeaders)

  const submitResponse = await request.post(`${API_ROOT}/theses/me/submit`, { headers: studentHeaders })
  expect(submitResponse.ok(), await submitResponse.text()).toBeTruthy()

  return {
    courseId: academic.courseId,
    courseCode: academic.courseCode,
    advisorEmail: academic.advisorEmail,
    coordinatorEmail: academic.coordinatorEmail,
    studentEmail,
    thesisId: metadata.thesis.id,
    title,
  }
}


async function waitForTextExtraction(request: APIRequestContext, headers: Record<string, string>): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const response = await request.get(`${API_ROOT}/theses/me`, { headers })
    const body = (await response.json()) as { thesis?: { currentFile?: { storedFile?: { processingStatus?: string } } } }
    const status = body.thesis?.currentFile?.storedFile?.processingStatus
    if (status === "COMPLETED" || status === "FAILED") return
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error("A extração de texto do PDF de teste não concluiu a tempo.")
}

async function readFixture(): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = await import("node:fs")
  const path = await import("node:path")
  return fs.readFileSync(path.join(__dirname, "../fixtures/minimal.pdf"))
}


/**
 * Leva uma monografia até o status PUBLICADA usando a API apenas como
 * pré-condição, para validar a busca e o detalhe do repositório público pela
 * interface.
 */
export async function seedPublishedThesis(request: APIRequestContext, title: string): Promise<SeededThesis> {
  const thesis = await seedApprovedThesis(request, title)

  const advisor = await devLogin(request, "Orientador E2E Publicação", thesis.advisorEmail, "ADVISOR")
  const review = await request.post(`${API_ROOT}/theses/${thesis.thesisId}/reviews`, {
    headers: { "X-CSRFToken": advisor.csrfToken },
    data: { decision: "APPROVED", comments: "Aprovado para publicação." },
  })
  expect(review.ok(), await review.text()).toBeTruthy()

  const admin = await devLogin(request, "Admin E2E Publicação", uniqueEmail("publish-admin"), "ADMIN")
  const adminHeaders = { "X-CSRFToken": admin.csrfToken }

  const result = await request.post(`${API_ROOT}/theses/${thesis.thesisId}/defense-result`, {
    headers: adminHeaders,
    data: { result: "APPROVED" },
  })
  expect(result.ok(), await result.text()).toBeTruthy()

  const documentResponse = await request.post(`${API_ROOT}/theses/${thesis.thesisId}/documents`, {
    headers: adminHeaders,
    multipart: {
      type: "PUBLICATION_AUTHORIZATION",
      file: {
        name: "autorizacao-e2e.pdf",
        mimeType: "application/pdf",
        buffer: await readFixture(),
      },
    },
  })
  expect(documentResponse.ok(), await documentResponse.text()).toBeTruthy()
  const document = (await documentResponse.json()) as { document: { id: string } }

  const validate = await request.post(`${API_ROOT}/theses/${thesis.thesisId}/documents/${document.document.id}/validate`, {
    headers: adminHeaders,
  })
  expect(validate.ok(), await validate.text()).toBeTruthy()

  const publish = await request.post(`${API_ROOT}/theses/${thesis.thesisId}/publish`, { headers: adminHeaders })
  expect(publish.ok(), await publish.text()).toBeTruthy()

  return thesis
}
