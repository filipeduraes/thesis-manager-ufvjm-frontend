import type {
  AdvisorSubmission,
  AuditLog,
  Course,
  RepositoryWork,
  Thesis,
  User,
} from "../types"

export const activities = [
  ["Versão 2 enviada", "Hoje, 09:42", "file"],
  ["Parecer adicionado por Prof. Ricardo", "Ontem, 16:18", "users"],
  ["Banca confirmada por 2 membros", "12 jun, 14:05", "calendar"],
] as const

export const submissionDetails: Record<string, Pick<Thesis, "title" | "course">> =
  {
    "Marina Alves": {
      title: "Arquiteturas sustentáveis para cidades inteligentes",
      course: "Engenharia de Sistemas",
    },
    "João Ribeiro": {
      title: "Gestão pública e transformação digital",
      course: "Administração",
    },
    "Lívia Santos": {
      title: "Conservação de espécies nativas do Cerrado",
      course: "Ciências Biológicas",
    },
    "Paulo Mendes": {
      title: "Educação inclusiva no ensino superior",
      course: "Pedagogia",
    },
  }

export const repositoryWorks: RepositoryWork[] = [
  {
    title: "Tecnologias sociais para gestão hídrica no Vale do Jequitinhonha",
    author: "Camila Nunes",
    advisor: "Profa. Helena Prado",
    course: "Engenharia Ambiental",
    type: "Monografia",
    year: "2024",
    abstract:
      "Este estudo analisa tecnologias sociais de baixo custo aplicadas à gestão hídrica em comunidades rurais do Vale do Jequitinhonha. A pesquisa combina levantamento bibliográfico, entrevistas com moradores e análise de iniciativas comunitárias para identificar soluções replicáveis de captação, armazenamento e uso responsável da água.",
    tags: ["Gestão hídrica", "Tecnologia social"],
    uri: "https://acervo.ufvjm.edu.br/handle/123456789/1842",
    doi: "10.5281/ufvjm.2024.1842",
  },
  {
    title: "Educação patrimonial e memória no Alto Jequitinhonha",
    author: "Rafael Costa",
    advisor: "Prof. Mauro Lima",
    course: "História",
    type: "Artigo",
    journal: "Revista Brasileira de Educação Patrimonial",
    year: "2024",
    abstract:
      "A pesquisa investiga práticas de educação patrimonial e sua contribuição para preservar a memória regional no Alto Jequitinhonha. O artigo documenta ações realizadas com escolas, associações culturais e acervos comunitários, destacando a participação social como elemento central para a valorização do patrimônio local.",
    tags: ["Patrimônio", "Educação"],
    uri: "https://acervo.ufvjm.edu.br/handle/123456789/1796",
    doi: "10.22409/rbep.v19i2.1796",
  },
  {
    title: "Inteligência artificial aplicada ao diagnóstico por imagem",
    author: "Beatriz Rocha",
    advisor: "Profa. Carla Freitas",
    course: "Sistemas de Informação",
    type: "Monografia",
    year: "2023",
    abstract:
      "Uma avaliação comparativa de modelos de aprendizagem de máquina utilizados como apoio ao diagnóstico por imagem. O trabalho analisa precisão, sensibilidade, requisitos computacionais e limitações éticas de diferentes arquiteturas, propondo critérios para sua adoção responsável em contextos clínicos.",
    tags: ["Inteligência artificial", "Saúde"],
    uri: "https://acervo.ufvjm.edu.br/handle/123456789/1651",
    doi: "10.5281/ufvjm.2023.1651",
  },
]

export const users: User[] = [
  {
    id: "202510284",
    name: "Ana Martins",
    email: "ana.martins@ufvjm.edu.br",
    role: "Aluno",
    affiliation: "Engenharia de Sistemas",
    status: "Ativo",
  },
  {
    id: "SERV-2048",
    name: "Ricardo Souza",
    email: "ricardo.souza@ufvjm.edu.br",
    role: "Orientador",
    affiliation: "Departamento de Computação",
    status: "Ativo",
  },
  {
    id: "SERV-2049",
    name: "Carla Freitas",
    email: "carla.freitas@ufvjm.edu.br",
    role: "Coordenador",
    affiliation: "Ciências Biológicas",
    status: "Ativo",
  },
  {
    id: "SERV-2050",
    name: "Mauro Lima",
    email: "mauro.lima@ufvjm.edu.br",
    role: "Orientador",
    affiliation: "Departamento de Humanidades",
    status: "Inativo",
  },
]

export const courses: Course[] = [
  {
    name: "Engenharia de Sistemas",
    code: "ESI",
    coordinator: "Prof. Ricardo Souza",
    activeStudents: 186,
    publishedTheses: 248,
  },
  {
    name: "Administração",
    code: "ADM",
    coordinator: "Profa. Helena Prado",
    activeStudents: 312,
    publishedTheses: 386,
  },
  {
    name: "Ciências Biológicas",
    code: "CBI",
    coordinator: "Profa. Carla Freitas",
    activeStudents: 224,
    publishedTheses: 291,
  },
  {
    name: "Engenharia Ambiental",
    code: "EAM",
    coordinator: "Prof. Lucas Monteiro",
    activeStudents: 158,
    publishedTheses: 204,
  },
  {
    name: "Pedagogia",
    code: "PED",
    coordinator: "Profa. Júlia Mendes",
    activeStudents: 341,
    publishedTheses: 418,
  },
  {
    name: "História",
    code: "HIS",
    coordinator: "Prof. Mauro Lima",
    activeStudents: 196,
    publishedTheses: 267,
  },
]

export const auditEvents: AuditLog[] = [
  {
    timestamp: "17 jun 2025 · 10:42:18",
    actor: "Ricardo Souza",
    role: "Orientador",
    action: "Aprovou submissão para banca",
    entityId: "TCC-2025-0148",
    origin: "VPN institucional",
    hash: "a91e4f02",
  },
  {
    timestamp: "17 jun 2025 · 10:38:04",
    actor: "Serviço de arquivos",
    role: "Sistema",
    action: "Validou integridade do PDF",
    entityId: "FILE-88421",
    origin: "Rede interna",
    hash: "f3b8c2d7",
  },
  {
    timestamp: "17 jun 2025 · 10:31:52",
    actor: "Ana Martins",
    role: "Aluno",
    action: "Atualizou metadados do rascunho",
    entityId: "TCC-2025-0148",
    origin: "VPN institucional",
    hash: "12cd8a91",
  },
  {
    timestamp: "17 jun 2025 · 10:18:33",
    actor: "Carla Freitas",
    role: "Coordenador",
    action: "Reagendou banca de defesa",
    entityId: "DEF-2025-0092",
    origin: "Rede interna",
    hash: "77ae401c",
  },
  {
    timestamp: "17 jun 2025 · 09:54:10",
    actor: "Lucas Monteiro",
    role: "Membro externo",
    action: "Registrou avaliação final",
    entityId: "EVAL-2025-448",
    origin: "IP verificado",
    hash: "09bc31fd",
  },
  {
    timestamp: "17 jun 2025 · 09:41:27",
    actor: "Administrador UFVJM",
    role: "Administrador",
    action: "Atualizou perfil institucional",
    entityId: "USR-2048",
    origin: "VPN institucional",
    hash: "ce82a118",
  },
]

export const advisorReviewQueue = [
  {
    student: "Marina Alves",
    thesis: "Arquiteturas sustentáveis para cidades inteligentes",
    deadline: "Enviada há 2 dias",
  },
  {
    student: "João Ribeiro",
    thesis: "Gestão pública e transformação digital",
    deadline: "Prazo amanhã",
  },
  {
    student: "Lívia Santos",
    thesis: "Conservação de espécies nativas do Cerrado",
    deadline: "Enviada há 5 dias",
  },
]

export const activeAdvisees = [
  {
    student: "Marina Alves",
    status: "Em avaliação",
    defense: "27 jun · defesa",
  },
  { student: "João Ribeiro", status: "Em ajustes", defense: "Sem banca" },
  { student: "Lívia Santos", status: "Aprovada", defense: "02 jul · defesa" },
  { student: "Paulo Mendes", status: "Rascunho", defense: "Sem banca" },
]

export const coordinatorQueue = [
  {
    student: "Marina Alves",
    course: "Engenharia de Sistemas",
    approvedAt: "Aprovada em 18 jun",
  },
  {
    student: "Carlos Nunes",
    course: "Administração",
    approvedAt: "Aprovada em 17 jun",
  },
  {
    student: "Beatriz Rocha",
    course: "Ciências Biológicas",
    approvedAt: "Aprovada em 16 jun",
  },
]

export const systemServices = [
  { name: "API principal", metric: "24 ms" },
  { name: "Extração de PDF", metric: "4 na fila" },
  { name: "Cache Redis", metric: "38% memória" },
  { name: "Fila de mensagens", metric: "12 eventos" },
  { name: "Serviço de e-mail", metric: "99,9%" },
  { name: "Autenticação", metric: "18 ms" },
]

export const auditSnippet = [
  { time: "10:42", event: "Ricardo Souza aprovou TCC-2025-0148" },
  { time: "10:38", event: "Sistema validou SHA-256 do arquivo #0148" },
  { time: "10:31", event: "Ana Martins atualizou metadados" },
  { time: "10:18", event: "Coordenação reagendou banca #0092" },
]

export const advisorSubmissions: AdvisorSubmission[] = [
  {
    student: "Marina Alves",
    title: "Arquiteturas sustentáveis para cidades inteligentes",
    course: "Eng. Sistemas",
    submittedAt: "17 jun",
    status: "Em avaliação",
    version: "v2",
  },
  {
    student: "João Ribeiro",
    title: "Gestão pública e transformação digital",
    course: "Administração",
    submittedAt: "14 jun",
    status: "Rascunho",
    version: "v1",
  },
  {
    student: "Lívia Santos",
    title: "Conservação de espécies nativas do Cerrado",
    course: "Ciências Biológicas",
    submittedAt: "10 jun",
    status: "Aprovada",
    version: "v3",
  },
  {
    student: "Paulo Mendes",
    title: "Educação inclusiva no ensino superior",
    course: "Pedagogia",
    submittedAt: "02 jun",
    status: "Reprovada",
    version: "v2",
  },
]

export const reportBars = [72, 58, 84, 46, 64, 38]

export const advisorStats = [
  { name: "Ricardo Souza", percentage: 86 },
  { name: "Carla Freitas", percentage: 72 },
  { name: "Helena Prado", percentage: 60 },
  { name: "Mauro Lima", percentage: 48 },
]
