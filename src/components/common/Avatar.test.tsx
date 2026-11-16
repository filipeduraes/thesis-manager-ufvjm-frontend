import { expect, test } from "@jest/globals"
import { fireEvent, render, screen } from "@testing-library/react"
import Avatar from "./Avatar"

// O avatar é decorativo (aria-hidden e alt vazio), então a foto é buscada com hidden: true.
function queryPhoto(): HTMLElement | null {
  return screen.queryByRole("presentation", { hidden: true })
}

test("shows the photo when there is an image URL", () => {
  render(<Avatar name="Ana Souza" imageUrl="https://lh3.googleusercontent.com/ana" />)
  expect(queryPhoto()?.getAttribute("src")).toBe("https://lh3.googleusercontent.com/ana")
  expect(screen.queryByText("AS")).toBeNull()
})

test("shows the initials when there is no image", () => {
  render(<Avatar name="Ana Maria Souza" imageUrl={null} />)
  expect(queryPhoto()).toBeNull()
  expect(screen.getByText("AM")).toBeTruthy()
})

test("falls back to the initials when the image fails to load", () => {
  render(<Avatar name="Ana Souza" imageUrl="https://lh3.googleusercontent.com/quebrada" />)
  const photo = queryPhoto()
  if (!photo) throw new Error("photo not rendered")
  fireEvent.error(photo)
  expect(queryPhoto()).toBeNull()
  expect(screen.getByText("AS")).toBeTruthy()
})

test("retries the photo when the URL changes after a failure", () => {
  const { rerender } = render(<Avatar name="Ana Souza" imageUrl="https://lh3.googleusercontent.com/quebrada" />)
  const photo = queryPhoto()
  if (!photo) throw new Error("photo not rendered")
  fireEvent.error(photo)
  rerender(<Avatar name="Ana Souza" imageUrl="https://lh3.googleusercontent.com/nova" />)
  expect(queryPhoto()?.getAttribute("src")).toBe("https://lh3.googleusercontent.com/nova")
})

test("uses the avatar classes, with the small variant of the user list", () => {
  const { rerender } = render(<Avatar name="Ana Souza" />)
  expect(screen.getByText("AS").className).toBe("avatar")
  rerender(<Avatar name="Ana Souza" size="small" />)
  expect(screen.getByText("AS").className).toBe("avatar small")
})
