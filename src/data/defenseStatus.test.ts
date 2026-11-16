import { expect, test } from "@jest/globals"
import { availabilityStatusBadge, defenseDecisionTone, defenseStatusTone } from "./defenseStatus"
import { documentStatusTones, reviewDecisionTones, thesisStatusTones } from "./thesisStatus"

test("defense status tones follow the thesis status tones of the same meaning", () => {
  expect(defenseStatusTone("SCHEDULED")).toBe(thesisStatusTones.DEFENSE_SCHEDULED)
  expect(defenseStatusTone("IN_PROGRESS")).toBe(thesisStatusTones.UNDER_EVALUATION)
  expect(defenseStatusTone("COMPLETED")).toBe(thesisStatusTones.APPROVED)
  expect(defenseStatusTone("CANCELLED")).toBe(thesisStatusTones.REJECTED)
  expect(defenseStatusTone("UNKNOWN")).toBe("neutral")
})

test("committee decisions follow the review decision tones", () => {
  expect(defenseDecisionTone("APPROVED")).toBe(reviewDecisionTones.APPROVED)
  expect(defenseDecisionTone("APPROVED_WITH_REMARKS")).toBe(thesisStatusTones.APPROVED_WITH_REMARKS)
  expect(defenseDecisionTone("REJECTED")).toBe(reviewDecisionTones.REJECTED)
})

test("availability badges follow the document status tones", () => {
  expect(availabilityStatusBadge("PENDING")).toEqual({ label: "Aguardando confirmação", tone: documentStatusTones.PENDING })
  expect(availabilityStatusBadge("CONFIRMED")).toEqual({ label: "Confirmado", tone: documentStatusTones.VALIDATED })
  expect(availabilityStatusBadge("DECLINED")).toEqual({ label: "Indisponível", tone: documentStatusTones.REJECTED })
  expect(availabilityStatusBadge("UNKNOWN").label).toBe("Aguardando confirmação")
})
