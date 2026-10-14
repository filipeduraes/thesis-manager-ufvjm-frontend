import {
  Badge,
  Button,
  Card,
  Icon,
  Kpi,
  PageTitle,
  SelectField,
} from "../components/common"
import { advisorStats, reportBars } from "../data/mockData"

export default function ReportsView() {
  return (
    <div className="page-content">
      <PageTitle
        eyebrow="Inteligência acadêmica"
        title="Relatórios e indicadores"
        action={
          <Button variant="secondary" icon="download">
            Exportar relatório
          </Button>
        }
      />
      <Card className="report-filters">
        <SelectField label="Período">2025.1</SelectField>
        <SelectField label="Curso">Todos os cursos</SelectField>
        <SelectField label="Orientador">Todos os orientadores</SelectField>
        <Button>Aplicar filtros</Button>
      </Card>
      <div className="kpi-grid four">
        <Kpi
          label="Total de monografias"
          value="248"
          meta="+12% vs. período anterior"
          icon="file"
        />
        <Kpi
          label="Taxa de aprovação"
          value="87,4%"
          meta="+2,1 pontos percentuais"
          icon="check"
        />
        <Kpi
          label="Submissão até defesa"
          value="68 dias"
          meta="-6 dias vs. média anterior"
          icon="clock"
        />
        <Kpi
          label="Bancas realizadas"
          value="126"
          meta="98% dentro do prazo"
          icon="calendar"
        />
      </div>
      <div className="charts-grid">
        <Card>
          <div className="section-head">
            <div>
              <p className="eyebrow">Distribuição</p>
              <h3>Monografias por curso</h3>
            </div>
            <Button variant="ghost" icon="more">
              Opções
            </Button>
          </div>
          <div className="bar-chart">
            {reportBars.map((b, i) => (
              <div key={i}>
                <span>{b}</span>
                <i style={{ height: `${b}%` }} />
                <small>{["ADM", "BIO", "ENG", "HIS", "PED", "SIS"][i]}</small>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="section-head">
            <div>
              <p className="eyebrow">Resultados</p>
              <h3>Taxa de aprovação</h3>
            </div>
          </div>
          <div className="donut-wrap">
            <div className="donut">
              <strong>87,4%</strong>
              <span>aprovação</span>
            </div>
            <div className="legend">
              <span>
                <i className="c1" />
                Aprovadas <strong>78%</strong>
              </span>
              <span>
                <i className="c2" />
                Com ressalvas <strong>9,4%</strong>
              </span>
              <span>
                <i className="c3" />
                Reprovadas <strong>12,6%</strong>
              </span>
            </div>
          </div>
        </Card>
        <Card>
          <div className="section-head">
            <div>
              <p className="eyebrow">Série histórica</p>
              <h3>Monografias por ano de defesa</h3>
            </div>
          </div>
          <div className="line-chart">
            <svg viewBox="0 0 500 180">
              <path d="M20 150 L110 128 L200 92 L290 108 L380 52 L480 34" />
              <path
                className="area"
                d="M20 150 L110 128 L200 92 L290 108 L380 52 L480 34 L480 170 L20 170Z"
              />
              {[
                [20, 150],
                [110, 128],
                [200, 92],
                [290, 108],
                [380, 52],
                [480, 34],
              ].map((p, i) => (
                <circle key={i} cx={p[0]} cy={p[1]} r="5" />
              ))}
            </svg>
            <div>
              {["2020", "2021", "2022", "2023", "2024", "2025"].map((x) => (
                <span key={x}>{x}</span>
              ))}
            </div>
          </div>
        </Card>
        <Card>
          <div className="section-head">
            <div>
              <p className="eyebrow">Orientação</p>
              <h3>Monografias por orientador</h3>
            </div>
          </div>
          <div className="horizontal-bars">
            {advisorStats.map((item) => (
              <div key={item.name}>
                <span>{item.name}</span>
                <i>
                  <b style={{ width: `${item.percentage}%` }} />
                </i>
                <strong>{Math.round(item.percentage / 5)}</strong>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card>
        <div className="section-head">
          <div>
            <p className="eyebrow">Resumo</p>
            <h3>Indicadores por curso</h3>
          </div>
          <div>
            <Button variant="outline">CSV</Button>{" "}
            <Button variant="outline">PDF</Button>
          </div>
        </div>
        <div className="full-table compact">
          <div className="row head">
            <span>Curso</span>
            <span>Monografias</span>
            <span>Aprovação</span>
            <span>Tempo médio</span>
            <span>Bancas</span>
          </div>
          {[
            ["Engenharia de Sistemas", "46", "91%", "62 dias", "42"],
            ["Administração", "38", "86%", "71 dias", "36"],
            ["Ciências Biológicas", "35", "89%", "67 dias", "33"],
          ].map((r) => (
            <div className="row" key={r[0]}>
              {r.map((x) => (
                <span key={x}>{x}</span>
              ))}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
