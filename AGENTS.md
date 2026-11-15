# Instructions for AI Agents

## Repository scope

Related repositories: backend at `filipeduraes/thesis-manager-ufvjm-backend` (Django, `AGENTS.md`, `MODELO_BANCO_DADOS.puml`), and the Figma wireframes ("Wireframe UFVJM TCC Repository System"). This is a course project for Distributed Systems (UFVJM, Prof. Alessandro Vivas Andrade) with groups of up to five students; keep changes small and reviewable so that teammates can follow them.

This repository contains only the frontend for UFVJM's undergraduate thesis management system (TCC), built with React and TypeScript. The backend (Django, Django REST Framework, PostgreSQL, Redis, event queue) is maintained in a separate repository. Implement screens, components, client-side state, and API integration here; do not create Django code, migrations, or server-side business logic in this repository. The backend is the source of truth for business rules and permissions: the UI may hide or disable actions for usability, but must never be the only enforcement.

Before changing code, read the files related to the task (the view, the components it uses, `src/types/index.ts`, and `src/api/client.ts`). Respect the existing structure and make small changes that fit the project's current stage. Do not assume that requirements described in the assignment have already been implemented, and do not assume that a screen is already connected to the API: several views still render data from `src/data/mockData.ts`. When a change depends on a backend endpoint that does not exist yet, document the expected contract (path, method, payload, response, status codes) and keep the integration point isolated in `src/api/client.ts`.

## Current project state

Check this section against the code before relying on it, and update it when the state changes.

- **Backend (implemented):** only the `accounts` app. Available endpoints are `GET/DELETE /api/v1/session`, `GET /api/v1/auth/google/start`, `POST /api/v1/auth/external-token`, `GET/POST /api/v1/admin/users`, `GET/PATCH/DELETE /api/v1/admin/users/<id>`, `GET /api/v1/admin/audit-logs`, and `GET/POST /api/v1/admin/external-invitations` plus `DELETE /api/v1/admin/external-invitations/<id>`.
- **Backend (not implemented yet):** theses, files and upload, reviews, defenses and committee members, evaluations, publications and public repository search, courses and departments, notifications, event queue, and reports. The database model for all of them is already designed (see "Domain model reference"), but no endpoint exists. Do not call a path that is not in the list above as if it worked.
- **Frontend, connected to the real API:** login/session bootstrap and role-based navigation (`App.tsx`), `AdminUsers` (users and external invitations), `SystemAudit`, and the defense area: `DefenseScheduling` (scheduling form via `GET /api/v1/defenses/schedulable-theses` and `POST /api/v1/theses/<id>/defenses`, plus the defense list via `GET /api/v1/defenses`), `DefenseCommittee` (members, plus schedule editing via `PATCH /api/v1/defenses/<id>` and cancellation via `POST /api/v1/defenses/<id>/cancel`, shown following `_can_manage_defense` for `SCHEDULED` defenses), and `DefenseEvaluation`. The scheduling fields are shared through `views/defense/DefenseScheduleFields.tsx` and `defenseSchedule.ts`. The committee member modals live in `components/common` (`InstitutionalMemberModal`, `ExternalMemberModal`). `ExternalEvaluation` only confirms the external session, because the session payload does not identify the defense yet.
- **Frontend, still on mock data (`src/data/mockData.ts`) with `TODO: API Integration` comments:** `StudentSubmission`, `AdvisorApproval`, `PublicRepository`, `AdminCourses`, `ReportsView`, and the dashboards. The TODO comments carry the contract the frontend team proposed (for example `GET /api/v1/theses/me`, `POST /api/v1/theses/submission/files`, `GET /api/v1/advisor/submissions`, `PATCH /api/v1/advisor/submissions/:thesisId`, `POST /api/v1/defenses`, `GET /api/v1/repository/theses`, `GET /api/v1/admin/courses`, `POST /api/v1/external-evaluations`). These paths are proposals, not agreed contracts: when the backend implements the real endpoints, align with them and update the TODOs.
- **Frontend form components are still mock-grade:** `Field` and `SelectField` in `components/common/FormControls.tsx` are uncontrolled (`defaultValue`), `SelectField` has hardcoded course options. `Modal` supports `role="dialog"`, a focus trap, and Escape through the optional `onClose` and `labelledBy` props. When connecting a form to the API, make these components controlled (`value`/`onChange`, options passed as props) in a backward-compatible way instead of working around them.

## System requirements

- Use React with TypeScript (`strict` mode) on Create React App (`react-scripts`), and Tailwind CSS plus the project's CSS tokens for styling. Do not introduce a different build tool, framework, router, or state library without a concrete need that the task justifies.
- The frontend must consume the backend REST API (JSON, versioned under `/api/v1`). Never read from or write to the database, Redis, or the message broker from the browser.
- Authentication is handled by the backend (Google Workspace institutional login through django-allauth headless/social mode, plus temporary tokens for external committee members). There is no local signup, login form with password, or password recovery. Never implement or mock a password field.
- The UI must reflect the roles the backend returns in the session: Student (`Aluno`), Advisor (`Orientador`), Course Coordinator (`Coordenador`), Administrator (`Administrador`), and External committee member (temporary session, no permanent account). Use the `roles`, `permissions`, and `authType` fields from `GET /session` to decide which screens and actions to show. Do not infer permissions from names, e-mails, or client-side flags.
- Expected screens, per the assignment: thesis submission by the student; follow-up and approval by the advisor; defense scheduling by the coordinator; evaluation entry by committee members (internal and external); public repository search; dashboards and reports (theses by course, advisor, and defense year, approval rate, average time between submission and defense); administration of users, courses, and audit logs.
- The public repository (`repository` page) must work for anonymous visitors without authentication and must show only published theses. Never expose drafts, theses under evaluation, or files of unpublished theses there.
- Business rules shown in the UI must match the backend: scheduling is allowed only after advisor approval; the final result appears only after all evaluations are recorded; published theses cannot be deleted; uploads accept PDF only with a size limit (50 MB is the assignment's reference). Validate these client-side only to give fast feedback, and always handle the backend's rejection and display its message.
- Show the status of asynchronous work honestly. Text extraction, indexing, and notifications run through an event queue in the backend, so the UI must not assume they finish within the request. Show "processing" states and refresh or poll in a bounded way when the contract defines it.
- Dashboards and report figures are calculated by the backend. Render what the API returns; do not recompute aggregates in the browser from partial data.
- The expected development and deployment environment is Linux.

## Domain model reference

The backend database model is documented in `MODELO_BANCO_DADOS.puml` (backend repository). Use it to shape frontend types and screens; it is a design that is being implemented incrementally, so confirm what exists in the API before using a field. Entities the UI deals with:

- **Users and roles:** `users_user` (UUID id, `email`, `name`, `is_active`) and `user_profile_role` (roles `ADMIN`, `COORDINATOR`, `ADVISOR`, `STUDENT`, with history through `revoked_at`). A user can hold several active roles. `professor_profile` and `student_profile` hold academic data (department, registration number, course, advisor, entry year).
- **Academic registry:** `department` and `course` (name, unique `code`, coordinator). The assignment calls for course CRUD and filters by course.
- **Thesis:** `thesis` has `type` (`MONOGRAPH` or `ARTICLE`; articles have `journal`), `title`, `abstract`, `reference_code`, `status`, `is_public`, and timestamps (`submitted_at`, `advisor_approved_at`, `published_at`, `deleted_at`). There is no direct student column: authors live in `thesis_author` (1 to 5 authors, ordered by `position`, one main author). Keywords come from `keyword` through `thesis_keyword`.
- **Files and versions:** `stored_file` (original name, size, `sha256`, processing status) and `thesis_file` (versioned, exactly one `is_current` per thesis). Reviews (`thesis_review`) belong to a specific file version, so an advisor decision refers to a version, not just to the thesis. `thesis_status_history` records every transition with who and why. `thesis_document` holds complementary documents (`DEFENSE_MINUTES`, `PUBLICATION_AUTHORIZATION`, `SPELLING_CHECK_PROOF`, `OTHER`) with status `PENDING`, `SUBMITTED`, `VALIDATED`, or `REJECTED`.
- **Defense:** `defense` (modality `IN_PERSON` or `REMOTE`, `starts_at`, `ends_at`, `location` or `meeting_url`, status, `result`, `final_grade`), `defense_member` (role `CHAIR`, `ADVISOR`, `EXAMINER`, `EXTERNAL_EXAMINER`, `ALTERNATE`; availability `PENDING`, `CONFIRMED`, `DECLINED`; each member is either an internal user or an external invitation, never both), and `defense_evaluation` (grade from 0 to 10 with two decimals, decision, feedback, private comments, locked after submission). The final result exists only after all non-alternate members evaluate.
- **Publication:** `publication` references an immutable file version and has `slug`, `doi`, `year`, and counters. `repository_search_index` is filled asynchronously from events.
- **Auth and audit:** `external_invitation` (status `PENDING`, `ACCEPTED`, `DECLINED`, `EXPIRED`, `REVOKED`, `USED`; only the token hash is stored) and the append-only `audit_log` with a hash chain.

Status enums the UI must render (backend values in English, user-facing labels in Portuguese):

- `thesis_status`: `DRAFT`, `SUBMITTED`, `ADVISOR_REVIEW`, `CHANGES_REQUESTED`, `ADVISOR_APPROVED`, `READY_FOR_DEFENSE`, `DEFENSE_SCHEDULED`, `UNDER_EVALUATION`, `APPROVED`, `APPROVED_WITH_REMARKS`, `REJECTED`, `CORRECTIONS_PENDING`, `PUBLISHED`, `ARCHIVED`.
- `defense_status`: `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`. `defense_result`: `APPROVED`, `APPROVED_WITH_REMARKS`, `REJECTED`.
- `processing_status`: `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `RETRYING` (use it for the "processing" state of text extraction and indexing).

Mapping rules:

- Today the mock types use Portuguese display strings (for example `Thesis.status: string`, `Defense.mode: "Presencial" | "Remota"`, `RepositoryWork.type: "Monografia" | "Artigo"`, `CommitteeMember.status: "Confirmado" | "Pendente"`). When connecting a screen to the API, type the API values as the backend enum codes and keep one label map per enum (for example `THESIS_STATUS_LABELS` in a single module, next to the types) that converts code to Portuguese label and `Badge` tone. Do not scatter status strings through components, and do not send Portuguese labels back to the API; send codes.
- A thesis can have several authors. Do not model a single `student` string in new API types; use an authors array and display the main author first.
- Defense scheduling needs availability confirmation by every member and conflict checking, both enforced by the backend. The UI shows the result and the member availability status; it does not decide validity by itself.
- `PUBLISHED` theses are never deletable. Do not render delete actions for them, and handle the backend refusal anyway.

## Project structure

```
src/
  api/          HTTP client and typed endpoint groups (client.ts)
  components/
    common/     Reusable UI primitives (Button, Card, Badge, Modal, FormControls, Pagination, Icon, ...), exported via index.ts
    layout/     AppShell, Sidebar, Topbar
  data/         navigation.ts (menu per profile) and mockData.ts (temporary mock data)
  types/        Shared domain types (index.ts)
  views/        One file per screen; views/dashboard/ holds one dashboard per profile
  App.tsx       Session bootstrap and page switching
  index.css     Design tokens (:root) and global styles
public/         Static assets (logos, Rawline fonts)
```

- Navigation is state-based (`Page` type and `navigate` in `App.tsx`), not URL-based. There is no router today. If a task needs deep links or browser history, propose adding a router as a deliberate, documented change instead of mixing both approaches.
- When adding a page: extend the `Page` union in `src/types/index.ts`, register it in `src/data/navigation.ts` for the profiles that may see it, add its title to `routeTitles` and its render branch in `App.tsx`, and create the view in `src/views/`.
- Keep views focused on composing components and handling screen state. Put reusable UI in `components/common`, and keep HTTP calls in `src/api`, never inline `fetch` in components.
- Use the `@/*` path alias or relative imports consistently with the surrounding file; do not mix styles within one file.

## Implementation practices

### TypeScript and readability

- Keep `strict` enabled. Type props, state, function parameters, return values of non-trivial functions, and API payloads explicitly. Avoid `any`; use `unknown` and narrow it. Avoid non-null assertions (`!`) and type assertions (`as`) unless the type is genuinely guaranteed, and prefer fixing the type.
- Use `interface` for object shapes and component props, `type` for unions and aliases. Use `import type` for type-only imports.
- Use function components and hooks only; no class components (the only class in the project is `ApiError`). Export each component as the default export of a file named after it in `PascalCase`, with the props interface declared just above it.
- Follow the existing formatting: 2-space indentation, double quotes, no semicolons, trailing commas in multiline structures. Keep the style of the file you are editing.
- Keep function parameter lists short. If a function or component needs many parameters, group related ones into a typed object instead of breaking the declaration across many lines. Do not chain many calls on one line, and assign intermediate results to clearly named variables when it improves clarity.
- Names: `PascalCase` for components, types, and interfaces; `camelCase` for functions, variables, and hooks (prefix hooks with `use`); `UPPER_SNAKE_CASE` for constants; `PascalCase.tsx` for component files and `camelCase.ts` for non-component modules. Avoid generic names such as `data`, `item`, `obj`, or `handle` when a specific name is practical (for example, `approveThesis` instead of `handleClick`).
- Write TSDoc comments for exported functions, hooks, and non-obvious types in English, describing purpose, non-obvious behavior, side effects, and thrown errors; do not merely repeat the signature. Write other developer-facing documentation and code comments in Portuguese, only to explain why an approach was chosen or to clarify something not obvious from the code. Do not add comments that narrate what the code does.
- All user-facing text (labels, messages, errors, empty states, `aria-label`s) must be in Brazilian Portuguese, with correct accents and a consistent, institutional tone. Keep identifiers, types, and API field names in English.
- Prefer small components, single responsibilities, and explicit rules. Avoid duplication, prop drilling beyond two levels without a reason, mutable module-level state, and abstractions without a concrete use. Do not add a state management library for state that fits in a component or in `App.tsx`.
- Format dates and numbers with `Intl` using the `pt-BR` locale and the `America/Sao_Paulo` time zone. The backend stores and returns timestamps in UTC as ISO 8601 strings (`TIME_ZONE = "UTC"`, `USE_TZ` enabled), so convert to São Paulo time only for display and send ISO 8601 with an explicit offset when scheduling (for example defense start and end). Never build dates by concatenating strings or parsing display formats. Dates without time (`YYYY-MM-DD`) are used by audit-log filters (`from`, `to`). Treat grades as values with decimal precision from the API; do not round them silently.

### React

- Respect the Rules of Hooks and keep `react-hooks/exhaustive-deps` clean; fix dependencies instead of disabling the rule. Use `useCallback`/`useMemo` only where they solve a real problem (stable dependencies, expensive computation), not by default.
- Every effect that starts asynchronous work must handle unmount (cancel flag or `AbortController`) so state is not set on an unmounted component. See the session bootstrap in `App.tsx` for the existing pattern.
- Derive state instead of duplicating it. Do not store in state what can be computed from props or other state.
- Use stable, unique keys from data (ids), never array indexes for dynamic lists.
- Every data-loading screen must handle loading, error, empty, and success states, with messages that tell the user what happened and, when possible, how to retry.
- Do not use `dangerouslySetInnerHTML`. If rendered HTML from the API is ever required, sanitize it with an approved library and document why.

### API integration

- Centralize requests in `src/api/client.ts` through `apiRequest`. Group endpoints by area (for example `authApi`, `adminApi`, and new groups such as `thesesApi`, `committeesApi`, `evaluationsApi`, `repositoryApi`, `reportsApi`), and export typed request and response interfaces next to them.
- Always send requests with `credentials: "include"`. For non-safe methods, send the `X-CSRFToken` header read from the `csrftoken` cookie. Never store session identifiers, tokens, or CSRF values in `localStorage` or `sessionStorage`; the backend session cookie is HttpOnly.
- `REACT_APP_API_BASE_URL` is the backend origin without `/api/v1`. Do not hardcode hosts in components.
- Treat the backend's JSON contract as authoritative. Keep API field names (camelCase in the current responses) in API types and map them to UI types in one place, close to the call, as `AdminUsers` does with `codeToProfile`. If a backend field is missing or inconsistent with the assignment, report the mismatch instead of inventing it.
- Backend response conventions (Django REST Framework): list endpoints use page-number pagination, returning `{ count, next, previous, results }`, with `page` and `page_size` query parameters (default page size 20). The current `adminApi.users`/`auditLogs` types only declare `results`; extend the types with `count`, `next`, and `previous` when you add pagination controls, and drive the existing `Pagination` component from them. Errors come as `{ "detail": "..." }` or as an object keyed by field name with arrays of messages (the shape `apiRequest` already flattens). Backend messages are already in Portuguese; show them as received. `204` means success with no body.
- The API is rate limited per scope (`session` 120/min, `external_token` 10/min). On `429`, tell the user to wait and try again, do not retry in a loop, and keep the external-token form from submitting repeatedly.
- Handle errors through `ApiError` (`status` and message). Show friendly messages and treat `401` (session expired: return to login), `403` (no permission), `404` (including admin areas outside the institutional network, which the backend hides as 404), `409`/`422` (state or validation conflicts), and `429` (rate limiting) explicitly where relevant. Do not display raw stack traces or technical details to the user.
- Send file uploads as `FormData` (the client already omits `Content-Type` in that case so the browser sets the boundary). Do not trust the file name or MIME type for validation; check extension and size for fast feedback and let the backend decide. Show upload progress or a pending state, prevent duplicate submissions while a request is in flight, and surface the backend's duplicate-file (SHA-256) and "upload in progress" responses clearly.
- Paginate and filter long lists on the server with query parameters (`search`, filters, page), as the existing admin screens do. Debounce text search inputs, and ignore out-of-order responses.
- Search and public repository requests must not require authentication. Never assume a session exists on those screens.
- Replace mock data gradually: when connecting a view to the API, remove its dependency on `mockData.ts` and delete mock entries that become unused. Do not mix mock and real data in the same screen without a clear marker.

### Styling and accessibility

- Style with the design tokens defined in `:root` of `src/index.css` (`--navy`, `--slate`, `--sage`, `--green`, `--mint`, `--bg`, `--line`, `--danger`, and so on) and the existing class names. Do not hardcode new colors, radii, or font sizes when a token exists; add a token in `:root` when a new value is truly needed.
- Reuse components from `components/common` before creating new ones. When a primitive lacks a needed capability, extend it in a backward-compatible way and show the result in the style guide view (`StyleGuideView`).
- Typography uses the Rawline font served from `public/fonts`. Keep the layout responsive (the stylesheet has breakpoints at 1200, 900, 600, and 360 px); check new screens on narrow viewports.
- Follow the institutional UFVJM visual identity of the wireframes in the project's Figma file. Do not redesign established patterns without being asked.
- Build accessible UI in new and changed code (the current common components are not fully there yet, for example `Modal` lacks `role="dialog"`, focus trap, and `Escape` handling, and `Field` does not tie hints to inputs; improve them when you touch them): semantic elements (`button` for actions, `a` for navigation, `main`, `nav`, headings in order), labels associated with every form field, visible focus, keyboard-operable modals (focus trap, `Escape` to close), `aria-live` for async status and errors, and color contrast that meets WCAG AA. Do not convey status by color alone; `Badge` text must say the status.
- Icons come from the local `Icon` component. Add new icons there instead of adding an icon library for a few glyphs.

### Security and privacy

- Never put secrets, API keys, tokens, or credentials in code, `.env.example`, logs, or versioned files. Everything in `REACT_APP_*` variables is public in the built bundle, so only non-sensitive configuration belongs there. Keep `.env` ignored by Git and update `.env.example` with variable names and fictitious values only.
- Do not log tokens, external invitation tokens (`UFVJM-XXXX-XXXX-XXXX-XXXX`), session data, document contents, complete payloads, or unnecessary personal data with `console.*`. Remove debugging statements before finishing. Keep `console.error` only where it provides actionable diagnostics, without sensitive data.
- Show an external invitation token only once, right after creation, and do not persist it in the browser. Clear sensitive state (token inputs, forms) after use and on logout.
- Do not put sensitive data (tokens, e-mails, document identifiers that grant access) in URLs, query strings, or page titles.
- Open external links with `rel="noopener noreferrer"`. Do not interpolate user input into URLs without `encodeURIComponent` or `URLSearchParams`.
- Downloads and previews of PDFs must go through backend endpoints that enforce permissions; do not build file URLs on the client or expose storage paths.
- Hiding a button is not authorization. Never rely on client-side checks to protect data or actions, and never trust role or status values stored only in the browser.

### Performance and scalability

- The public repository must stay fast under many simultaneous visitors, which the backend supports with Redis caching. Do not defeat this on the client: avoid unnecessary requests, avoid refetching on every keystroke, and keep query parameters stable and normalized so identical searches produce identical requests.
- Lazy-load heavy, rarely used screens (for example reports and charts) with `React.lazy` and `Suspense` when it measurably helps the initial bundle. Do not add large dependencies for small features; check the package size and whether the project already has an equivalent.
- Dashboards use charts (Chart.js or Plotly were suggested by the assignment). If a charting library is added, choose one, wrap it in a reusable component, and feed it only backend-provided data.

### Dependencies and configuration

- Check `package.json` before adding a dependency, and prefer what is already installed. Add a dependency only when the task needs it, pin it through `package-lock.json`, and mention it in the final report. Do not add or upgrade major versions of React, TypeScript, `react-scripts`, or Tailwind as a side effect of another task.
- Use `npm` (the repository has `package-lock.json`); do not mix in `yarn` or `pnpm` lockfiles.
- Local integration: the backend repository's `docker-compose.yml` can start PostgreSQL, Redis, and the backend (`docker compose up --build`), and with `--profile frontend` it also runs this project from `../thesis-manager-ufvjm-frontend` on Node 20 with `npm install && npm start` on port 3000 and `REACT_APP_API_BASE_URL=http://localhost:8000`. Keep the project compatible with Node 20 and with `npm start` on port 3000, since backend CORS, CSRF, and the Google redirect are configured for `http://localhost:3000`. Do not run two copies of the frontend on the same port.
- Available scripts are `npm start`, `npm run build`, and `npm test`. Note that the README mentions `npm run dev`, which does not exist in `package.json`; use `npm start` until the README is corrected, and fix the README when touching related documentation.

### Changes and verification

- When implementing or changing behavior, update affected documentation (README, this file) and configuration examples (`.env.example`).
- Create or update tests with React Testing Library (`@testing-library/react`, `jest-dom`, `user-event`) when the task involves business-rule feedback, permissions-dependent rendering, form validation, file validation, or API error handling. Test behavior as the user sees it (roles, labels, text), not implementation details, and mock only the `src/api` boundary.
- Before finishing, run the checks appropriate to the change when the environment allows: `npx tsc --noEmit`, `npm run build` (which also runs ESLint with warnings visible), and targeted tests with `CI=true npm test -- --watchAll=false`. Clearly report any check that could not be run and why.
- Verify visual changes in a browser at desktop and mobile widths when possible, and say so when you could not.
- Do not commit `.env`, `node_modules`, `build/`, coverage output, local caches, or generated artifacts.

## Authentication (frontend rules)

- On startup, call `GET /api/v1/session` (returns 200 even for anonymous users, and also sets the CSRF cookie). Use the payload fields `authenticated`, `authType` (`google`, `institutional`, `external`, or `null`), `user` (including `avatarUrl` when available), `role`, `profile`, `roles`, `permissions`, `csrfToken`, and `externalInvitation`. After logout, keep the returned `csrfToken` for the next session/bootstrap request.
- Today `permissions` contains the active role codes, not fine-grained permissions, and external sessions have `role: "EXTERNAL"`, `roles: []`, and `permissions: []`. Do not build logic that depends on finer permission strings until the backend defines them; confirm in `accounts/services.py` (`build_session_payload`).
- Institutional login only: `GET /api/v1/auth/google/start?next=` returns `{ url }`, and the frontend redirects the browser to it with `window.location.assign`. `next` must be an address on the frontend origin, otherwise the backend replaces it. On failure the backend redirects to `<FRONTEND_URL>/login?erro=...`, and `App.tsx` reads the `erro` query parameter and shows an explanation to use the UFVJM Google Workspace account. Because navigation is state-based, the dev server must serve `index.html` for `/login`; keep that working.
- Users may have several roles, but the UI does not switch profiles. The effective profile is derived from `role` returned by `GET /api/v1/session`, which comes from the roles stored in the database (priority `ADMIN > COORDINATOR > ADVISOR > STUDENT`, mapped through `codeToProfile`). When the backend changes a user's roles, the new profile is reflected on the next session load.
- External committee members exchange the human token with `POST /api/v1/auth/external-token`, then reload the session. Sessions with `authType === "external"` may only see the evaluation screen with the invitation data (`externalInvitation`), with no navigation to internal areas. Logout (`DELETE /api/v1/session`) must always clear local session state, even when the request fails.
- Administrative screens (users, courses, audit, style guide) and the `/api/v1/admin/*` endpoints are only for administrators and are restricted by the backend to the institutional network (IP/VPN). When they answer `404`, show a neutral "not available" state instead of exposing why.
- Menu items come from `menuByProfile` in `src/data/navigation.ts`. Keep it consistent with the permissions the backend returns, and keep the guards in `App.tsx` that redirect away from pages the current profile cannot access.
- The public repository is reachable without a session. Navigation from it back to login must not require or create a session.
