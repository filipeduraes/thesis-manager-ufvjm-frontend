import type { Page } from "../types"
import { Button, Icon, Logo } from "../components/common"

export default function LoginView({ go }: { go: (p: Page) => void }) {
  return (
    <main className="login-page">
      <section className="login-brand">
        <Logo dark />
        <div className="brand-copy">
          <h1>Repositório e Gestão de Monografias</h1>
          <p>
            Sistema de submissão, avaliação e publicação de trabalhos de
            conclusão de curso.
          </p>
        </div>
        <div className="brand-footer">
          <span>Universidade Federal dos Vales do Jequitinhonha e Mucuri</span>
          <a
            href="https://portal.ufvjm.edu.br/"
            target="_blank"
            rel="noreferrer"
          >
            Acessar portal da UFVJM <Icon name="arrow" size={13} />
          </a>
        </div>
      </section>
      <section className="login-form-area">
        <div className="login-card">
          <h2 className="login-access-title">ACESSO AO SISTEMA</h2>
          <Button onClick={() => go("dashboard")}>
            Entrar com conta institucional <Icon name="arrow" size={16} />
          </Button>
          <div className="divider">
            <span>ou</span>
          </div>
          <div className="token-box">
            <div>
              <strong>Sou membro de banca externo</strong>
              <p>Use o token temporário enviado por e-mail.</p>
            </div>
            <div className="token-row">
              <input placeholder="Ex.: UFVJM-8H4K-22" />
              <Button variant="secondary" onClick={() => go("evaluation")}>
                Acessar com token
              </Button>
            </div>
          </div>
          <button
            className="text-link repo-link"
            onClick={() => go("repository")}
          >
            Ir para o repositório público <Icon name="arrow" size={14} />
          </button>
        </div>
      </section>
    </main>
  )
}
