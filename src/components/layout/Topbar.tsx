
import { Icon } from "../../components/common"

interface TopbarProps {
  showSearch: boolean
  openMenu: () => void
}

export default function Topbar({ showSearch, openMenu }: TopbarProps) {
  return (
    <header className="topbar">
      <button
        className="menu-toggle icon-btn"
        onClick={openMenu}
        aria-label="Abrir menu"
      >
        <Icon name="menu" />
      </button>

      {showSearch && (
        <div className="top-search">
          <Icon name="search" />
          <input placeholder="Buscar monografia, aluno ou orientador..." />
          <kbd>⌘ K</kbd>
        </div>
      )}
    </header>
  )
}