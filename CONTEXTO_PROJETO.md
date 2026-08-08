# Contexto do projeto Regina System — para retomar em outra máquina

> Leia este arquivo inteiro antes de fazer qualquer alteração. Ele resume tudo que foi decidido e feito até agora numa sessão anterior com o Claude, para que o trabalho continue sem perder contexto.

## 1. Quem é o usuário e o que ele quer

O usuário (Ruan) trabalha numa transportadora e é dono/mantenedor de um sistema interno de gestão de cargas, feito originalmente com ajuda do Gemini (Google), sem ele ser programador. Ele está **migrando de função dentro da empresa**: vai passar a cuidar só da parte **comercial** (fechar cargas com clientes, cadastrar no sistema), enquanto outro funcionário vai cuidar da parte **operacional** (atribuir motorista/veículo, acompanhar a carga na estrada, avarias, etc). Ele pediu para usar o Claude Code para analisar, corrigir bugs e modernizar o sistema, e depois reescrever a stack inteira.

Stack **exigida** pelo usuário para o sistema novo (já usada em outro projeto dele):
- **JavaScript** em tudo — backend em **Node.js puro + Express**, frontend em **JS vanilla com ES modules** (sem framework tipo React/Vue)
- **SQL** — SQLite via **`node:sqlite`** (módulo nativo do Node, sem ORM)
- **HTML/CSS** — HTML gerado via **template strings no JS** (sem Jinja2/EJS/etc), CSS com **TailwindCSS compilado via CLI** (sem CDN)
- **JSON** — configs (`package.json`, `railway.json`)

## 2. Repositório e estrutura

- Repo: `C:\regina-site` no PC atual, remoto `https://github.com/Cotahar/regina-system.git`, branch `main`, **repositório público**.
- **Sistema antigo (Python/Flask)**: fica na raiz do repo (`app.py`, `models.py`, `database.py`, templates HTML soltos na raiz, etc). **Ainda está rodando em produção no Railway** (serviço `regina-system`), mas o plano é aposentá-lo em breve.
- **Sistema novo (Node.js)**: fica inteiro dentro da pasta **`v2/`**. É autocontido (`v2/package.json` próprio, não depende de nada da raiz).
- `exportar_para_node.py` (raiz) + `v2/src/db/import-from-python.js`: par de scripts para migrar dados do banco Python antigo pro SQLite novo. **O usuário disse que isso não é necessário** — o sistema novo vai começar com dados zerados, sem migrar histórico.

## 3. O que foi feito com o sistema Python antigo (ainda em produção)

Antes de começar a reescrita, foi feita uma auditoria do `app.py` (Flask + SQLAlchemy + Postgres no Railway) e do frontend (HTML/CSS/JS vanilla + jQuery/Select2). Foram encontrados e **corrigidos** (commit `f948bfe "Corrige falhas de seguranca criticas"`, já commitado e enviado ao GitHub):

1. **Rota `/fix-db-emergency` sem nenhuma autenticação** que rodava `ALTER TABLE` arbitrário no banco de produção — **removida**.
2. **`app.secret_key` do Flask hardcoded no código** — movida para variável de ambiente `FLASK_SECRET_KEY` (com fallback de dev). *(O usuário decidiu não configurar essa variável no Railway porque vai aposentar o Python logo — não é mais prioridade.)*
3. **Segredos versionados no Git**: `client_secret.json` (credencial OAuth real do Google, usada para upload de fotos de avarias no Google Drive) e `.env.railway` estavam commitados. Foram removidos do rastreamento do Git (`git rm --cached`) e adicionados ao `.gitignore` corrigido (estava malformado, com duas entradas coladas na mesma linha por falta de quebra de linha).
4. **Credencial do Google já revogada pelo usuário** diretamente no Google Cloud Console (confirmado por ele). O token completo (incluindo `refresh_token`) ainda está salvo como variável de ambiente `GOOGLE_TOKEN_CONTENT` no serviço Railway do Python — está morto (credencial revogada), mas vale apagar essa variável quando o Python for desligado, por higiene.

Bugs identificados na auditoria do frontend antigo (script.js, consulta.js, montagem.js, gerenciar_carga.js, avarias.js, marcas.js, usuarios.js, clientes.js) que **foram corrigidos na reescrita** (não no Python, só no sistema novo):
- Calculadora de frete por tonelada com argumentos trocados (`script.js`)
- `ReferenceError` ao salvar edição de entrega na tela de Consulta (variável não declarada)
- XSS armazenado sistêmico (uso de `innerHTML` sem escapar em quase toda página) e um `|safe` explícito no Jinja2 do relatório de faturamento que desabilitava autoescaping num campo de texto livre (nota fiscal)
- Atualização de rascunho na Montagem fazia "apaga tudo e recria" (`DELETE` + `POST`) em vez de update real — risco de perda de dados se a segunda chamada falhasse
- HTML inválido (`<table>` aninhada duplicada na Montagem, `id` duplicado no nav de Clientes)
- `onclick` com nome interpolado sem escapar aspas (`marcas.js`, `usuarios.js`) — quebrava ou injetava HTML se o nome tivesse aspas
- Lógica duplicada e divergente entre `script.js` e `consulta.js` (o "modal de detalhes da carga" era ~90% copiado e colado, com pequenas divergências que causaram os bugs acima)

## 4. Decisões de escopo tomadas com o usuário (perguntas feitas e respostas)

- **Papéis/permissões**: manter o modelo binário atual (`admin` / `usuario`), sem criar papéis novos "comercial"/"operacional" — só ajustar o que cada tela permite conforme necessário no futuro.
- **Fotos de avarias**: sair do Google Drive, guardar **localmente no servidor** (pasta `uploads/avarias/` dentro do volume persistente).
- **Abordagem de reescrita**: tudo de uma vez (não módulo por módulo com pausas pra revisão) — o usuário testaria tudo no final.
- **Migração de dados históricos**: **não necessária** — sistema novo começa zerado.
- **Importação de planilhas**: o sistema novo aceita apenas **CSV** para clientes/motoristas/veículos (não `.xlsx` binário — evita dependência pesada tipo `xlsx`/`exceljs`; Excel exporta CSV nativamente).
- **Select2/jQuery**: substituído por combobox nativo usando `<input list="..."> + <datalist>` (sem biblioteca externa, mantendo "vanilla JS puro").

## 5. O que já foi construído em `v2/` (sistema novo) — está tudo pronto e testado

Estrutura: `v2/src/routes` (rotas Express), `v2/src/views` (geração de HTML via template strings), `v2/src/db` (schema SQL + migrate/seed), `v2/src/middleware` (sessão + auth), `v2/src/services`, `v2/src/utils`, `v2/public/js/pages` e `v2/public/js/shared` (JS do navegador, ES modules), `v2/src/styles/input.css` + `v2/tailwind.config.js` (Tailwind).

**Todos os módulos abaixo estão implementados, com rotas de API + página + JS do cliente, e foram testados no navegador (login, CRUD completo, casos de borda) e via chamadas diretas de API quando o teste dependia de diálogo nativo (`confirm()`/`prompt()`, que o ambiente de automação de browser bloqueia sempre):**

1. **Autenticação/sessão** — login, logout, sessão em memória (cookie httpOnly + Map no servidor; reiniciar o servidor derruba sessões ativas — aceitável pro tamanho da equipe). Hash de senha via `crypto.scrypt` nativo do Node (sem bcrypt).
2. **Clientes** — CRUD completo + importação CSV + **cadastro manual avulso (não existia no sistema antigo, foi adicionado pensando no novo papel comercial do usuário)**.
3. **Motoristas / Veículos** — CRUD (o antigo só tinha import + listagem, sem editar; **edição foi adicionada**) + importação CSV.
4. **Marcas** — CRUD (usado nas avarias).
5. **Formas de pagamento, Unidades, Tipos de CT-e** — CRUD (unidades e tipos de CT-e ficam dentro da página de Usuários, como no sistema antigo).
6. **Usuários** — CRUD com permissão `admin`/`usuario`, usuário `id=1` (admin principal) protegido contra edição/exclusão.
7. **Painel de Cargas** (dashboard kanban: Pendente / Agendada / Em Trânsito) — criar carga, modal de detalhes com transições de status completas (Agendar → Iniciar Trânsito → Finalizar, com confirmação de senha), "Devolver para Rascunho", exclusão (admin, com opção de devolver entregas pro pool ou excluir junto), coleta rápida, edição/exclusão de entrega, seleção em lote + alterar remetente em lote, impressão de espelho.
8. **Montagem** — criar entregas avulsas, montar rascunho de carga a partir de entregas selecionadas, reabrir/editar rascunho existente (**update real agora, não "apaga e recria"**), confirmar rascunho → vira carga Pendente, agrupar entregas (soma peso/frete, concatena NFs), alterar remetente em lote.
9. **Consulta** — busca com filtros (código, origem, status, motorista, placa, cliente, datas) + paginação, reaproveitando o **mesmo componente de modal de detalhes** do Painel (`public/js/shared/carga-modal.js`) — elimina a duplicação de código que causava bugs divergentes no sistema antigo.
10. **Gerenciar Carga / Faturamento** — tabela estilo Excel editável inline (unidade, tipo CT-e, NF, peso, cubado, R$/ton com cálculo automático de frete, forma/tipo de pagamento), com **automação**: sugere a unidade com base na UF do cliente remetente (ou a unidade "matriz" como padrão) e herda forma/tipo de pagamento padrão do cliente. Cálculo automático do valor de adiantamento ao motorista. Relatório de impressão de faturamento.
11. **Avarias** — fluxo completo Pendente → Enviado → Finalizada, itens de produto avariado, geração automática de texto de laudo, **upload de foto local** (multer, salva em `uploads/avarias/`, protegido por login), exclusão remove as fotos do disco também.
12. **Relatórios de impressão** — espelho de carga (agrupamento por destino e por remetente) e relatório de faturamento (com o bug do `|safe`/XSS corrigido: NF com `/` quebra em `<br>` mas cada pedaço é escapado individualmente antes).

### Correções de caminho de armazenamento (para produção)

`DATABASE_PATH` (caminho do arquivo SQLite) e `UPLOADS_DIR` (pasta raiz de uploads) agora são configuráveis via variável de ambiente (commit `1710bcc`), para apontar pra um volume persistente em produção sem perder dados a cada deploy.

### Bugs reais encontrados e corrigidos durante os próprios testes do sistema novo (não existiam no antigo, foram introduzidos e pegos na hora)

- 2× rotas do Express "engolidas" por rota genérica `:id` por causa da ordem de registro (`/api/cargas/rascunhos` e `/api/entregas/bulk-update-remetente` precisavam vir **antes** de `/api/cargas/:id` e `/api/entregas/:id`)
- Campo de "Destinatário" sem o listener de busca-por-id ligado no formulário de nova entrega da Montagem
- Valor do adiantamento não persistia (o campo somente-leitura já formatado em "R$ 1.050,00" era relido e o parser de decimal não reconhecia o prefixo "R$") — corrigido recalculando o valor bruto direto em vez de reler o campo formatado; `parseDecimal` também foi endurecido pra aceitar strings com símbolo de moeda.

## 6. Testes realizados (bateria completa antes do deploy)

Boot limpo do zero (schema + seed), importação de CSV real (não só via API simulada) para clientes/motoristas/veículos, upload real de foto de avaria (PNG de teste, verificado no disco e servido corretamente com proteção de login), edição de entrega dentro do modal da carga, agrupar entregas + alterar remetente em lote na Montagem, exclusão de carga/avaria/usuário/motorista/veículo/marca (incluindo bloqueio de FK quando em uso), relatórios de impressão com carga de múltiplos remetentes/destinos, reteste do payload `<script>` real pra confirmar o fix de XSS, varredura de console em todas as páginas como admin e como usuário comum, e verificação de controle de acesso (admin-only bloqueado tanto por URL direta quanto por chamada de API direta).

**Nota sobre o ambiente de testes**: diálogos nativos do navegador (`confirm()`, `prompt()`) são sempre bloqueados/cancelados automaticamente pela ferramenta de automação de browser usada nas sessões do Claude Code — não é bug do app. Sempre que um teste dependia disso, foi validado via chamada direta à API (curl com cookie de sessão) em vez de clicar o botão na tela.

## 7. Deploy — status atual (feito e verificado)

Projeto Railway existente (workspace "cotahar's Projects", projeto **"sunny-caring"**, id `91b32010-ee95-4acc-9221-e1892297644f`) já tinha os serviços `regina-system` (Python, produção) e `Postgres`. Foi criado um **serviço novo, separado**, sem tocar nos outros dois:

- **Serviço**: `regina-node` (id `01b9e15a-ae00-4ba9-9ef7-3cb495873df4`)
- **Fonte**: mesmo repo GitHub (`Cotahar/regina-system`), branch `main`, **`rootDirectory: v2`**
- **Build**: `npm install && npm run css:build`
- **Start**: `npm run db:migrate && npm start`
- **Variáveis**: `NODE_ENV=production`, `SESSION_SECRET` (gerado aleatório), `DATABASE_PATH=/data/cargas.db`, `UPLOADS_DIR=/data/uploads`
- **Volume persistente**: montado em `/data` (banco SQLite + fotos de avarias sobrevivem a redeploys)
- **Domínio público**: **https://regina-node-production.up.railway.app**
- **Status do último deploy**: `SUCCESS`, verificado via login real na URL pública (não só localhost)

### Pegadinha de ambiente encontrada durante o deploy (caso precise mexer de novo)

No Git Bash do Windows, variáveis de ambiente com valor começando em `/` (tipo `/data/cargas.db`) são **auto-convertidas** para caminho Windows (`C:/Program Files/Git/data/cargas.db`) pelo MSYS — precisa prefixar o comando com `MSYS_NO_PATHCONV=1` pra evitar isso. Também: o comando `railway environment edit --service-config <nome> ...` (dot-path) não funcionou pra configurar a fonte de um serviço vazio recém-criado (sempre retornava "No changes to apply", mesmo usando o ID do serviço) — o que funcionou foi o **patch JSON completo** via `railway environment edit --json <<'JSON' ... JSON`. E `railway volume add --service <nome>` **crashava** (panic no Rust) quando usando nome/ambiente por nome — só funcionou passando **IDs explícitos** de projeto/ambiente/serviço.

## 8. Pendências / próximos passos (nada urgente, mas bom ter registrado)

1. **Trocar a senha do usuário `admin`** no sistema novo (está com a senha padrão do seed, `admin123`).
2. **Aposentar o serviço Python** (`regina-system`) no Railway quando o novo sistema estiver validado em uso real — e nessa hora, apagar a variável `GOOGLE_TOKEN_CONTENT` dele.
3. O serviço Python está sem `rootDirectory` configurado, então ele faz rebuild a cada push no repo (mesmo em commits que só tocam `v2/`) — inofensivo, só desperdiça minuto de build. Só vale a pena mexer nisso se o Python for ficar em produção por muito mais tempo.
4. Nenhuma migração de dados históricos foi feita (decisão do usuário) — o sistema novo está com o banco zerado (só dados de seed: marcas, unidades, tipos de CT-e, formas de pagamento padrão, usuário admin).
5. O par de scripts `exportar_para_node.py` + `v2/src/db/import-from-python.js` existe e foi testado (com dados fake) caso decidam migrar dados reais depois — não usado ainda.

## 9. Como rodar localmente

```bash
cd v2
npm install
npm run db:migrate
npm run css:build
npm start
```
Acessa em `http://localhost:3000`. Requer Node >= 22.5 (usa `node:sqlite` nativo, ainda experimental mas funcional).
