# Padrões de Código

Este guia é para quem vai desenvolver no frontend. A ideia é que você consiga abrir uma tela e saber onde colocar cada coisa, como nomear, como conversar com a API e o que testar. Quando o código existente divergir, siga o estilo do arquivo que você está editando e corrija a divergência aos poucos.

---

## 1. Como o código se organiza

O frontend é React com TypeScript, React Scripts, Tailwind e tokens CSS próprios. O navegador não acessa banco, Redis nem fila. Toda informação vem da API do backend.

A pasta api concentra as chamadas em um cliente com grupos de endpoints. A pasta components reúne o que pode ser reutilizado. A pasta data guarda rótulos, formatadores e navegação. A pasta hooks guarda lógica compartilhada. A pasta types guarda tipos de UI. A pasta views tem uma tela por arquivo, com subpastas para bancas, repositório e dashboards.

Uma tela deve compor componentes e cuidar do estado daquela tela. Requisição HTTP não fica dentro de componente. Regra de negócio não fica no navegador: a interface pode esconder um botão para ajudar o usuário, mas quem decide é o backend.

O exemplo abaixo mostra um componente completo. Repare na interface de props declarada logo acima, no default export, no uso de um token CSS, no texto em português e nos atributos de acessibilidade:

```tsx
import type { ReactNode } from "react"

export interface ActionCardProps {
  title: string
  description: string
  children?: ReactNode
  onConfirm: () => void
  disabled?: boolean
}

export default function ActionCard({
  title,
  description,
  children,
  onConfirm,
  disabled = false,
}: ActionCardProps) {
  const hintId = "action-card-hint"

  return (
    <section className="surface-card" aria-labelledby="action-card-title">
      <h2 id="action-card-title">{title}</h2>
      <p id={hintId}>{description}</p>
      {children}
      <button
        type="button"
        onClick={onConfirm}
        disabled={disabled}
        aria-describedby={hintId}
      >
        Confirmar
      </button>
    </section>
  )
}
```

## 2. Nomeação

| Item | Regra | Exemplo |
|---|---|---|
| Componente | PascalCase, arquivo com mesmo nome | Button, DefenseCommittee |
| Props | interface NomeDoComponenteProps | ActionCardProps |
| Hook | arquivo useNome, função começando com use | useAsyncData, useUserLookup |
| Função e variável | camelCase | formatRate, selectedCourseId |
| Constante | UPPER_SNAKE_CASE | API_ROOT, APPROVAL_RATE_LABEL |
| Mapa de rótulos | lowerCamelCase no módulo de dados | thesisStatusLabels |
| Tipo e interface | PascalCase, interface para objeto, type para união | PublicThesis, AsyncStatus |
| Grupo de API | objeto terminado em Api | repositoryApi, reportsApi |
| Arquivo de teste | junto do código, com sufixo test | ActionCard.test.tsx |
| Especificação E2E | kebab-case, descrição em português | public-repository.spec.ts |

Use nomes que digam o que a coisa é. Nomes como data, item e handle obrigam quem lê a adivinhar.

## 3. TypeScript e estilo

Mantenha strict ligado. Anote props, estado, parâmetros, retorno de funções não triviais e payloads de API. Evite any. Use unknown e estreite o tipo. Evite asserções e não nulo quando o tipo pode ser corrigido.

Use interface para forma de objeto e type para união. Componentes são funcionais, com export default. Hooks, helpers e grupos de API usam export nomeado. Tudo que serve apenas como tipo entra com import type, o equivalente do TYPE_CHECKING usado no backend. Não importe um valor em runtime só para anotar uma variável: se o módulo importado puxa outros módulos pesados ou cria Ciclo, o build inteiro sofre. Antes de contornar um ciclo, repense onde a responsabilidade deveria estar.

O estilo atual é dois espaços, aspas duplas, sem ponto e vírgula e vírgula no final de estruturas multilinha. O alias configurado no projeto existe, mas o código usa caminhos relativos. Não misture os dois no mesmo arquivo.

Comentários de desenvolvedor ficam em português e explicam decisões. Comentários de documento para funções exportadas ficam em inglês. Todo texto visível para o usuário fica em português brasileiro, com acento e tom institucional.

## 4. API e contrato

Toda requisição passa pelo cliente central. Ele já cuida de cookies, token CSRF, tratamento de erro e respostas sem corpo. Envie credenciais em toda chamada. Nunca guarde sessão ou token em armazenamento local do navegador.

A URL base da API vem de variável de ambiente e não termina com a versão. O cliente monta o prefixo. Campos da API chegam em camelCase e devem continuar assim nos tipos. Traduza para a tela em um só lugar, perto da chamada.

O exemplo abaixo mostra um grupo de API com tipos declarados ao lado. As mensagens de erro do backend já vêm em português e devem ser exibidas como chegaram:

```ts
import type { CourseSummary } from "../types"
import { apiRequest } from "./client"

export interface CourseListResponse {
  count: number
  page: number
  pageSize: number
  totalPages: number
  lastPageCount: number
  results: CourseSummary[]
}

export interface CourseQuery {
  search?: string
  page?: number
  pageSize?: number
}

export const courseApi = {
  list(query: CourseQuery = {}): Promise<CourseListResponse> {
    const params = new URLSearchParams()
    if (query.search) params.set("q", query.search)
    if (query.page) params.set("page", String(query.page))
    if (query.pageSize) params.set("pageSize", String(query.pageSize))
    return apiRequest<CourseListResponse>(`/courses?${params.toString()}`)
  },
}
```

Listas longas são paginadas no servidor. Filtros de texto são enviados como parâmetros de consulta e não disparam uma requisição a cada tecla. Respostas que chegam fora de ordem não podem sobrescrever o estado mais recente.

Em caso de erro, mostre a mensagem recebida. Trate sessão expirada, falta de permissão, recurso não encontrado, conflito de estado e limite de requisições de formas diferentes. Em limite excedido, peça para esperar, sem repetir em loop.

## 5. Status, datas e números

A API manda códigos em inglês. A interface mostra rótulos em português. Esses rótulos e as cores dos selos ficam nos módulos de dados, nunca espalhados pelos componentes. Nunca envie rótulo para o backend.

Datas e números são formatados com Intl, localidade pt-BR e fuso de Brasília. O backend devolve ISO 8601 em UTC. Na hora de agendar, monte o valor com offset a partir da data e hora locais. Nunca concatene string de exibição para formar data.

Indicadores de relatório já vêm calculados. A tela mostra o que a API devolve, sem refazer conta com dados parciais.

## 6. React e acessibilidade

Respeite as regras dos hooks. Use useCallback e useMemo só quando resolverem um problema real. Todo efeito que inicia trabalho assíncrono precisa cuidar da desmontagem, com sinal de cancelamento ou AbortController.

Use chaves estáveis de dados nas listas. Não guarde no estado o que pode ser calculado das props. Tela com carregamento precisa de estados de carregamento, erro, vazio e sucesso, com mensagem que ajude o usuário a seguir.

Componentes de diálogo e campo já oferecem papel, foco preso, Escape e descrição associada. Preserve isso. Use elementos semânticos, label em todo campo, foco visível e texto que comunique o estado sem depender só da cor. Não use conteúdo HTML vindo da API diretamente na tela.

Selecione elementos nos testes por papel, nome acessível ou texto estável. Identificadores de teste não fazem parte do padrão deste projeto.

## 7. Estilo e identidade visual

Use os tokens definidos no CSS global. Não crie cor, raio ou tamanho novo quando já existir token. Reaproveite os componentes comuns antes de criar outro. Se faltar uma capacidade, estenda o componente existente sem quebrar quem já o usa.

A fonte do projeto vem da pasta pública de assets. O layout precisa funcionar nos breakpoints já definidos. Siga a identidade dos wireframes. Não redesenhe padrão estabelecido sem pedido.

## 8. Segurança

Tudo que vai em variável pública do build pode ser lido por qualquer pessoa. Só configuração sem segredo entra nela. Arquivo de ambiente fica fora do controle de versão e o exemplo traz só valores fictícios.

Não registre token, convite de membro externo, sessão, conteúdo de documento ou payload completo no console. O código de acesso do membro externo existe apenas no e-mail. Não crie tela, estado ou tipo que mostre esse código.

Não coloque dado sensível em URL. Links externos abrem com as opções de segurança habituais. Entrada do usuário usada em URL passa por codificação própria.

Esconder botão não é autorização. A interface reflete as permissões que o backend devolve e trata a recusa dele quando ela acontecer.

## 9. Testes

Toda mudança vem com teste. Escreva o teste primeiro, veja ele falhar e só depois implemente. Não remova asserção para a suíte passar.

O teste de componente verifica comportamento que o usuário percebe. Use papel, rótulo e texto. Mock somente a fronteira da API.

```tsx
import { expect, test } from "@jest/globals"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import ActionCard from "./ActionCard"

test("desativa a ação e explica o motivo", async () => {
  const onConfirm = jest.fn()

  render(
    <ActionCard
      title="Publicar monografia"
      description="A autorização ainda não foi validada."
      onConfirm={onConfirm}
      disabled
    />,
  )

  const button = screen.getByRole("button", { name: "Confirmar" })
  expect(button).toBeDisabled()
  await userEvent.click(button)
  expect(onConfirm).not.toHaveBeenCalled()
})
```

O teste de ponta a ponta usa o navegador. A API prepara o cenário, a ação acontece na interface e a verificação observa o resultado visível. Identificadores criados por teste são únicos, então a suíte não depende de ordem. O smoke com stack real roda em projeto separado e descartável, nunca contra o ambiente de desenvolvimento.

## 10. Pontos que ainda precisam de limpeza

Algumas coisas ficaram pelo caminho. Quando você mexer perto delas, deixe o código melhor:

- Dois grupos de API consultam o mesmo endpoint de busca pública com tipos diferentes.
- Rótulos de resultado de banca aparecem em mais de um módulo de dados.
- Formatação de data existe em dois lugares.
- Tipos de tela e payloads de API estão divididos entre a pasta de tipos e o cliente.
- Alguns comentários de função ainda estão em português, contrariando a regra para documentação de código.

Não faça uma refatoração grande só por causa dessa lista. Corrija o que estiver no caminho da sua tarefa.

## 11. Antes de entregar

- Rode a checagem de tipos.
- Rode os testes de componente e os testes de ponta a ponta afetados.
- Confira a tela em largura de desktop e de celular quando possível.
- Atualize a documentação que a mudança afetou.
- Não versione ambiente local, dependências instaladas, build nem saída de teste.

## 12. Boas práticas gerais

Prefira componentes pequenos, com uma responsabilidade. Evite repetir lógica, encadear many props sem necessidade e criar estado global para algo que cabe na tela. Não adicione dependência sem necessidade. Use npm e mantenha o arquivo de travamento. Não desabilite teste ou verificação para esconder falha. Comente o porquê, não o óbvio.
