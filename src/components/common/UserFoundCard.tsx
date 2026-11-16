import Avatar from "./Avatar"
import Badge from "./Badge"

interface UserFoundCardProps {
  name: string
  email: string
  avatarUrl?: string | null
  /** Rótulo de saída para a sessão de "encontrado"; mude quando o contexto for outra ação. */
  badgeLabel?: string
}

/**
 * Card com o usuário selecionado (banner verde), usado pelo modal de membro da
 * banca e pelo campo de e-mail do coordenador no formulário de curso.
 */
export default function UserFoundCard({ name, email, avatarUrl, badgeLabel = "Encontrado" }: UserFoundCardProps) {
  return (
    <div className="institutional-banner session-banner" aria-live="polite">
      <Avatar name={name} imageUrl={avatarUrl ?? null} />
      <div>
        <strong>{name}</strong>
        <span>{email}</span>
      </div>
      <Badge tone="success">{badgeLabel}</Badge>
    </div>
  )
}
