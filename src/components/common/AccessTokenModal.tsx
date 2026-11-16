import { useState } from "react"
import Button from "./Button"
import Icon from "./Icon"
import Modal from "./Modal"

/** One external member token to hand over, as returned once by the backend. */
export interface IssuedAccessToken {
  memberId: string
  memberName: string
  token: string
  expiresAt: string
}

const EXPIRATION_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
})

type CopyState = "idle" | "copied" | "failed"

interface AccessTokenModalProps {
  tokens: IssuedAccessToken[]
  /** The parent must drop the tokens from its state here; they are never shown again. */
  onClose: () => void
}

/**
 * Shows external member access tokens once, with a copy button for each.
 *
 * Tokens live only in the parent's state while this modal is open: they are not
 * written to storage, logs or URLs, and the backend keeps only their hash.
 */
export default function AccessTokenModal({ tokens, onClose }: AccessTokenModalProps) {
  const [copyState, setCopyState] = useState<Record<string, CopyState>>({})

  const copyToken = async (entry: IssuedAccessToken) => {
    try {
      await navigator.clipboard.writeText(entry.token)
      setCopyState((current) => ({ ...current, [entry.memberId]: "copied" }))
    } catch {
      setCopyState((current) => ({ ...current, [entry.memberId]: "failed" }))
    }
  }

  return (
    <Modal className="admin-modal invite-modal" onClose={onClose} labelledBy="access-token-title">
      <div className="section-head">
        <div>
          <h2 id="access-token-title">{tokens.length === 1 ? "Token de acesso" : "Tokens de acesso"}</h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Fechar">
          <Icon name="close" />
        </button>
      </div>

      <div className="conflict-message access-token-warning" role="note">
        <Icon name="lock" />
        <div>
          <strong>Guarde este token: ele não será exibido novamente.</strong>
          <span>Entregue-o ao membro externo, que o usa para entrar na tela de avaliação.</span>
        </div>
      </div>

      {tokens.map((entry) => {
        const state = copyState[entry.memberId] ?? "idle"
        const tokenId = `access-token-${entry.memberId}`
        return (
          <div className="token-box access-token" key={entry.memberId}>
            <p>
              <strong>{entry.memberName}</strong> · válido até {EXPIRATION_FORMATTER.format(new Date(entry.expiresAt))}
            </p>
            <div className="token-row">
              <code id={tokenId}>{entry.token}</code>
              <Button variant="outline" describedBy={tokenId} onClick={() => void copyToken(entry)}>
                {state === "copied" ? "Copiado" : "Copiar"}
              </Button>
            </div>
            <small aria-live="polite">
              {state === "copied" && "Token copiado para a área de transferência."}
              {state === "failed" && "Não foi possível copiar. Selecione o token e copie manualmente."}
            </small>
          </div>
        )
      })}

      <div className="modal-actions">
        <Button onClick={onClose}>Concluir</Button>
      </div>
    </Modal>
  )
}
