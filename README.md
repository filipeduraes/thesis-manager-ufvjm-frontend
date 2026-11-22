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

### Acesso de membros externos da banca

O código de acesso dos membros externos (`UFVJM-XXXX-XXXX-XXXX-XXXX`) é enviado pelo backend somente por e-mail; nenhuma tela o exibe. Quem gerencia a banca vê para qual e-mail o convite foi enviado e pode usar "Reenviar convite" ou "Gerar novo convite". Em desenvolvimento com o `docker-compose.yml` do backend, os e-mails ficam no Mailpit em `http://127.0.0.1:8025`; o membro externo usa o código na tela de login, em "Sou membro de banca externo".

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
