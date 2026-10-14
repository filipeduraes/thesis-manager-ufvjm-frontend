import {
  Badge,
  Button,
  Card,
  Field,
  Icon,
  PageTitle,
  Pagination,
  SelectField,
} from "../components/common"

export default function StyleGuideView() {
  return (
    <div className="page-content">
      <PageTitle eyebrow="Sistema visual" title="Guia de estilo" />
      <div className="style-grid">
        <Card>
          <p className="eyebrow">Fundamentos</p>
          <h3>Paleta institucional</h3>
          <div className="swatches">
            {[
              ["#011936", "Azul-marinho"],
              ["#465362", "Cinza-azulado"],
              ["#82A3A1", "Verde-acinzentado"],
              ["#9FC490", "Verde médio"],
              ["#C0DFA1", "Verde claro"],
              ["#F4F7F6", "Neutro claro"],
            ].map((c) => (
              <div key={c[0]}>
                <i style={{ background: c[0] }} />
                <strong>{c[1]}</strong>
                <code>{c[0]}</code>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <p className="eyebrow">Tipografia</p>
          <h3>Rawline</h3>
          <div className="type-samples">
            <h1>Título 28 — Página</h1>
            <h2>Título 22 — Seção</h2>
            <h3>Título 18 — Card</h3>
            <p>Corpo 16 — Conteúdo principal e leitura.</p>
            <small>Rótulo 14 — Informações auxiliares</small>
          </div>
        </Card>
      </div>
      <Card>
        <p className="eyebrow">Ações</p>
        <h3>Botões</h3>
        <div className="component-row">
          <Button>Primário</Button>
          <Button variant="secondary">Secundário</Button>
          <Button variant="success" icon="check">
            Aprovar
          </Button>
          <Button variant="outline">Outline</Button>
          <Button disabled>Desabilitado</Button>
          <Button variant="ghost">Texto / ghost</Button>
        </div>
      </Card>
      <div className="style-grid">
        <Card>
          <p className="eyebrow">Formulários</p>
          <h3>Campos</h3>
          <Field label="Campo de texto" placeholder="Digite uma informação" />
          <SelectField label="Campo de seleção">
            Selecione uma opção
          </SelectField>
          <Field label="Data" type="date" />
        </Card>
        <Card>
          <p className="eyebrow">Status</p>
          <h3>Badges de monografia</h3>
          <div className="component-row">
            <Badge>Rascunho</Badge>
            <Badge tone="active">Em avaliação</Badge>
            <Badge tone="success">Aprovada</Badge>
            <Badge tone="dark">
              <Icon name="alert" size={12} /> Reprovada
            </Badge>
            <Badge tone="light">Publicada</Badge>
          </div>
          <hr />
          <h3>Abas</h3>
          <div className="tabs">
            <button className="active">Visão geral</button>
            <button>Histórico</button>
            <button>Documentos</button>
          </div>
        </Card>
      </div>
      <Card>
        <p className="eyebrow">Navegação e feedback</p>
        <h3>Breadcrumbs, paginação e notas</h3>
        <div className="breadcrumb">
          <span>Início</span>
          <Icon name="arrow" size={14} />
          <span>Monografias</span>
          <Icon name="arrow" size={14} />
          <strong>Detalhe</strong>
        </div>
        <Pagination />
        <div className="inline-alert">
          <Icon name="alert" />
          <span>
            Mensagens de erro e reprovação usam apenas azul-marinho com ícone e
            rótulo.
          </span>
        </div>
      </Card>
    </div>
  )
}
