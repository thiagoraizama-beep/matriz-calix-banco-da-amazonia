CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nome TEXT NOT NULL,
  papel TEXT NOT NULL CHECK (papel IN ('agencia', 'veiculo', 'cliente')),
  veiculos TEXT[] NOT NULL DEFAULT '{}',
  foto_url TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMP NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS foto_url TEXT;

CREATE TABLE IF NOT EXISTS creatives (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  ad_name TEXT,
  campanha TEXT NOT NULL,
  conjunto TEXT,
  descricao TEXT,
  observacoes TEXT,
  periodo_inicio DATE,
  periodo_fim DATE,
  veiculo TEXT NOT NULL,
  cloudinary_public_id TEXT NOT NULL,
  cloudinary_url TEXT NOT NULL,
  tipo_midia TEXT NOT NULL CHECK (tipo_midia IN ('image', 'video')),
  status TEXT NOT NULL DEFAULT 'Não registrado',
  criado_por INTEGER NOT NULL REFERENCES users(id),
  criado_em TIMESTAMP NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMP NOT NULL DEFAULT now()
);

ALTER TABLE creatives ADD COLUMN IF NOT EXISTS observacoes TEXT;
ALTER TABLE creatives ADD COLUMN IF NOT EXISTS periodo_inicio DATE;
ALTER TABLE creatives ADD COLUMN IF NOT EXISTS periodo_fim DATE;
-- Formato/posicionamento do criativo (ex: Stories, Reels, Feed) para cruzar com a planilha.
ALTER TABLE creatives ADD COLUMN IF NOT EXISTS formato TEXT;

-- Novos campos da matriz expandida
ALTER TABLE creatives ADD COLUMN IF NOT EXISTS campaign_name TEXT;
ALTER TABLE creatives ADD COLUMN IF NOT EXISTS url_destino TEXT;
ALTER TABLE creatives ADD COLUMN IF NOT EXISTS impulsionado BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE creatives ADD COLUMN IF NOT EXISTS segmentacao TEXT;
ALTER TABLE creatives ADD COLUMN IF NOT EXISTS titulo TEXT;
ALTER TABLE creatives ADD COLUMN IF NOT EXISTS tipos_compra TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE creatives ADD COLUMN IF NOT EXISTS posicionamento TEXT;
ALTER TABLE creatives ADD COLUMN IF NOT EXISTS plataforma TEXT;

-- Link do post ja publicado organicamente, usado quando o criativo e "Impulsionado"
-- (o anuncio parte de um post existente na rede, nao de um arquivo novo enviado) --
-- substitui o upload de arquivo nesse caso. "Dark Post" continua exigindo arquivo,
-- ja que nao existe como post organico publicado.
ALTER TABLE creatives ADD COLUMN IF NOT EXISTS link_postagem TEXT;

-- cloudinary_public_id/cloudinary_url eram NOT NULL (todo criativo exigia arquivo).
-- Agora um criativo "Impulsionado" pode ser cadastrado so com link_postagem, sem
-- arquivo -- relaxa para NULL opcional. tipo_midia tambem fica opcional pelo mesmo
-- motivo (sem arquivo, nao ha tipo de midia a classificar).
ALTER TABLE creatives ALTER COLUMN cloudinary_public_id DROP NOT NULL;
ALTER TABLE creatives ALTER COLUMN cloudinary_url DROP NOT NULL;
ALTER TABLE creatives ALTER COLUMN tipo_midia DROP NOT NULL;

-- "Performance": marca opcional e independente do tipo de publicacao (Impulsionado
-- ou Dark Post) -- quando ligada, o criativo tem um orcamento projetado que e
-- comparado com o investimento real vindo da planilha (coluna Cost), exibido como
-- barra de progresso no card da Matriz.
ALTER TABLE creatives ADD COLUMN IF NOT EXISTS eh_performance BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE creatives ADD COLUMN IF NOT EXISTS orcamento_projetado NUMERIC(12,2);

ALTER TABLE creatives DROP CONSTRAINT IF EXISTS creatives_status_check;
ALTER TABLE creatives ADD CONSTRAINT creatives_status_check
  CHECK (status IN (
    'Não registrado', 'Em veiculação', 'Com erro', 'Programado', 'Pausado',
    'Em aprovação', 'Aprovado', 'Aguardando implementação', 'Ativo',
    'Interrompido', 'Finalizado'
  ));

-- Reforma de status: "Em veiculação" vira "Ativo" e "Interrompido" vira "Pausado"
-- (ambos removidos da lista por sobreposicao de significado). Migra os dados ANTES
-- de trocar a constraint, senao criativos com esses status antigos quebrariam o
-- CHECK novo.
UPDATE creatives SET status = 'Ativo' WHERE status = 'Em veiculação';
UPDATE creatives SET status = 'Pausado' WHERE status = 'Interrompido';

-- "Rascunho": criativo incompleto, salvo automaticamente quando o usuario fecha
-- o formulario com alteracoes sem confirmar a criacao -- nao passa pelas
-- validacoes normais (arquivo/formato/periodo etc podem estar vazios). So o
-- autor (criado_por) o ve, via lista "Meus rascunhos"; nunca aparece na
-- grade/Kanban nem para outros usuarios de agencia. Relaxa nome/campanha/veiculo
-- (antes NOT NULL) para permitir salvar um rascunho bem no inicio do preenchimento.
ALTER TABLE creatives ALTER COLUMN nome DROP NOT NULL;
ALTER TABLE creatives ALTER COLUMN campanha DROP NOT NULL;
ALTER TABLE creatives ALTER COLUMN veiculo DROP NOT NULL;

ALTER TABLE creatives DROP CONSTRAINT IF EXISTS creatives_status_check;
ALTER TABLE creatives ADD CONSTRAINT creatives_status_check
  CHECK (status IN (
    'Não registrado', 'Em aprovação', 'Aprovado', 'Aguardando implementação',
    'Programado', 'Ativo', 'Pausado', 'Com erro', 'Finalizado', 'Rascunho'
  ));

CREATE TABLE IF NOT EXISTS creative_status_history (
  id SERIAL PRIMARY KEY,
  creative_id INTEGER NOT NULL REFERENCES creatives(id) ON DELETE CASCADE,
  status_anterior TEXT,
  status_novo TEXT NOT NULL,
  alterado_por INTEGER NOT NULL REFERENCES users(id),
  alterado_em TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creatives_veiculo ON creatives(veiculo);
CREATE INDEX IF NOT EXISTS idx_creatives_ad_name ON creatives(ad_name);
CREATE INDEX IF NOT EXISTS idx_creatives_periodo_inicio ON creatives(periodo_inicio);
CREATE INDEX IF NOT EXISTS idx_status_history_creative ON creative_status_history(creative_id);

-- tipo: redes_sociais = aparece no menu Analise por Criativo (Meta, TikTok, YouTube, Kwai...)
--       online_outros = Display, Programatica, portais — nao aparece no menu criativos
--       offline = TV, Radio, OOH — aparece em Midia Offline
CREATE TABLE IF NOT EXISTS vehicles (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  plataformas TEXT[] NOT NULL DEFAULT '{}',
  tipo TEXT NOT NULL DEFAULT 'redes_sociais',
  criado_em TIMESTAMP NOT NULL DEFAULT now()
);

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS plataformas TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'online';
-- Atualiza o check para incluir 'redes_sociais' como categoria especifica de veiculos
-- que aparecem no menu "Analise por Criativo" (Meta, TikTok, YouTube, Kwai, etc.)
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_tipo_check;

CREATE TABLE IF NOT EXISTS programacoes (
  id SERIAL PRIMARY KEY,
  veiculo TEXT NOT NULL,
  categoria TEXT,
  programa TEXT NOT NULL,
  data DATE NOT NULL,
  hora_inicio TEXT NOT NULL,
  hora_fim TEXT NOT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_programacoes_data ON programacoes(data);

-- Parceiros: empresas que operam canais de midia em nome do Senado.
-- tipo define se o parceiro atende midia online, offline ou ambas.
CREATE TABLE IF NOT EXISTS parceiros (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL CHECK (tipo IN ('online', 'offline', 'ambos')),
  criado_em TIMESTAMP NOT NULL DEFAULT now()
);

-- Escopos: define quais campanhas e canais cada parceiro atendeu.
-- Um parceiro pode ter N escopos (um por campanha que participou).
-- canais: nomes que batem com o campo "veiculo" na planilha realizado
--   (ex: ["Meta", "TikTok", "Kwai", "YouTube"] para parceiro online;
--        ["Globo", "SBT", "Record"] para parceiro offline).
CREATE TABLE IF NOT EXISTS parceiro_escopos (
  id SERIAL PRIMARY KEY,
  parceiro_id INTEGER NOT NULL REFERENCES parceiros(id) ON DELETE CASCADE,
  campanha TEXT NOT NULL,
  canais TEXT[] NOT NULL DEFAULT '{}',
  criado_em TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (parceiro_id, campanha)
);

CREATE INDEX IF NOT EXISTS idx_escopos_parceiro ON parceiro_escopos(parceiro_id);

-- Plataformas de mídia cadastradas pela agência.
-- subcanais: nomes que esta plataforma engloba na planilha de realizado
-- (ex: Meta Ads -> ["Facebook", "Instagram"]; R7 Portal -> ["Portal R7"]).
CREATE TABLE IF NOT EXISTS plataformas (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL DEFAULT 'online' CHECK (tipo IN ('online', 'offline', 'ambos')),
  subcanais TEXT[] NOT NULL DEFAULT '{}',
  logo_url TEXT,
  criado_em TIMESTAMP NOT NULL DEFAULT now()
);
ALTER TABLE plataformas ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Campanhas cadastradas pela agencia.
CREATE TABLE IF NOT EXISTS campanhas (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  criado_em TIMESTAMP NOT NULL DEFAULT now()
);

-- Status da campanha, usado para filtrar a lista em Analise por Criativo.
-- Controlado manualmente pela agencia, EXCETO que se data_fim ja passou o status
-- efetivo (calculado em campanhasService, nao gravado aqui) sempre vira 'finalizado',
-- independente do que estiver salvo -- data vencida tem prioridade sobre status manual.
ALTER TABLE campanhas ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ativo';
ALTER TABLE campanhas DROP CONSTRAINT IF EXISTS campanhas_status_check;
ALTER TABLE campanhas ADD CONSTRAINT campanhas_status_check CHECK (status IN ('ativo', 'pausado', 'em_analise', 'finalizado', 'agendado', 'cancelado', 'aprovado', 'programado'));
-- Migra valor legado 'encerrado' (usado antes de existir a lista de 4 opcoes) para 'finalizado'.
UPDATE campanhas SET status = 'finalizado' WHERE status = 'encerrado';

-- Property ID do GA4 vinculado a esta campanha (cada LP/campanha pode ter sua propria
-- conta/property do Google Analytics 4). Opcional -- sem vinculo, o card de Sessoes no
-- Dashboard mostra "Sem dados" em vez de tentar consultar um GA4 padrao/inexistente.
ALTER TABLE campanhas ADD COLUMN IF NOT EXISTS ga4_property_id TEXT;

-- Periodo de veiculacao da campanha, usado so para exibicao e para a finalizacao
-- automatica por data (data_fim vencida = status efetivo 'finalizado').
ALTER TABLE campanhas ADD COLUMN IF NOT EXISTS data_inicio DATE;
ALTER TABLE campanhas ADD COLUMN IF NOT EXISTS data_fim DATE;

-- Vinculo campanha -> planilha Google Sheets propria (cada campanha pode ter uma
-- planilha diferente, com layout de colunas diferente -- diferente do modelo
-- antigo de uma unica planilha global com SHEET_ID/SHEET_RANGE_REALIZADO fixos no
-- .env). column_mapping fica em colunas explicitas (nao JSONB) para ficar
-- consistente com o resto do schema, que so usa TEXT/TEXT[]. So data/plataforma/
-- investimento/impressoes/cliques sao obrigatorios -- o restante e opcional
-- porque nem toda planilha tem, por exemplo, dados de video.
CREATE TABLE IF NOT EXISTS campanha_sheets (
  id SERIAL PRIMARY KEY,
  campanha_id INTEGER NOT NULL UNIQUE REFERENCES campanhas(id) ON DELETE CASCADE,
  spreadsheet_id TEXT NOT NULL,
  sheet_range TEXT NOT NULL,
  col_data TEXT NOT NULL,
  col_campanha TEXT,
  col_plataforma TEXT NOT NULL,
  col_vendedor TEXT,
  col_ad_name TEXT,
  col_nome_criativo TEXT,
  col_imagem_criativo TEXT,
  col_tipo_compra TEXT,
  col_posicionamento TEXT,
  col_investimento TEXT NOT NULL,
  col_impressoes TEXT NOT NULL,
  col_cliques TEXT NOT NULL,
  col_video_views TEXT,
  col_video_views_25 TEXT,
  col_video_views_50 TEXT,
  col_video_views_75 TEXT,
  col_video_completions TEXT,
  col_engajamentos TEXT,
  criado_em TIMESTAMP NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMP NOT NULL DEFAULT now()
);

-- Vinculo campanha -> veiculo -> plataformas que aquele veiculo trabalha nesta campanha.
-- tipo_midia: o escopo de midia do veiculo NESTA campanha especifica, que pode ser mais
-- restrito que o tipo geral do veiculo (ex: Go On e "ambos" no cadastro geral, mas so
-- trabalha "online" na Campanha Institucional -- nao deve ver nada de offline ali).
CREATE TABLE IF NOT EXISTS campanha_veiculos (
  id SERIAL PRIMARY KEY,
  campanha_id INTEGER NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  plataformas TEXT[] NOT NULL DEFAULT '{}',
  tipo_midia TEXT NOT NULL DEFAULT 'online' CHECK (tipo_midia IN ('online', 'offline', 'ambos')),
  UNIQUE (campanha_id, vehicle_id)
);

ALTER TABLE campanha_veiculos ADD COLUMN IF NOT EXISTS tipo_midia TEXT NOT NULL DEFAULT 'online';

-- Permissoes granulares por vinculo: controlam se este veiculo, NESTA campanha,
-- pode acessar as paginas de Analise por Criativo e/ou Matriz de Conteudo.
-- Independentes de tipo_midia (que so controla visao online/offline).
ALTER TABLE campanha_veiculos ADD COLUMN IF NOT EXISTS acesso_analise_criativo BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE campanha_veiculos ADD COLUMN IF NOT EXISTS acesso_matriz BOOLEAN NOT NULL DEFAULT true;
-- Quais das "plataformas" deste vinculo aparecem em Analise por Criativo NESTA
-- campanha (ex: Go On pode trabalhar Google Search + Meta Ads + Programatica, mas
-- so Google Search e Meta Ads aparecem como abas de criativo -- Programatica fica
-- de fora). Subconjunto de "plataformas"; vazio = nenhuma aparece.
ALTER TABLE campanha_veiculos ADD COLUMN IF NOT EXISTS plataformas_analise_criativo TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_campanha_veiculos_campanha ON campanha_veiculos(campanha_id);
CREATE INDEX IF NOT EXISTS idx_campanha_veiculos_vehicle ON campanha_veiculos(vehicle_id);

-- Meta contratada (quantidade + modelo de compra) por plataforma dentro de um
-- vinculo campanha+veiculo. Substitui a antiga fonte "planilha de planejamento"
-- para o calculo de Contratado/Pacing na tela Lista de Veiculos -- o Entregue
-- continua vindo da planilha de Realizado (Google Sheets), so a META migra pra ca.
-- data_inicio/data_fim nulos = herda o periodo da campanha (campanhas.data_inicio/data_fim).
-- Uma linha por combinacao plataforma+modelo de compra dentro de um vinculo: permite
-- que a mesma plataforma (ex: Meta Ads) tenha varias metas simultaneas com modelos
-- diferentes (ex: 50.000 CPM + 5.000 CPC), cada uma com sua propria quantidade
-- contratada e periodo. A chave unica evita duas metas com o MESMO modelo para a
-- mesma plataforma no mesmo vinculo (isso sim nao faz sentido -- vira upsert).
CREATE TABLE IF NOT EXISTS campanha_veiculo_metas (
  id SERIAL PRIMARY KEY,
  campanha_veiculo_id INTEGER NOT NULL REFERENCES campanha_veiculos(id) ON DELETE CASCADE,
  plataforma TEXT NOT NULL,
  quantidade_contratada NUMERIC NOT NULL DEFAULT 0,
  modelo_compra TEXT NOT NULL DEFAULT 'CPM',
  data_inicio DATE,
  data_fim DATE,
  criado_em TIMESTAMP NOT NULL DEFAULT now()
);
-- Migra instalacoes existentes: troca a UNIQUE antiga (campanha_veiculo_id, plataforma)
-- pela nova (campanha_veiculo_id, plataforma, modelo_compra), sem apagar dados.
ALTER TABLE campanha_veiculo_metas DROP CONSTRAINT IF EXISTS campanha_veiculo_metas_campanha_veiculo_id_plataforma_key;
ALTER TABLE campanha_veiculo_metas DROP CONSTRAINT IF EXISTS campanha_veiculo_metas_vinculo_plataforma_modelo_key;
ALTER TABLE campanha_veiculo_metas ADD CONSTRAINT campanha_veiculo_metas_vinculo_plataforma_modelo_key
  UNIQUE (campanha_veiculo_id, plataforma, modelo_compra);
CREATE INDEX IF NOT EXISTS idx_campanha_veiculo_metas_vinculo ON campanha_veiculo_metas(campanha_veiculo_id);

-- Rastreia a qual vinculo (campanha+veiculo) especifico este criativo pertence.
-- Nullable para nao quebrar criativos legados (campanha/veiculo continuam gravados
-- como texto solto abaixo, usados como fallback quando este campo e nulo).
ALTER TABLE creatives ADD COLUMN IF NOT EXISTS campanha_veiculo_id INTEGER REFERENCES campanha_veiculos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_creatives_campanha_veiculo ON creatives(campanha_veiculo_id);

-- Compatibilidade: mantém a tabela antiga mas agora é derivada das campanhas acima
CREATE TABLE IF NOT EXISTS campanhas_plataformas (
  id SERIAL PRIMARY KEY,
  campanha TEXT NOT NULL UNIQUE,
  plataformas TEXT[] NOT NULL DEFAULT '{}',
  criado_em TIMESTAMP NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMP NOT NULL DEFAULT now()
);

-- Tokens de recuperacao de senha. Cada solicitacao gera um token novo;
-- os anteriores do mesmo usuario sao invalidados ao gerar um novo (ver authService).
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expira_em TIMESTAMP NOT NULL,
  usado BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token);

-- Vincula um usuario do papel 'parceiro' ao seu Parceiro cadastrado.
ALTER TABLE users ADD COLUMN IF NOT EXISTS parceiro_id INTEGER REFERENCES parceiros(id);
-- Expande os papeis aceitos para incluir 'parceiro'.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_papel_check;
ALTER TABLE users ADD CONSTRAINT users_papel_check
  CHECK (papel IN ('agencia', 'veiculo', 'cliente', 'parceiro'));

-- Sincronizacao automatica de status: mudancas feitas pelo job de sincronizacao
-- (ver statusSyncService.js) nao tem um usuario humano como autor.
ALTER TABLE creative_status_history ALTER COLUMN alterado_por DROP NOT NULL;
ALTER TABLE creative_status_history ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE creative_status_history DROP CONSTRAINT IF EXISTS creative_status_history_origem_check;
ALTER TABLE creative_status_history ADD CONSTRAINT creative_status_history_origem_check
  CHECK (origem IN ('manual', 'automatico'));

-- Data/hora da ultima vez que o criativo foi avaliado pelo job de sincronizacao de
-- status (manual ou cron), independente de ter havido mudanca de status ou nao.
ALTER TABLE creatives ADD COLUMN IF NOT EXISTS ultima_sincronizacao_em TIMESTAMP;

-- Log de execucoes do job de sincronizacao de status (cron ou manual via botao),
-- para auditoria/debug -- cada execucao grava quantos criativos avaliou/alterou e
-- eventual erro.
CREATE TABLE IF NOT EXISTS status_sync_runs (
  id SERIAL PRIMARY KEY,
  iniciado_em TIMESTAMP NOT NULL DEFAULT now(),
  finalizado_em TIMESTAMP,
  origem TEXT NOT NULL DEFAULT 'cron' CHECK (origem IN ('cron', 'manual')),
  disparado_por INTEGER REFERENCES users(id),
  campanha_id INTEGER REFERENCES campanhas(id),
  criativos_avaliados INTEGER NOT NULL DEFAULT 0,
  criativos_alterados INTEGER NOT NULL DEFAULT 0,
  erro TEXT
);
CREATE INDEX IF NOT EXISTS idx_status_sync_runs_campanha ON status_sync_runs(campanha_id);

-- campanha_id nao tinha ON DELETE definido (default NO ACTION), o que bloqueava a
-- exclusao de qualquer campanha que ja tivesse rodado o job de sincronizacao de
-- status pelo menos uma vez -- SET NULL preserva o log de auditoria e libera a
-- exclusao, so perdendo o vinculo com a campanha que nao existe mais.
ALTER TABLE status_sync_runs DROP CONSTRAINT IF EXISTS status_sync_runs_campanha_id_fkey;
ALTER TABLE status_sync_runs ADD CONSTRAINT status_sync_runs_campanha_id_fkey
  FOREIGN KEY (campanha_id) REFERENCES campanhas(id) ON DELETE SET NULL;

-- Log de auditoria generico (criativos e campanhas por enquanto, extensivel a
-- outros cadastros depois via entidade_tipo): toda criacao/edicao/status/exclusao
-- fica registrada aqui, com quem fez e quando. SEM FK para creatives/campanhas em
-- entidade_id -- se tivesse, um DELETE em cascata apagaria o proprio registro da
-- exclusao junto com a linha, o que anularia o proposito de auditar exclusoes.
-- entidade_nome guarda uma copia do nome no momento da acao, para o log continuar
-- legivel mesmo depois do item original ter sido excluido. campanha_id usa
-- ON DELETE SET NULL (nao CASCADE): se fosse CASCADE, excluir a PROPRIA campanha
-- apagaria o log dessa exclusao junto -- SET NULL preserva a linha (fica sem
-- campanha associada, visivel numa eventual tela de log global futura).
CREATE TABLE IF NOT EXISTS action_log (
  id SERIAL PRIMARY KEY,
  entidade_tipo TEXT NOT NULL CHECK (entidade_tipo IN ('criativo', 'campanha')),
  entidade_id INTEGER,
  entidade_nome TEXT NOT NULL,
  campanha_id INTEGER REFERENCES campanhas(id) ON DELETE SET NULL,
  acao TEXT NOT NULL CHECK (acao IN ('criacao', 'edicao', 'status', 'exclusao')),
  campo TEXT,
  valor_anterior TEXT,
  valor_novo TEXT,
  alterado_por INTEGER REFERENCES users(id),
  origem TEXT NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'automatico')),
  criado_em TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_action_log_campanha ON action_log(campanha_id);

-- Comentarios num criativo, com suporte a @mencao de usuarios. Diferente do
-- action_log, aqui CASCADE em creative_id e o comportamento certo: comentario
-- so faz sentido enquanto o criativo existe.
CREATE TABLE IF NOT EXISTS creative_comments (
  id SERIAL PRIMARY KEY,
  creative_id INTEGER NOT NULL REFERENCES creatives(id) ON DELETE CASCADE,
  autor_id INTEGER NOT NULL REFERENCES users(id),
  texto TEXT NOT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_creative_comments_creative ON creative_comments(creative_id);
ALTER TABLE creative_comments ADD COLUMN IF NOT EXISTS editado_em TIMESTAMP;
-- Resposta encadeada: aponta pro comentario "pai". NULL = comentario de topo.
-- So um nivel de profundidade (resposta a resposta ainda aponta pro mesmo pai
-- raiz do lado do frontend) -- suficiente pro caso de uso, evita arvore recursiva.
ALTER TABLE creative_comments ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES creative_comments(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_creative_comments_parent ON creative_comments(parent_id);

-- Reacoes com emoji num comentario. Um usuario pode reagir com varios emojis
-- diferentes ao mesmo comentario, mas nao repetir o mesmo emoji (UNIQUE).
CREATE TABLE IF NOT EXISTS comment_reactions (
  id SERIAL PRIMARY KEY,
  comment_id INTEGER NOT NULL REFERENCES creative_comments(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES users(id),
  emoji TEXT NOT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (comment_id, usuario_id, emoji)
);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment ON comment_reactions(comment_id);

-- Uma linha por usuario mencionado num comentario (permite N mencoes por
-- comentario). "lido" controla o badge do sino -- nao apaga a notificacao ao
-- ler, so marca, para o usuario poder reabrir o historico depois.
CREATE TABLE IF NOT EXISTS comment_mentions (
  id SERIAL PRIMARY KEY,
  comment_id INTEGER NOT NULL REFERENCES creative_comments(id) ON DELETE CASCADE,
  usuario_mencionado_id INTEGER NOT NULL REFERENCES users(id),
  lido BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comment_mentions_usuario ON comment_mentions(usuario_mencionado_id, lido);
-- Distingue @mencao literal (usuario foi citado com @Nome no texto) de
-- notificacao automatica por atividade (agencia/veiculo notificados de
-- qualquer comentario no que tem acesso, mesmo sem serem citados) -- usado so
-- para o texto exibido no sino ("mencionou voce" vs "novo comentario").
ALTER TABLE comment_mentions ADD COLUMN IF NOT EXISTS eh_mencao_direta BOOLEAN NOT NULL DEFAULT false;

-- Lixeira: usuarios 'agencia' com is_admin=true podem ver/restaurar/excluir
-- definitivamente itens da lixeira. Nao e um papel novo -- continua 'agencia'
-- para tudo mais no sistema, so ganha essa permissao extra.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Soft-delete de criativos e campanhas: excluido_em NULL = item ativo/visivel
-- normalmente; preenchido = esta na lixeira, some das listagens normais mas
-- continua no banco ate um admin restaurar ou excluir definitivamente (sem
-- expiracao automatica). excluido_por registra quem mandou pra lixeira.
ALTER TABLE creatives ADD COLUMN IF NOT EXISTS excluido_em TIMESTAMP;
ALTER TABLE creatives ADD COLUMN IF NOT EXISTS excluido_por INTEGER REFERENCES users(id);
ALTER TABLE campanhas ADD COLUMN IF NOT EXISTS excluido_em TIMESTAMP;
ALTER TABLE campanhas ADD COLUMN IF NOT EXISTS excluido_por INTEGER REFERENCES users(id);

-- A UNIQUE simples em campanhas.nome colidiria com soft-delete: uma campanha
-- na lixeira ainda ocuparia o nome, impedindo criar uma nova com o mesmo nome.
-- Troca por indice unico parcial, que so considera campanhas ativas.
ALTER TABLE campanhas DROP CONSTRAINT IF EXISTS campanhas_nome_key;
CREATE UNIQUE INDEX IF NOT EXISTS campanhas_nome_ativo_unique ON campanhas (nome) WHERE excluido_em IS NULL;

-- Permite registrar a acao de exclusao definitiva separada da exclusao (soft-delete)
-- ja existente -- a de soft-delete continua logada como 'exclusao' no momento em
-- que o item vai pra lixeira, preservando o rastro original.
ALTER TABLE action_log DROP CONSTRAINT IF EXISTS action_log_acao_check;
ALTER TABLE action_log ADD CONSTRAINT action_log_acao_check
  CHECK (acao IN (
    'criacao', 'edicao', 'status', 'exclusao', 'exclusao_definitiva', 'restauracao',
    'promocao_admin', 'revogacao_admin'
  ));

-- Historico de gestao de usuarios (criacao/exclusao de contas), admin-only,
-- reaproveitando a mesma tabela de auditoria. Usuario nao pertence a campanha
-- nenhuma -- campanha_id fica NULL nesses registros (ver guarda em registrarAcao).
-- A definicao original da coluna (mais acima neste arquivo) ja nao tem NOT NULL,
-- mas isso so vale pra bancos criados do zero -- um banco existente que rodou o
-- CREATE TABLE antes dessa mudanca manteve a constraint antiga (CREATE TABLE IF
-- NOT EXISTS nao reaplica a definicao numa tabela que ja existe), entao precisa
-- deste ALTER explicito pra relaxar de fato.
ALTER TABLE action_log ALTER COLUMN campanha_id DROP NOT NULL;

ALTER TABLE action_log DROP CONSTRAINT IF EXISTS action_log_entidade_tipo_check;
ALTER TABLE action_log ADD CONSTRAINT action_log_entidade_tipo_check
  CHECK (entidade_tipo IN ('criativo', 'campanha', 'usuario'));
