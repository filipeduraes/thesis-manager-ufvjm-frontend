import type { Profile } from "../../types"
import { Icon } from "../../components/common"
interface TopbarProps {
  profile: Profile
  profiles: Profile[]
  setProfile: (profile: Profile) => void
  openMenu: () => void
}
import type { Profile } from "../../types"
import { Icon } from "../../components/common"

interface TopbarProps {
  profile: Profile
  openMenu: () => void
}

export default function Topbar({ profile, openMenu }: TopbarProps) {
  return (
    <header className="topbar">
      <button
        className="menu-toggle icon-btn"
        onClick={openMenu}
        aria-label="Abrir menu"
      >
        <Icon name="menu" />
      </button>

      {profile !== "Aluno" && (
        <div className="top-search">
          <Icon name="search" />
          <input placeholder="Buscar monografia, aluno ou orientador..." />
          <kbd>⌘ K</kbd>
        </div>
      )}
    </header>
  )
}