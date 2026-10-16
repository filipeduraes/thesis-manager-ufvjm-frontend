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

Substitua `<URL_DO_REPOSITORIO>` pelo endereço do repositório Git.

## 3. Instalar as dependências

Na raiz do projeto, execute:

```bash
npm install
```

Esse comando instala as dependências necessárias para executar e desenvolver a aplicação.

## 4. Configurar variáveis de ambiente

Caso o projeto utilize variáveis de ambiente, crie um arquivo `.env` na raiz do frontend e configure as variáveis necessárias para a aplicação.

Mantenha credenciais e outros dados sensíveis privados. Não versione arquivos `.env` que contenham informações confidenciais.

## 5. Executar o projeto

Para iniciar o servidor de desenvolvimento, execute:

```bash
npm run dev
```

Após a inicialização, o terminal exibirá o endereço local da aplicação. Acesse esse endereço pelo navegador.

Para interromper o servidor, pressione `Ctrl + C` no terminal.

## 6. Gerar a versão de produção

Para compilar o projeto para produção, execute:

```bash
npm run build
```

Para testar localmente a versão compilada, caso o projeto ofereça esse script, execute:

```bash
npm run preview
```

## 7. Desenvolvimento

Para atualizar sua cópia local do repositório e instalar as dependências, execute:

```bash
git pull
npm install
```

Em seguida, inicie o servidor de desenvolvimento:

```bash
npm run dev
```

Consulte a seção `scripts` do arquivo `package.json` para verificar os comandos disponíveis no projeto.