import { Card, Icon } from "../../components/common"

interface DashboardLoadingProps {
  icon: string
  title: string
  description: string
}

export default function DashboardLoading({ icon, title, description }: DashboardLoadingProps) {
  return (
    <Card>
      <div className="pdf-feedback" role="status" aria-live="polite">
        <div className="upload-icon">
          <Icon name={icon} />
        </div>
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
    </Card>
  )
}
