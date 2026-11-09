import { Card, Icon } from "../../components/common"

export interface ActivityItem {
  id: string
  title: string
  description: string
  icon: string
}

interface ActivityFeedProps {
  items: ActivityItem[]
  loading?: boolean
  emptyMessage?: string
}

export default function ActivityFeed({
  items,
  loading = false,
  emptyMessage = "Nenhuma atividade registrada até o momento.",
}: ActivityFeedProps) {
  return (
    <Card>
      <div className="section-head">
        <div>
          <p className="eyebrow">Atualizações</p>
          <h3>Atividades recentes</h3>
        </div>
      </div>
      {loading && (
        <div className="pdf-feedback compact">
          <span>Carregando atividades…</span>
        </div>
      )}
      {!loading && items.length === 0 && (
        <div className="empty-state compact">
          <div>
            <Icon name="clock" />
          </div>
          <h3>Sem movimentações</h3>
          <p>{emptyMessage}</p>
        </div>
      )}
      {!loading && items.length > 0 && (
        <div className="activity-list">
          {items.map((activity) => (
            <div className="activity" key={activity.id}>
              <div className="activity-icon">
                <Icon name={activity.icon} size={16} />
              </div>
              <div>
                <strong>{activity.title}</strong>
                <span>{activity.description}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
