# Thesis Manager UFVJM Frontend

Frontend do sistema de gerenciamento de Trabalhos de Conclusão de Curso (TCC), desenvolvido com React.

## 1. Requisitos

O projeto utiliza Node.js, npm e Git. As instruções abaixo consideram distribuições Linux baseadas em Ubuntu, como Ubuntu e Linux Mint.

Para instalar todas as ferramentas necessárias, abra o terminal e execute:

```bash
sudo apt update
sudo apt install nodejs npm git
```

## 2. Clonar o repositório

Clone o repositório e entre na pasta do projeto:

```bash
git clone https://github.com/filipeduraes/thesis-manager-ufvjm-frontend.git
cd thesis-manager-ufvjm-frontend
```

## 3. Instalar as dependências

Na raiz do projeto, execute:

```bash
npm install
```

Esse comando instala as dependências necessárias para executar e desenvolver a aplicação.

## 4. Configurar variáveis de ambiente

Copie `.env.example` para `.env` e configure `REACT_APP_API_BASE_URL` com a origem do backend, sem `/api/v1` no final. O frontend envia cookies com `credentials: include`; configure no backend CORS e CSRF para a origem do frontend.

Mantenha credenciais e outros dados sensíveis privados. Não versione arquivos `.env` que contenham informações confidenciais.

## 5. Executar o projeto

Para iniciar o servidor de desenvolvimento, execute:

```bash
npm start
```

Após a inicialização, a aplicação estará disponível em `http://localhost:3000`.

Para interromper o servidor, pressione `Ctrl + C` no terminal.

## 6. Gerar a versão de produção

Para compilar o projeto para produção, execute:

```bash
npm run build
```

Para testar localmente a versão compilada, use qualquer servidor estático apontando a raiz para a pasta `build`, por exemplo:

```bash
npx serve -s build
```

## 7. Desenvolvimento

Para atualizar sua cópia local do repositório e instalar as dependências, execute:

```bash
git pull
npm install
```

Em seguida, inicie o servidor de desenvolvimento:

```bash
npm start
```

Antes de enviar alterações, rode os testes e a verificação de tipos:

```bash
npx tsc --noEmit
CI=true npm test -- --watchAll=false
```

Consulte a seção `scripts` do arquivo `package.json` para verificar os comandos disponíveis no projeto.

## Testes End-to-End (Playwright)

A suíte E2E exercita a aplicação pela interface real (browser), sem chamadas
diretas aos endpoints nas asserções. A API é usada apenas na preparação de
pré-condições (usuários, cursos e TCCs) dos cenários.

### Pré-requisitos

- Node 20+ e Google Chrome (o `playwright.config.ts` usa `channel: "chrome"`;
  não é necessário baixar navegadores).
- Backend Django com `DEBUG=True` para habilitar `/api/v1/auth/dev-login`.
- Frontend em `npm start` (o login de teste só aparece em build de
  desenvolvimento).

### Execução (servidores automáticos)

Basta rodar a suíte. O `playwright.config.ts` sobe automaticamente o backend
isolado e o frontend quando eles não estão rodando, e os encerra ao final:

```bash
npm run test:e2e              # suíte completa
npx playwright test e2e/auth.spec.ts          # arquivo específico
npx playwright test -g "exporta o log em CSV"  # teste específico
npm run test:e2e:report       # abre o relatório HTML da última execução
```

Execute **na raiz do repositório frontend**, no host (o `webServer` usa o
caminho relativo `../thesis-manager-ufvjm-backend`). A suíte usa portas
**dedicadas**: backend `:8001` (SQLite isolado) e frontend `:3001`.
`reuseExistingServer: false` impede que um backend da aplicação em `:8000` seja
reaproveitado — isso gravaria dados de teste no banco real.

### Ambiente isolado (sem PostgreSQL/Redis/RabbitMQ)

O módulo `thesismanagerbackend.settings_e2e` é usado automaticamente pelo
`webServer`: SQLite, cache em memória, e-mail em memória e diretório temporário
para uploads. Se preferir iniciar manualmente:

```bash
cd ../thesis-manager-ufvjm-backend
DJANGO_SETTINGS_MODULE=thesismanagerbackend.settings_e2e .venv/bin/python manage.py migrate --noinput
DJANGO_SETTINGS_MODULE=thesismanagerbackend.settings_e2e .venv/bin/python manage.py runserver 127.0.0.1:8001 --noreload
```

### Usando o Docker Compose normal

Também funciona sem configuração extra:

```bash
cd ../thesis-manager-ufvjm-backend
docker compose --profile frontend up --build -d
```

O compose sobe a aplicação em `:8000`/`:3000`, mas **não é usado pelos testes**.
A suíte sempre sobe seu próprio backend isolado em `:8001` e frontend em
`:3001`, para que os dados de teste nunca entrem no banco da aplicação. Execute
a suíte no host, não dentro do container do frontend (o Chrome do sistema não
está na imagem).

### Evidências

- Relatório HTML: `playwright-report/` (gerado automaticamente).
- Em falhas: screenshot, trace e error context em `test-results/`.
- Variáveis opcionais: `E2E_BASE_URL` (padrão `http://localhost:3001`) e
  `E2E_API_URL` (padrão `http://localhost:8001/api/v1`).

### Limitações conhecidas

- O login via Google e o fluxo do membro externo com token real dependem de
  serviços externos; o teste cobre apenas a validação de token inválido.
- O repositório público ainda usa dados mockados no frontend. O teste em
  `e2e/public-repository.spec.ts` publica um TCC de verdade no backend e tenta
  encontrá-lo pela interface; ele está marcado como `test.fixme()` e aparece no
  resumo como **1 skipped**, com o motivo da limitação. O teste em `auth.spec.ts` valida
  apenas a tela mockada — não deve ser lido como cobertura da busca pública.
- No backend SQLite isolado, requisições concorrentes de visualização de PDF
  podem registrar `database is locked` (500) ao gravar a auditoria. Isso é
  artefato do SQLite usado no E2E; em PostgreSQL (Docker) não ocorre.

## Correções de concorrência (2026-11-22)

Telas com carregamento assíncrono passaram a descartar respostas obsoletas por identificador de requisição (`DefenseCommittee`, `AdvisorApproval`, `AdminUsers`, `AdminCourses`), o campo de sugestão de usuários invalida requisições pendentes em cache hits, o token CSRF é renovado após logout, e formulários de submissão possuem guarda síncrona contra envio duplicado. Filtros de sessão são limpos no logout. Testes: `src/hooks/useUserLookup.test.ts` e suíte E2E existente.

## Refatoração de qualidade (2026-11-22)

Extraídos `api/errors.ts`, `data/{auditCategories,dateFormat,storageKeys}.ts`, `components/common/{CategoryChip,pagination}.ts` e removidos tipos legados sem uso em `types/index.ts`. Textos, cores e contratos de API permanecem idênticos.

### Limpeza de dados de execuções antigas

Se uma execução antiga (antes das portas dedicadas) gravou no banco da aplicação:

```bash
cd ../thesis-manager-ufvjm-backend
DATABASE_URL=<url-do-banco-real> .venv/bin/python manage.py cleanup_e2e_data
DATABASE_URL=<url-do-banco-real> .venv/bin/python manage.py cleanup_e2e_data --apply
```

O comando remove usuários `e2e-*`, cursos/departamentos `E2E`, TCCs e bancas
relacionados, além das notificações correspondentes. A tabela `audit_log` **não**
é alterada: ela é append-only com cadeia SHA-256.
