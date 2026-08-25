# Gerenciador de Estágios

Sistema para gerenciamento e acompanhamento de estágios acadêmicos, desenvolvido para centralizar informações de alunos, controlar a documentação necessária e identificar automaticamente pendências.

O sistema permite cadastrar alunos, registrar informações do estágio, armazenar documentos em PDF e acompanhar a situação documental de cada estágio em uma interface centralizada.

---

## Visão geral

O gerenciamento de documentos de estágio pode envolver diversos arquivos, alunos e diferentes requisitos dependendo do tipo de estágio.

Este projeto busca simplificar esse processo através de um sistema que relaciona:

```text
Aluno
  |
  +--- Informações acadêmicas
  |
  +--- Informações do estágio
  |
  +--- Documentos necessários
  |
  +--- Documentos enviados
  |
  +--- Situação documental
```

A aplicação verifica automaticamente os documentos obrigatórios e informa se a documentação está completa ou se existem pendências.

---

## Screenshots

### Dashboard

Tela principal do sistema, responsável por apresentar os alunos cadastrados e a situação geral dos estágios.

![Dashboard](docs/screenshots/dashboard.png)

### Cadastro de aluno

Interface utilizada para registrar um novo aluno e suas informações de estágio.

![Cadastro de aluno](docs/screenshots/cadastro-aluno.png)

### Ficha do aluno

Exibe as informações completas do estágio e a situação da documentação.

![Ficha do aluno](docs/screenshots/ficha-aluno.png)

### Gerenciamento de documentos

Permite visualizar, adicionar e remover os documentos relacionados ao estágio.

![Documentos](docs/screenshots/documentos.png)

> As imagens acima devem ser adicionadas posteriormente ao diretório `docs/screenshots/`.

---

## Principais funcionalidades

### Gerenciamento de alunos

* Cadastro de alunos
* Edição de informações
* Exclusão de alunos
* Pesquisa por nome ou matrícula
* Visualização da ficha individual

### Gerenciamento de estágios

* Registro da empresa
* Registro do período do estágio
* Identificação do tipo de estágio
* Definição de estágio obrigatório ou não obrigatório

### Gerenciamento documental

* Cadastro dos documentos necessários
* Upload de arquivos PDF
* Visualização dos documentos enviados
* Exclusão de documentos
* Associação automática dos documentos ao aluno

### Validação automática

O sistema verifica os documentos necessários para cada estágio e determina automaticamente sua situação.

Exemplo:

```text
Documentos necessários: 4
Documentos enviados:    3

Situação: DOCUMENTAÇÃO PENDENTE

Pendência:
- Seguro
```

Quando todos os documentos obrigatórios estão presentes:

```text
Documentos necessários: 4
Documentos enviados:    4

Situação: DOCUMENTAÇÃO COMPLETA
```

---

# Arquitetura

O sistema utiliza uma arquitetura web baseada em Flask, com separação entre interface, lógica de negócio, banco de dados e armazenamento de arquivos.

```text
                         ┌─────────────────────┐
                         │       Usuário       │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │     Interface Web   │
                         │     HTML / CSS / JS  │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │       Flask         │
                         │      Backend        │
                         └──────────┬──────────┘
                                    │
                     ┌──────────────┴──────────────┐
                     │                             │
                     ▼                             ▼
           ┌─────────────────┐          ┌──────────────────┐
           │     SQLite      │          │ Armazenamento    │
           │    Database     │          │    de PDFs       │
           └─────────────────┘          └──────────────────┘
```

### Camadas

**Interface**

Responsável pela apresentação das informações e interação com o usuário.

Tecnologias:

* HTML
* CSS
* JavaScript

**Backend**

Responsável pelas rotas, regras de negócio, processamento de documentos e comunicação com o banco de dados.

Tecnologia:

* Python
* Flask

**Persistência**

Responsável pelo armazenamento das informações dos alunos, estágios e documentos.

Tecnologia:

* SQLite

**Armazenamento**

Os arquivos PDF são armazenados no sistema de arquivos, enquanto seus metadados e relacionamentos são registrados no banco de dados.

---

# Modelo de dados

A estrutura principal do banco de dados pode ser representada da seguinte maneira:

```text
┌──────────────┐
│    ALUNOS    │
├──────────────┤
│ id           │
│ nome         │
│ matricula    │
│ curso        │
└──────┬───────┘
       │
       │ 1:N
       ▼
┌──────────────┐
│   ESTÁGIOS   │
├──────────────┤
│ id           │
│ aluno_id     │
│ empresa      │
│ inicio       │
│ termino      │
│ obrigatorio  │
└──────┬───────┘
       │
       │ 1:N
       ▼
┌──────────────┐
│  DOCUMENTOS  │
├──────────────┤
│ id           │
│ estagio_id   │
│ tipo         │
│ arquivo      │
│ data_envio   │
└──────────────┘
```

Essa estrutura permite que cada aluno possua um estágio e que cada estágio possua diversos documentos.

---

# Stack

| Categoria            | Tecnologia |
| -------------------- | ---------- |
| Linguagem            | Python     |
| Backend              | Flask      |
| Banco de dados       | SQLite     |
| Frontend             | HTML5      |
| Estilização          | CSS3       |
| Interatividade       | JavaScript |
| Documentos           | PDF        |
| Controle de versão   | Git        |
| Hospedagem do código | GitHub     |

---

# Requisitos

Para executar o projeto localmente, são necessários:

* Python 3.10 ou superior
* pip
* Git
* Navegador web

Verifique a instalação do Python:

```bash
python --version
```

Verifique o pip:

```bash
pip --version
```

Verifique o Git:

```bash
git --version
```

---

# Instalação

## 1. Clone o repositório

```bash
git clone https://github.com/SEU-USUARIO/gerenciador-estagios.git
```

Entre no diretório:

```bash
cd gerenciador-estagios
```

## 2. Crie um ambiente virtual

Linux/macOS:

```bash
python3 -m venv venv
source venv/bin/activate
```

Windows:

```powershell
python -m venv venv
venv\Scripts\activate
```

## 3. Instale as dependências

```bash
pip install -r requirements.txt
```

## 4. Execute o sistema

```bash
python app.py
```

A aplicação estará disponível localmente em:

```text
http://localhost:5000
```

---

# Estrutura do projeto

```text
gerenciador-estagios/
│
├── app.py
├── requirements.txt
├── README.md
├── .gitignore
│
├── database/
│   └── database.db
│
├── documents/
│   └── ...
│
├── templates/
│   ├── index.html
│   ├── cadastro.html
│   ├── aluno.html
│   └── documentos.html
│
├── static/
│   ├── css/
│   │   └── style.css
│   │
│   ├── js/
│   │   └── script.js
│   │
│   └── images/
│
└── docs/
    └── screenshots/
        ├── dashboard.png
        ├── cadastro-aluno.png
        ├── ficha-aluno.png
        └── documentos.png
```

---

# Fluxo de utilização

```text
                    Início
                      │
                      ▼
              Cadastrar aluno
                      │
                      ▼
             Registrar estágio
                      │
                      ▼
          Estágio obrigatório?
               │            │
              Sim           Não
               │            │
               ▼            ▼
       Definir documentos   Cadastro
          necessários       concluído
               │
               ▼
        Enviar documentos
               │
               ▼
       Validar documentação
               │
          ┌────┴────┐
          │         │
       Completa   Pendente
          │         │
          ▼         ▼
       Regular   Exibir
                 pendências
```

---

# Regras de negócio

A situação documental de cada estágio é determinada com base nos documentos considerados obrigatórios.

### Documentação completa

Um estágio é considerado regular quando todos os documentos obrigatórios foram enviados.

### Documentação pendente

Caso um ou mais documentos obrigatórios não tenham sido enviados, o sistema identifica a pendência e apresenta quais documentos ainda são necessários.

### Estágio não obrigatório

Para estágios não obrigatórios, os requisitos documentais podem seguir uma configuração específica definida pelo responsável pelo sistema.

---

# Segurança

Como o sistema pode armazenar documentos acadêmicos e informações pessoais, alguns cuidados devem ser considerados durante sua implantação.

Entre as medidas previstas estão:

* Validação do tipo de arquivo enviado
* Limitação do tamanho dos arquivos
* Nomes de arquivos tratados pelo sistema
* Separação entre dados do banco e arquivos enviados
* Controle de acesso ao sistema
* Backup periódico do banco de dados
* Restrição de acesso ao diretório de documentos

Em uma futura implantação em servidor, recomenda-se adicionar autenticação, autorização, HTTPS e armazenamento protegido dos documentos.

---

# Backup

Em uma instalação local, recomenda-se realizar backup periódico de:

```text
database/
documents/
```

O backup deve preservar tanto o banco de dados quanto os documentos armazenados, pois ambos são necessários para restaurar o sistema.

---

# Roadmap

Funcionalidades planejadas:

* [ ] Sistema de autenticação
* [ ] Controle de permissões
* [ ] Dashboard com estatísticas
* [ ] Sistema de busca avançada
* [ ] Filtros por situação
* [ ] Exportação de relatórios
* [ ] Geração de relatórios em PDF
* [ ] Histórico de alterações
* [ ] Controle de validade dos documentos
* [ ] Notificações de pendências
* [ ] Sistema de backup automático
* [ ] Implantação em servidor

---

# Contribuição

Contribuições são bem-vindas.

Para contribuir:

```bash
git clone https://github.com/SEU-USUARIO/gerenciador-estagios.git
```

Crie uma nova branch:

```bash
git checkout -b feature/nova-funcionalidade
```

Faça as alterações e registre um commit:

```bash
git add .
git commit -m "feat: adiciona nova funcionalidade"
```

Envie a branch:

```bash
git push origin feature/nova-funcionalidade
```

Depois, abra um Pull Request no GitHub.

---

# Versionamento

O projeto utiliza Git para controle de versão.

As mensagens de commit seguem, preferencialmente, o padrão:

```text
feat: nova funcionalidade
fix: correção de problema
refactor: alteração estrutural
docs: atualização da documentação
style: alterações de estilo
chore: tarefas de manutenção
```

---

# Licença

Este projeto foi desenvolvido para fins acadêmicos.

Caso o projeto seja posteriormente disponibilizado como software, recomenda-se definir uma licença específica de acordo com a finalidade de distribuição.

---

# Autor

Desenvolvido por **[SEU NOME]**.

Projeto acadêmico voltado ao desenvolvimento de uma solução para gerenciamento e acompanhamento de estágios.
