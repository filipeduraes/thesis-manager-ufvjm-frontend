import Card from "./Card"
import Icon from "./Icon"
interface KpiProps {
  label: string
  value: string
  meta: string
  icon: string
}
export default function Kpi({ label, value, meta, icon }: KpiProps) {
  return (
    <Card className="kpi">
      <div className="kpi-icon">
        <Icon name={icon} />
      </div>
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{meta}</span>
    </Card>
  )
}
