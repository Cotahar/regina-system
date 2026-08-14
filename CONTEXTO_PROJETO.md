# Contexto do projeto Regina System / Frottex - B. Nunes — para retomar em outra máquina

> Leia este arquivo inteiro antes de fazer qualquer alteração. Ele resume tudo que foi decidido e feito até agora em várias sessões anteriores com o Claude, para que o trabalho continue sem perder contexto. Última atualização: **13/08/2026**.

## 0. Resumo rápido (se só tiver 30 segundos)

- Sistema: **Frottex - B. Nunes**, gestão de cargas/fretes pra uma transportadora. Node.js/Express/SQLite puro, front vanilla JS, Tailwind.
- Repo: `C:\regina-site` → `https://github.com/Cotahar/regina-system.git`, branch `main`. Sistema novo mora todo em `v2/`.
- **Em produção, no ar**: `https://bnunes.frottex.com.br` (Railway, serviço `regina-node`, projeto `sunny-caring`).
- Está **tudo funcionando e testado** — dashboard, montagem, gerenciar faturamento, avarias, **envio de pagamento por WhatsApp** e **importação automática de NF-e por email** (as duas features mais recentes, ambas em produção).
- **Regra de trabalho combinada com o usuário**: não fazer `git commit`/`push`/deploy sem ele pedir explicitamente — trabalhar local, testar no navegador, e só mandar pra produção quando ele confirmar. (Na prática, ultimamente ele tem aprovado o push assim que confirma que testou e gostou — mas o padrão é sempre perguntar antes.)
- Arquivo `.env` (segredos locais, incluindo credenciais do Gmail) **não está no Git** — não vem junto ao clonar o repo nessa máquina nova. Ver seção 10.

## 1. Quem é o usuário e o que ele quer

O usuário (Ruan) trabalha na B. Nunes Logística (transportadora) e é dono/mantenedor do sistema interno de gestão de cargas. Pediu pra reescrever o sistema antigo (Python/Flask, feito com ajuda do Gemini) numa stack nova, e desde então tem pedido uma sequência grande de melhorias, correções e features novas.

Stack **exigida** pelo usuário (já usada em outro projeto dele):
- **JavaScript** em tudo — backend em **Node.js puro + Express**, frontend em **JS vanilla com ES modules** (sem framework tipo React/Vue)
- **SQL** — SQLite via **`node:sqlite`** (módulo nativo do Node, sem ORM)
- **HTML/CSS** — HTML gerado via **template strings no JS** (sem Jinja2/EJS/etc), CSS com **TailwindCSS compilado via CLI** (sem CDN)

## 2. Repositório e estrutura

- Repo: `C:\regina-site` no PC atual, remoto `https://github.com/Cotahar/regina-system.git`, branch `main`, repositório público.
- **Sistema antigo (Python/Flask)**: fica na raiz do repo (`app.py`, `models.py`, etc). Estava rodando em produção no Railway (serviço `regina-system`) — status atual de aposentadoria não confirmado nesta sessão, mas o sistema novo já é o usado no dia a dia.
- **Sistema novo (Node.js)**: fica inteiro dentro da pasta **`v2/`**. Autocontido (`v2/package.json` próprio).

## 3. Decisões de escopo e padrões estabelecidos

- Papéis/permissões: modelo binário `admin` / `usuario`.
- Fotos de avarias: guardadas localmente no servidor (`uploads/avarias/`, volume persistente).
- Importação de planilhas: CSV (clientes/motoristas/veículos), mais opção de **colar direto do Excel** (sem precisar salvar arquivo).
- Combobox nativo (sem Select2/jQuery), busca por substring num dropdown customizado (`public/js/shared/combobox.js`).
- Tema visual: **dark theme**, marca "Frottex - B. Nunes" (preto/amarelo), não o tema claro do rascunho inicial.
- Notificação em tempo real entre usuários via **Server-Sent Events** (`/api/eventos`) — qualquer mutação (POST/PUT/DELETE) dispara `notificarMudanca()` automaticamente (middleware `notificarAposMutacao`), outras telas abertas recarregam sozinhas.
- Padrão "auto-save": ações em lote (agrupar, aplicar em massa, etc.) salvam sozinhas, sem esperar clique manual em "Salvar" separado — foi um pedido explícito do usuário depois de um bug onde agrupamento não persistia.

## 4. O que já foi construído em `v2/` — módulos principais (todos testados e em produção)

1. **Autenticação/sessão** — login, logout, sessão em memória (cookie httpOnly + Map no servidor; **reiniciar o servidor derruba sessões ativas**, todo mundo precisa logar de novo — isso é esperado, não é bug).
2. **Clientes** — CRUD completo, importação CSV/colar, e agora também **campo CNPJ** (usado para casar automaticamente com notas fiscais importadas).
3. **Motoristas / Veículos** — CRUD + importação. Veículos tem flag **`is_frota`** (frota própria vs terceirizado) e campo **`dados_pagamento`** (texto livre com dados bancários/PIX, usado no Envio de Pagamento).
4. **Marcas, Formas de pagamento, Unidades, Tipos de CT-e** — CRUD.
5. **Usuários** — CRUD admin/usuario, usuário `id=1` protegido.
6. **Painel de Cargas** (dashboard kanban: Pendente / Agendada / Em Trânsito) — cards mostram badge **FROTA** quando o veículo é da frota. Fluxo completo de status, "Devolver para Rascunho", exclusão admin, impressão de espelho.
7. **Montagem** — criar entregas avulsas ("disponíveis"), montar/editar rascunho, confirmar → vira carga Pendente. Linhas do rascunho aberto ficam destacadas visualmente (cor diferente) das demais.
8. **Consulta** — busca com filtros + paginação, reaproveita o mesmo modal de detalhes do Painel.
9. **Gerenciar Carga / Faturamento** — tabela estilo Excel editável inline. **Agrupamento de notas** (mesmo remetente+destinatário) mescla visualmente numa linha só (NFs concatenadas "123 / 456", peso e frete somados) — isso alimenta o Relatório de Faturamento (que também agrupa por `grupo_id`, uma linha por grupo pra emissão de CT-e). Cortesia não agrupa com nota normal. Todas as ações (agrupar, desagrupar, excluir em massa, aplicar em massa) salvam sozinhas (auto-save).
10. **Avarias** — fluxo Pendente → Enviado → Finalizada, upload de foto local.
11. **Relatórios de impressão** — Espelho de Carga e Relatório de Faturamento, visual redesenhado (cabeçalho enxuto, observações de faturamento separadas de observações de carga, seção "Manifesto e Pagamento ao Motorista" no rodapé com Rota/Vale Pedágio/Frete/Adiantamento).
12. **Modal de detalhes de carga** — informações do cliente (precisa agendamento? faz autodescarga? etc.) sempre visíveis (não escondidas atrás de tooltip), aviso destacado quando falta agendar descarga. Textarea de observações com altura automática. Permite mover Pendente→Agendada sem motorista/veículo definidos ainda.

## 5. Feature: Envio de Pagamento (WhatsApp) — completa, em produção

Botão **"Envio de Pagamento"** no modal de detalhes da carga (só aparece se status Agendada/Em Trânsito **e** motorista+veículo definidos). Abre `/pagamento-carga.html?carga_id=X` numa aba nova (mesmo padrão do "Gerenciar/Fat.").

- **Frota**: tudo automático (motorista, origem, frete empresa, peso, frete motorista) — só pede pra escolher o **destino final** quando a carga tem entregas em mais de uma cidade (não existe mais flag de "última entrega" pra adivinhar sozinho).
- **Terceiro**: Nosso Frete/Frete Motorista/Adiantamento vêm do sistema; **Saldo** e **Vale Pedágio** são digitados manualmente (nunca calculados automaticamente — o usuário explicou que descontos de impostos/taxas fazem a conta não fechar exato); **Dados de pagamento** salvos **por placa** no cadastro do veículo, reaproveitados nas próximas cargas do mesmo caminhão.
- Botões: **Salvar**, **Enviar no WhatsApp** (abre `wa.me/?text=...` com a mensagem pronta, deixa escolher a conversa — não há telefone cadastrado em motorista/veículo, então não dá pra pré-selecionar o contato), **Copiar mensagem**, **Fechar** (fecha a aba).
- Campo `cargas.vale_pedagio_valor` é **separado** de `cargas.vale_pedagio_rota` (que é outro campo, usado no Gerenciar Faturamento — não confundir os dois).

## 6. Feature: Notas Fiscais — importação automática por email (a mais nova, completa e em produção)

**Objetivo**: parar de digitar manualmente NF/peso no Gerenciar Faturamento consultando o sistema da fábrica — as notas chegam por email e o sistema lê sozinho.

### Infraestrutura (fora do código, já configurada)
- **Cloudflare Email Routing**: `notas@frottex.com.br` → encaminha pra `frottex.notasfiscais@gmail.com` (conta Gmail dedicada, criada só pra isso).
- Sistema lê essa caixa via **API oficial do Gmail com OAuth** (nunca senha — Gmail bloqueia login por senha pra apps mesmo).
- Credenciais (`GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`) **já configuradas como variável de ambiente no Railway** (serviço `regina-node`, produção) — a importação automática já está rodando ao vivo, confirmado no log: `[notas-fiscais] importacao automatica ativa (a cada 180s)`.
- **Atenção**: o app OAuth no Google Cloud Console fica em modo "Testing" — se ele ficar assim, o refresh token expira sozinho em **7 dias**. Foi orientado o usuário a clicar em "PUBLICAR APLICATIVO" (Publish App) na Tela de permissão OAuth pra tirar essa expiração — **confirmar se ele já fez isso**; se não, a importação vai parar de funcionar sozinha depois de uma semana e vai precisar rodar `npm run gmail:oauth-setup` de novo pra gerar um token novo.

### Como funciona
- `src/services/nfe.service.js`: parser de **XML da NF-e** (schema padrão, confiável — número, chave de acesso, CNPJ emitente/destinatário, peso, valor, data de emissão, placa do veículo quando presente no campo estruturado, motorista via busca em texto livre nas informações complementares) e parser de **PDF/DANFE** (melhor esforço via `pdf-parse` + regex, sempre marcado como "conferir manualmente").
- `src/services/gmailImport.service.js`: a cada 3 minutos, busca email não lido com anexo, baixa XML/PDF, extrai dados, casa remetente/destinatário por **CNPJ** com a tabela `clientes` (por isso o campo CNPJ foi adicionado lá), grava em `notas_fiscais_email`, marca o email como lido.
- **Data de emissão sempre normalizada** pra `AAAA-MM-DD` na gravação (independente de vir com hora/fuso do XML ou "dd/mm/aaaa" do PDF) — evita mostrar formatos diferentes na listagem.
- Tela `/notas-fiscais.html`: lista as notas (número, emitente/destinatário com selo "casado"/"sem cliente", peso, valor, emissão, **placa**, **motorista**, origem XML/PDF, status). Duas ações em massa:
  - **Vincular a uma carga**: escolhe a carga (busca por código, origem, **motorista** ou **placa**, inclui Pendente/Agendada/Rascunho) → escolhe em qual linha (entrega) cada nota entra → preenche **NF + peso** nessa linha (nunca o frete — valor da NF é valor da mercadoria, não do frete, são coisas diferentes).
  - **Criar entrega disponível**: cria entrega solta (aparece na Montagem), pede pra escolher cliente manualmente quando não casou por CNPJ.
- `src/scripts/gmail-oauth-setup.mjs`: script de autorização única (`npm run gmail:oauth-setup`), abre um servidor local temporário pra capturar o retorno do Google automaticamente.

## 7. Deploy — status atual

- **Workspace Railway**: "cotahar's Projects", projeto **"sunny-caring"**.
- **Serviço**: `regina-node` (Node.js, produção) — `rootDirectory: v2`, build `npm install && npm run css:build`, start `npm run db:migrate && npm start`.
- **Domínio**: **https://bnunes.frottex.com.br** (domínio próprio, não é mais o `*.up.railway.app` genérico).
- **Volume persistente** em `/data` (banco SQLite + uploads de avarias + uploads de notas fiscais sobrevivem a redeploys).
- **Variáveis de ambiente em produção** (Railway): `NODE_ENV`, `SESSION_SECRET`, `DATABASE_PATH=/data/cargas.db`, `UPLOADS_DIR=/data/uploads`, e agora também `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`.
- Workflow de deploy usado nas sessões: `git push` → `railway deployment list --service regina-node --environment production --json` (polling até `SUCCESS`) → `curl` na URL pública pra confirmar que voltou 200.
- Pra configurar variável de ambiente sensível via `railway variable set` pelo terminal: **o classificador de segurança do Claude Code bloqueia automaticamente** comandos com "SECRET" no texto — nesses casos, o usuário precisa rodar o comando ele mesmo (ou usar o painel do Railway).

## 8. Como rodar localmente

```bash
cd v2
npm install
npm run db:migrate
npm run css:build
npm start
```
Acessa em `http://localhost:3000`. Requer Node >= 22.5 (`node:sqlite` nativo). Login padrão do seed: `admin` / `admin123`.

**Importante sobre o servidor local**: usar `npm start` (não `npm run dev`) quando for testar login/sessão — o `--watch` do `dev` reinicia o processo a cada mudança de arquivo em `src/`, e como a sessão é em memória, isso derruba o login no meio do teste. Depois de editar `src/views/*.js` ou `src/routes/*.js`, precisa reiniciar o servidor manualmente (cache de módulo do Node) — editar `public/js/*.js` não precisa (servido direto via `express.static`). Depois de editar `src/db/schema.sql` ou `src/db/patches.js`, rodar `npm run db:migrate` de novo antes de testar.

## 9. Regras de colaboração combinadas com o usuário

- **Nunca commitar/dar push/fazer deploy sem pedir antes** — trabalhar local, testar de verdade no navegador (não só confiar na leitura do código), e só mandar pra produção quando o usuário confirmar explicitamente ("manda bala", "pode ir", etc.).
- Quando o usuário pede uma feature grande/ambígua, vale entrar em modo de planejamento (pesquisar o código, propor um plano concreto, alinhar antes de implementar) — isso já rendeu bons resultados nas últimas duas features grandes.
- **Nunca inserir senha em campo nenhum**, mesmo que o usuário mande explicitamente e insista — nem em formulário, nem em script. Client ID/secret de OAuth pode ser guardado em `.env` local normalmente (não é senha, é config de app). Se o usuário mandar uma senha em texto no chat, orientar a trocar.
- Testar com dados reais sempre que possível (o usuário já autorizou puxar dados de produção via SSH pro banco local, só leitura, pra testar em cima de casos reais em vez de dados fake).

## 10. Pegadinhas específicas dessa máquina nova (importante!)

- **`.env` não está no Git** (por segurança, correto) — então ao clonar o repo aqui, esse arquivo **não vem junto**. Sem ele, a importação automática de Gmail fica desligada localmente (o resto do sistema funciona normal, só loga um aviso). Pra reativar localmente nessa máquina: ou copiar o `.env` da máquina antiga por um canal privado (pendrive, etc — nunca colar os valores em texto no chat), ou gerar um refresh token novo rodando `npm run gmail:oauth-setup` de novo (os valores de `GMAIL_CLIENT_ID`/`GMAIL_CLIENT_SECRET` estão salvos no painel do Railway, em Variables, se precisar consultar).
- **A memória de longo prazo do Claude Code é por máquina** (fica em `~/.claude/`, local) — o que foi aprendido/registrado na sessão da máquina antiga (preferências do usuário, decisões, etc.) não aparece automaticamente aqui. Esse arquivo (`CONTEXTO_PROJETO.md`) existe justamente pra compensar isso — vale a pena o Claude, ao começar a trabalhar nessa máquina, também recriar as memórias mais importantes (principalmente a regra de "não fazer push sem pedir" da seção 9).
- `.claude/launch.json` (config do preview local, se existir) também não vem no clone — é só recriar apontando pro `npm run dev`/`npm start` na pasta `v2`, porta 3000, se for usar as ferramentas de preview de navegador.
