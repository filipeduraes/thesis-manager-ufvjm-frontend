import { Button, Card, Icon } from "../../components/common"

interface DashboardErrorProps {
  title: string
  message: string
  onRetry: () => void
}

export default function DashboardError({ title, message, onRetry }: DashboardErrorProps) {
  return (
    <Card>
      <div className="empty-state" role="alert">
        <div>
          <Icon name="alert" />
        </div>
        <h2>{title}</h2>
        <p>{message}</p>
        <Button onClick={onRetry}>Tentar novamente</Button>
      </div>
    </Card>
  )
}
