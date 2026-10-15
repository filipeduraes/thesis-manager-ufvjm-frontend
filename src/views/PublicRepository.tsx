import { useState } from "react"
import type { Page } from "../types"
import { repositoryWorks } from "../data/mockData"
import {
  Badge,
  Button,
  Icon,
  Logo,
  Pagination,
  SelectField,
} from "../components/common"

export default function PublicRepository({
  go,
  embedded = false,
}: {
  go: (p: Page) => void
  embedded?: boolean
}) {
  // TODO: API Integration - GET /api/v1/repository/theses
  // Query: { q, course, startYear, endYear, tags }; Response: { items, total }
  const [query, setQuery] = useState("")
  const [empty, setEmpty] = useState(false)
  const [selectedWork, setSelectedWork] =
    useState<typeof repositoryWorks[number] | null>(null)
  return (
    <div className="public-page">
      {!embedded && (
        <header className="public-header">
          <Logo />
          <nav>
            <button>Repositório</button>
            <button>Sobre</button>
            <a
              href="https://portal.ufvjm.edu.br/"
              target="_blank"
              rel="noreferrer"
            >
              Portal da UFVJM
            </a>
            <button onClick={() => go("login")}>Entrar</button>
          </nav>
        </header>
      )}
      <section className="repo-hero">
        <div>
          <div className="repo-hero-copy">
            <h1>Repositório de Monografias</h1>
            <div className="hero-search">
              <Icon name="search" size={22} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Busque por título, autor, orientador ou palavra-chave"
              />
              <Button
                onClick={() => setEmpty(query.toLowerCase().includes("vazio"))}
              >
                Pesquisar
              </Button>
            </div>
          </div>
        </div>
      </section>
      <main className="repo-main">
        <aside className="filters">
          <div className="section-head">
            <div>
              <p className="eyebrow">Refinar busca</p>
              <h3>Filtros</h3>
            </div>
            <button className="text-link">Limpar</button>
          </div>
          <SelectField label="Curso">Todos os cursos</SelectField>
          <label className="field">
            <span>Ano de defesa</span>
            <div className="year-range">
              <select defaultValue="2020">
                <option>2020</option>
                <option>2021</option>
                <option>2022</option>
              </select>
              <span>até</span>
              <select defaultValue="2025">
                <option>2025</option>
                <option>2024</option>
                <option>2023</option>
              </select>
            </div>
          </label>
          <div className="field">
            <span>Temas</span>
            <div className="tag-cloud">
              <button>Sustentabilidade</button>
              <button>Educação</button>
              <button>Saúde</button>
              <button>Tecnologia</button>
              <button>Gestão</button>
            </div>
          </div>
          <Button>Aplicar filtros</Button>
        </aside>
        <section className="results">
          <div className="results-head">
            <div>
              <p className="eyebrow">Resultados</p>
              <h2>{empty ? "0" : "248"} monografias encontradas</h2>
            </div>
            <select>
              <option>Ordenar: Relevância</option>
              <option>Mais recentes</option>
              <option>Título A–Z</option>
            </select>
          </div>
          {empty ? (
            <div className="empty-state">
              <div>
                <Icon name="search" size={28} />
              </div>
              <h2>Nenhum resultado encontrado</h2>
              <p>Tente remover filtros ou usar termos mais abrangentes.</p>
              <Button variant="secondary" onClick={() => setEmpty(false)}>
                Limpar busca
              </Button>
            </div>
          ) : (
            <div className="work-list">
              {repositoryWorks.map((w) => (
                <article className="work-card" key={w.title}>
                  <div className="work-year">
                    <strong>{w.year}</strong>
                    <span>Defesa</span>
                  </div>
                  <div>
                    <span className="course">{w.course}</span>
                    <h3>{w.title}</h3>
                    <p className="work-meta">
                      <strong>{w.author}</strong> · Orientação: {w.advisor}
                    </p>
                    <p>{w.abstract}</p>
                    <div className="tags">
                      {w.tags.map((t) => (
                        <Badge tone="light" key={t}>
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="work-actions">
                    <Button
                      variant="secondary"
                      onClick={() => setSelectedWork(w)}
                    >
                      Ver detalhes
                    </Button>
                    <Button variant="ghost" icon="download">
                      Baixar PDF
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
          {!empty && <Pagination />}
        </section>
      </main>
      {selectedWork && (
        <div className="drawer-backdrop" onClick={() => setSelectedWork(null)}>
          <aside className="detail-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <Badge tone="success">Publicada</Badge>
              <button
                className="icon-btn"
                onClick={() => setSelectedWork(null)}
                aria-label="Fechar detalhes"
              >
                <Icon name="close" />
              </button>
            </div>
            <span className="course">{selectedWork.course}</span>
            <h2>{selectedWork.title}</h2>
            <p className="drawer-author">
              {selectedWork.author} · Orientação: {selectedWork.advisor}
            </p>
            <hr />
            <dl className="drawer-metadata">
              <div>
                <dt>Tipo de trabalho</dt>
                <dd>{selectedWork.type}</dd>
              </div>
              <div>
                <dt>Ano de publicação</dt>
                <dd>{selectedWork.year}</dd>
              </div>
              {selectedWork.type === "Artigo" && (
                <div className="wide">
                  <dt>Revista</dt>
                  <dd>{selectedWork.journal}</dd>
                </div>
              )}
            </dl>
            <h4>Resumo</h4>
            <p>{selectedWork.abstract}</p>
            <h4>Palavras-chave</h4>
            <div className="drawer-keywords">
              {selectedWork.tags.map((tag) => (
                <Badge tone="light" key={tag}>
                  {tag}
                </Badge>
              ))}
            </div>
            <h4>Identificadores</h4>
            <dl className="identifier-list">
              <div>
                <dt>URI</dt>
                <dd>
                  <a href={selectedWork.uri}>{selectedWork.uri}</a>
                </dd>
              </div>
              <div>
                <dt>DOI</dt>
                <dd>
                  <a href={`https://doi.org/${selectedWork.doi}`}>
                    {selectedWork.doi}
                  </a>
                </dd>
              </div>
            </dl>
            <h4>Comissão avaliadora</h4>
            <ul>
              <li>Prof. Ricardo Souza · Presidente</li>
              <li>Profa. Carla Freitas · Avaliadora</li>
              <li>Prof. Lucas Monteiro · Avaliador externo</li>
            </ul>
            <div className="hash drawer-hash">
              <span>SHA-256</span>
              <code>8fd3a0b9...781fcd22</code>
              <Badge tone="light">Verificado</Badge>
            </div>
            <Button icon="download">Baixar PDF completo</Button>
          </aside>
        </div>
      )}
      {!embedded && (
        <footer>
          <Logo />
          <span>© 2026 UFVJM · Acessibilidade · Privacidade</span>
        </footer>
      )}
    </div>
  )
}
