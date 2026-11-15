import { Badge, Button, Card, Icon, Logo } from "../components/common"

const EXPIRATION_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
})

interface ExternalEvaluationProps {
  goLogin: () => void
  externalSession?: {
    name: string
    email: string
    institution: string
    expiresAt: string
  } | null
}

/**
 * Landing screen for external committee members authenticated by invitation token.
 *
 * The session payload does not identify the defense yet, and `GET /api/v1/defenses`
 * answers 403 for external sessions, so this screen only confirms the session.
 */
export default function ExternalEvaluation({ goLogin, externalSession }: ExternalEvaluationProps) {
  return (
    <main className="external-workspace">
      <header className="external-header">
        <Logo />
        <span>Acesso temporário de banca</span>
        <Button variant="ghost" icon="logout" onClick={goLogin}>
          Encerrar sessão
        </Button>
      </header>
      <div className="external-content">
        {externalSession ? (
          <>
            <div className="institutional-banner session-banner">
              <Icon name="lock" />
              <div>
                <strong>Sessão autenticada</strong>
                <span>
                  {externalSession.name} · {externalSession.email}
                </span>
                {externalSession.institution && <span>{externalSession.institution}</span>}
              </div>
              <Badge tone="success">Ativa</Badge>
            </div>
            <Card className="evaluation-form">
              <h1>Acesso de membro externo confirmado</h1>
              <p>
                A sessão expira em {EXPIRATION_FORMATTER.format(new Date(externalSession.expiresAt))}. A sessão
                ainda não informa qual banca você integra, então esta tela não registra pareceres.
              </p>
            </Card>
          </>
        ) : (
          <Card className="evaluation-form">
            <h1>Dados do convite indisponíveis</h1>
            <p role="alert">
              Não foi possível carregar os dados do seu convite. Encerre a sessão e entre novamente com o token
              recebido.
            </p>
          </Card>
        )}
      </div>
    </main>
  )
}
