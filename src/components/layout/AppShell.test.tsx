import { expect, jest, test } from "@jest/globals"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import AppShell from "./AppShell"

function renderShell(menuOpen = false, setMenuOpen: (open: boolean) => void = () => undefined) {
  render(
    <AppShell
      page="approval"
      profileLabel="Orientador"
      menuItems={[
        { label: "Início", icon: "home", page: "dashboard" },
        { label: "Orientandos", icon: "users", page: "approval" },
      ]}
      searchSessionKey="s"
      canReadDirectory={false}
      onSearchNavigate={() => undefined}
      onSessionExpired={() => undefined}
      userName="Ana Orientadora"
      userInitials="AO"
      userAvatarUrl={null}
      title="Orientandos"
      menuOpen={menuOpen}
      navigate={() => undefined}
      logout={() => undefined}
      setMenuOpen={setMenuOpen}
    >
      <div>Conteúdo da página</div>
    </AppShell>,
  )
}

test("offers a skip link to a single main landmark that holds the page", () => {
  renderShell()

  const skip = screen.getByRole("link", { name: "Pular para o conteúdo" })
  expect(skip.getAttribute("href")).toBe("#conteudo-principal")
  const main = screen.getByRole("main")
  expect(main.id).toBe("conteudo-principal")
  expect(main.textContent).toContain("Conteúdo da página")
  expect(screen.getAllByRole("main")).toHaveLength(1)
})

test("marks the current menu item with aria-current", () => {
  renderShell()

  const nav = screen.getByRole("navigation", { name: "Menu principal" })
  expect(nav.querySelector('[aria-current="page"]')?.textContent).toContain("Orientandos")
  expect(nav.querySelectorAll("[aria-current]")).toHaveLength(1)
})

test("closes the mobile menu with Escape", () => {
  const setMenuOpen = jest.fn()
  renderShell(true, setMenuOpen)

  userEvent.keyboard("{Escape}")
  expect(setMenuOpen).toHaveBeenCalledWith(false)
})
