import type { ReactNode } from "react"
import { Fragment } from "react"
import Icon from "./Icon"

export interface BreadcrumbItem {
  /** Texto do nível; o último item é a página atual. */
  label: string
  /** Se ausente no último item, este é o atual e não é um botão. */
  onClick?: () => void
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  /** Ação alinhada à direita (ex.: botão Atualizar). */
  action?: ReactNode
}

/**
 * Trilha de navegação para telas abertas a partir de uma aba principal.
 *
 * Cada nível antes do último é um botão; o último é a página atual
 * (`aria-current="page"`). Substitui os botões soltos de "Voltar",
 * oferecendo sempre um caminho de volta para a listagem.
 */
export default function Breadcrumb({ items, action }: BreadcrumbProps) {
  return (
    <nav className="breadcrumb" aria-label="Caminho">
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return (
          <Fragment key={`${item.label}-${index}`}>
            {index > 0 && <Icon name="arrow" size={14} />}
            {isLast ? (
              <span aria-current="page">{item.label}</span>
            ) : (
              <button type="button" onClick={item.onClick}>
                {item.label}
              </button>
            )}
          </Fragment>
        )
      })}
      {action && <div className="breadcrumb-action">{action}</div>}
    </nav>
  )
}
