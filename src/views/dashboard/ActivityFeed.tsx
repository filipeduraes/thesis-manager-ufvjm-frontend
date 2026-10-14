import { activities } from "../../data/mockData"
import { Card, Icon } from "../../components/common"
export default function ActivityFeed() {
  return (
    <Card>
      <div className="section-head">
        <div>
          <p className="eyebrow">Atualizações</p>
          <h3>Atividades recentes</h3>
        </div>
        <button className="text-link">Ver todas</button>
      </div>
      <div className="activity-list">
        {activities.map((activity) => (
          <div className="activity" key={activity[0]}>
            <div className="activity-icon">
              <Icon name={activity[2]} size={16} />
            </div>
            <div>
              <strong>{activity[0]}</strong>
              <span>{activity[1]}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
