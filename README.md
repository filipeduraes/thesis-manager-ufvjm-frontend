# Frontend do Gerenciador de TCCs da UFVJM

Grupo:

- Ana Carolina Pereira dos Santos
- Ana Júlia Oliveira Araújo
- Camila Santos Barbosa
- Deivid Camargos Batista
- Filipe Hipólito Diniz Durães

Professor: Alessandro Vivas Andrade

Disciplina: Sistemas Distribuídos

## Visão geral

Interface web do Gerenciador de TCCs da UFVJM, feita em React. Ela fala com a API do backend, que fica no repositório `thesis-manager-ufvjm-backend`. As regras de negócio ficam no servidor. A interface não decide permissões.

As telas cobrem:

- submissão de monografias e acompanhamento do status;
- parecer do orientador e agendamento de bancas;
- avaliação dos membros e gestão do acervo publicado;
- relatórios, auditoria e busca pública.

## Tecnologias

React 19, TypeScript, React Scripts 5, Tailwind 3, Chart.js 4, React Testing Library e Playwright. O Compose do backend usa `node:20-alpine`. Instale o Node 20 pelo nvm para acompanhar essa versão.

## Como o sistema se encaixa

O diagrama acompanha um TCC desde a interface até a busca pública. Cada coluna mostra quem age. As notas em roxo dizem qual serviço atua, onde o dado fica e o que acontece fora do pedido HTTP.

![Fluxo do TCC por raia: aluno, orientador, coordenador, membros da banca e visitante](readme/fluxo-tcc.png)

## Capturas de tela

Imagens do sistema rodando com dados de teste.

<img src="readme/repositorio-publico.png" width="700" alt="Busca pública de monografias">

<img src="readme/painel-admin.png" width="700" alt="Painel inicial do administrador">

<img src="readme/gestao-monografias.png" width="700" alt="Acompanhamento e gestão de monografias">

## Rodando o projeto

### 1. Preparar o Linux

Os comandos são para Ubuntu, Debian ou Linux Mint.

```bash
sudo apt update
sudo apt install -y git curl ca-certificates
```

Instale o nvm e o Node 20:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.nvm/nvm.sh
nvm install 20
```

Confira com `node -v` e `npm -v`. O primeiro comando precisa mostrar `v20`.

### 2. Clonar os repositórios

Clone o backend ao lado deste repositório. A API precisa estar disponível para o frontend funcionar.

```bash
git clone https://github.com/filipeduraes/thesis-manager-ufvjm-backend.git
git clone https://github.com/filipeduraes/thesis-manager-ufvjm-frontend.git
cd thesis-manager-ufvjm-frontend
```

### 3. Instalar as dependências

```bash
npm install
```

### 4. Configurar o ambiente

```bash
cp .env.example .env
```

Em `.env`, configure `REACT_APP_API_BASE_URL` com a origem do backend, sem `/api/v1` no final. Para rodar o backend localmente, use `http://localhost:8000`.

O frontend envia cookies com `credentials: "include"`. No backend, `CORS_ALLOWED_ORIGINS` e `CSRF_TRUSTED_ORIGINS` precisam aceitar a origem do frontend. O `.env` já está no `.gitignore`.

### 5. Rodar

Inicie o backend em outro terminal e rode o frontend aqui:

```bash
npm start
```

A aplicação abre em `http://localhost:3000`. Pare o servidor com `Ctrl + C`.

### Acesso de membro externo

O código do convite tem o formato `UFVJM-XXXX-XXXX-XXXX-XXXX`. O backend envia esse código só por e-mail. Nenhuma tela mostra o código.

Quem gerencia a banca vê o e-mail do convidado e tem os botões "Reenviar convite" e "Gerar novo convite".

No stack de desenvolvimento do backend, os e-mails vão para o Mailpit em `http://127.0.0.1:8025`. O membro externo digita o código na tela de login, na opção "Sou membro de banca externo".

## Testes

### Testes de componente

São os testes rápidos. Rodam com `tsc` e Jest:

```bash
npx tsc --noEmit
CI=true npm test -- --watchAll=false
```

### Testes end-to-end

A suíte usa o navegador. Ela sobe sozinha um backend isolado em `:8001` e o frontend em `:3001`. Não reaproveita servidores que já estejam nessas portas, para não gravar dados de teste no banco da aplicação.

Instale o navegador uma vez:

```bash
npx playwright install chromium
```

O backend da suíte roda em Python. Crie o ambiente virtual dele antes:

```bash
cd ../thesis-manager-ufvjm-backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cd ../thesis-manager-ufvjm-frontend
```

Rode a suíte na raiz do frontend e no host. Não deixe nada ocupando a porta `:3001` antes de começar.

```bash
npm run test:e2e
npx playwright test e2e/auth.spec.ts
npx playwright test -g "exporta o log em CSV"
```

Para duas suítes ao mesmo tempo, use `./scripts/run-e2e-isolated.sh`.

O smoke `e2e/smoke-real.spec.ts` cria uma banca com membro externo pela API, confere o convite na interface, lê o token no Mailpit e troca o token por uma sessão externa. Ele roda em stack Compose separado e fica fora da suíte isolada:

```bash
./scripts/smoke-stack.sh
```

O script usa `COMPOSE_PROJECT_NAME=thesis-smoke`, portas 9000, 9001 e 9025, e apaga os volumes quando termina. Não rode o smoke contra o stack de desenvolvimento.

Se o socket do Docker negar acesso, libere só o binário do Docker:

```bash
echo "$(whoami) ALL=(root) NOPASSWD: /usr/bin/docker" | sudo tee /etc/sudoers.d/docker-nopass
sudo chmod 440 /etc/sudoers.d/docker-nopass
sudo visudo -c
```

Se uma execução antiga gravou no banco da aplicação, rode no backend. O primeiro comando mostra o que seria removido. O segundo executa a remoção. Troque a URL pelo endereço real do banco:

```bash
cd ../thesis-manager-ufvjm-backend
DATABASE_URL='postgresql://usuario:senha@host:5432/banco' .venv/bin/python manage.py cleanup_e2e_data
DATABASE_URL='postgresql://usuario:senha@host:5432/banco' .venv/bin/python manage.py cleanup_e2e_data --apply
```

O teste do repositório público publica um TCC no backend isolado, busca pelo título e confere o SHA-256 no detalhe. Cadastro de acervo, edição de metadados e despublicação estão em `e2e/repository-management.spec.ts`. A suíte isolada usa `/api/v1/auth/dev-login`, porque o login com Google depende de credenciais externas.

Localmente o reporter do Playwright é `list`. Quando `CI` está definido, o relatório HTML vai para uma pasta `playwright-report-` seguida do número da execução. Para abrir um relatório existente, use o número da sua execução no lugar de 12345:

```bash
npx playwright show-report playwright-report-12345
```

Em caso de falha, screenshots, traces e o contexto do erro ficam em `test-results-*`. As variáveis opcionais são `E2E_BASE_URL` e `E2E_API_URL`.

## Gerar a versão de produção

```bash
npm run build
```

Para servir a pasta `build`, aponte a raiz do servidor estático para ela:

```bash
npx serve -s build
```

## Estrutura do diretório

```text
src/api/          chamadas à API e tratamento de erros
src/components/   componentes comuns, layout, gráficos e busca
src/data/         formatação de dados e constantes
src/hooks/        hooks compartilhados
src/views/        telas por fluxo, com pastas para bancas e repositório
src/types/        tipos TypeScript
src/App.tsx       rotas e composição das telas
e2e/              especificações Playwright e auxiliares
scripts/          execução isolada e smoke do stack real
readme/           imagens usadas neste arquivo
```
