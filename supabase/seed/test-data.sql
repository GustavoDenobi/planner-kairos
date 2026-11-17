-- Carga de dados de TESTE para o ambiente local (Orquestra Kairós, do seed.sql).
--
-- Não rode à mão: use `npm run seed:test`, que gera os PDFs e áudios, envia ao storage local
-- e substitui os marcadores {{...}} abaixo. Pode ser rodado de novo: não duplica nada e
-- reposiciona datas de eventos e prazos em relação a hoje.
--
-- Contas (senha de todas: kairos-teste):
--   maestro@kairos.local     regente da Orquestra
--   professora@kairos.local  professora do Coral e da Big Band
--   ana@kairos.local         violino, Orquestra (Cordas)
--   bruno@kairos.local       trombone, Orquestra (Metais)
--   carla@kairos.local       violino, Orquestra (Cordas) + Coral (Sopranos)
--   diego@kairos.local       sax alto, Big Band
--   elisa@kairos.local       soprano, Coral
-- Músicos sem conta: Fábio Teste (Orquestra) e Gabriela Teste (Coral).
--
-- Todos os IDs começam com 5eed (fácil de achar e de apagar: ver o fim do arquivo).

BEGIN;

-- Os gatilhos de limite do plano exigem auth.uid(): age como o admin do seed.sql.
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

CREATE TEMP TABLE seed_users (id UUID, email TEXT, display_name TEXT) ON COMMIT DROP;
INSERT INTO seed_users VALUES
  ('5eed0001-0000-4000-8000-000000000001', 'maestro@kairos.local', 'Maestro Teste'),
  ('5eed0001-0000-4000-8000-000000000002', 'professora@kairos.local', 'Professora Teste'),
  ('5eed0001-0000-4000-8000-000000000011', 'ana@kairos.local', 'Ana Teste'),
  ('5eed0001-0000-4000-8000-000000000012', 'bruno@kairos.local', 'Bruno Teste'),
  ('5eed0001-0000-4000-8000-000000000013', 'carla@kairos.local', 'Carla Teste'),
  ('5eed0001-0000-4000-8000-000000000014', 'diego@kairos.local', 'Diego Teste'),
  ('5eed0001-0000-4000-8000-000000000015', 'elisa@kairos.local', 'Elisa Teste');

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
SELECT
  u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email,
  crypt('kairos-teste', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}',
  jsonb_build_object('display_name', u.display_name),
  now(), now(), '', '', '', ''
FROM seed_users u
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
SELECT u.id, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', u.id::text, now(), now(), now()
FROM seed_users u
ON CONFLICT (provider, provider_id) DO NOTHING;

INSERT INTO profiles (id, display_name, email, theme)
SELECT u.id, u.display_name, u.email, 'light' FROM seed_users u
ON CONFLICT (id) DO NOTHING;

INSERT INTO memberships (organization_id, user_id, access_role)
SELECT 'a0000000-0000-4000-8000-000000000001', u.id, 'member' FROM seed_users u
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Músicos (os dois últimos sem conta).
INSERT INTO musicians (id, organization_id, full_name, user_id, email, birth_date)
VALUES
  ('5eed0002-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Maestro Teste', '5eed0001-0000-4000-8000-000000000001', 'maestro@kairos.local', '1975-03-14'),
  ('5eed0002-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Professora Teste', '5eed0001-0000-4000-8000-000000000002', 'professora@kairos.local', '1982-07-02'),
  ('5eed0002-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000001', 'Ana Teste', '5eed0001-0000-4000-8000-000000000011', 'ana@kairos.local', '2006-11-20'),
  ('5eed0002-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000001', 'Bruno Teste', '5eed0001-0000-4000-8000-000000000012', 'bruno@kairos.local', '2004-01-09'),
  ('5eed0002-0000-4000-8000-000000000013', 'a0000000-0000-4000-8000-000000000001', 'Carla Teste', '5eed0001-0000-4000-8000-000000000013', 'carla@kairos.local', '2008-05-30'),
  ('5eed0002-0000-4000-8000-000000000014', 'a0000000-0000-4000-8000-000000000001', 'Diego Teste', '5eed0001-0000-4000-8000-000000000014', 'diego@kairos.local', '2003-09-17'),
  ('5eed0002-0000-4000-8000-000000000015', 'a0000000-0000-4000-8000-000000000001', 'Elisa Teste', '5eed0001-0000-4000-8000-000000000015', 'elisa@kairos.local', '2007-12-03'),
  ('5eed0002-0000-4000-8000-000000000021', 'a0000000-0000-4000-8000-000000000001', 'Fábio Teste', NULL, NULL, '2005-04-25'),
  ('5eed0002-0000-4000-8000-000000000022', 'a0000000-0000-4000-8000-000000000001', 'Gabriela Teste', NULL, NULL, '2009-08-11')
ON CONFLICT (id) DO NOTHING;

-- Funções nos grupos (regente/professora administram; os demais são alunos).
INSERT INTO assignments (id, organization_id, musician_id, group_id, section_id, part_id, ensemble_role)
SELECT v.id::uuid, 'a0000000-0000-4000-8000-000000000001', v.musician_id::uuid, v.group_id::uuid,
       s.id, v.part_id::uuid, v.role::ensemble_role
FROM (VALUES
  ('5eed0009-0000-4000-8000-000000000001', '5eed0002-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', NULL, NULL, 'conductor'),
  ('5eed0009-0000-4000-8000-000000000002', '5eed0002-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000003', NULL, NULL, 'teacher'),
  ('5eed0009-0000-4000-8000-000000000003', '5eed0002-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', NULL, NULL, 'teacher'),
  ('5eed0009-0000-4000-8000-000000000011', '5eed0002-0000-4000-8000-000000000011', 'c0000000-0000-4000-8000-000000000001', 'Cordas', 'd0000000-0000-4000-8000-000000000002', 'member'),
  ('5eed0009-0000-4000-8000-000000000012', '5eed0002-0000-4000-8000-000000000012', 'c0000000-0000-4000-8000-000000000001', 'Metais', 'd0000000-0000-4000-8000-000000000003', 'member'),
  ('5eed0009-0000-4000-8000-000000000013', '5eed0002-0000-4000-8000-000000000013', 'c0000000-0000-4000-8000-000000000001', 'Cordas', 'd0000000-0000-4000-8000-000000000002', 'member'),
  ('5eed0009-0000-4000-8000-000000000014', '5eed0002-0000-4000-8000-000000000013', 'c0000000-0000-4000-8000-000000000003', 'Sopranos', 'd0000000-0000-4000-8000-000000000004', 'member'),
  ('5eed0009-0000-4000-8000-000000000015', '5eed0002-0000-4000-8000-000000000014', 'c0000000-0000-4000-8000-000000000002', 'Saxofones', 'd0000000-0000-4000-8000-000000000001', 'member'),
  ('5eed0009-0000-4000-8000-000000000016', '5eed0002-0000-4000-8000-000000000015', 'c0000000-0000-4000-8000-000000000003', 'Sopranos', 'd0000000-0000-4000-8000-000000000004', 'member'),
  ('5eed0009-0000-4000-8000-000000000017', '5eed0002-0000-4000-8000-000000000021', 'c0000000-0000-4000-8000-000000000001', 'Metais', 'd0000000-0000-4000-8000-000000000003', 'member'),
  ('5eed0009-0000-4000-8000-000000000018', '5eed0002-0000-4000-8000-000000000022', 'c0000000-0000-4000-8000-000000000003', 'Sopranos', 'd0000000-0000-4000-8000-000000000004', 'member')
) AS v(id, musician_id, group_id, section_name, part_id, role)
LEFT JOIN sections s ON s.group_id = v.group_id::uuid AND s.name = v.section_name
ON CONFLICT (id) DO NOTHING;

-- Peças e arquivos (os PDFs já foram enviados ao storage pelo script).
INSERT INTO pieces (id, organization_id, title, category_id, composer, description, file_access_scope)
VALUES
  ('5eed0003-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Sinfonia de Testes',
   (SELECT id FROM piece_categories WHERE organization_id = 'a0000000-0000-4000-8000-000000000001' ORDER BY sort_order LIMIT 1),
   'Compositor Fictício', 'Peça gerada para testes (12 páginas, 4 movimentos).', 'all_files'),
  ('5eed0003-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Hino de Testes',
   (SELECT id FROM piece_categories WHERE organization_id = 'a0000000-0000-4000-8000-000000000001' ORDER BY sort_order LIMIT 1),
   'Autor Fictício', 'Peça coral gerada para testes.', 'all_files'),
  ('5eed0003-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'Swing de Testes',
   (SELECT id FROM piece_categories WHERE organization_id = 'a0000000-0000-4000-8000-000000000001' ORDER BY sort_order LIMIT 1),
   'Arranjador Fictício', 'Peça sem arquivo (tarefa vinculada só à peça).', 'all_files')
ON CONFLICT (id) DO NOTHING;

INSERT INTO piece_groups (organization_id, piece_id, group_id)
VALUES
  ('a0000000-0000-4000-8000-000000000001', '5eed0003-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000001', '5eed0003-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000003'),
  ('a0000000-0000-4000-8000-000000000001', '5eed0003-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002')
ON CONFLICT DO NOTHING;

INSERT INTO piece_files (id, organization_id, piece_id, kind, storage_key, mime_type, original_name, byte_size, title)
VALUES
  ('5eed0004-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '5eed0003-0000-4000-8000-000000000001',
   'score', '{{SINFONIA_KEY}}', 'application/pdf', 'Sinfonia_de_Testes.pdf', {{SINFONIA_SIZE}}, 'Sinfonia de Testes — Grade'),
  ('5eed0004-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', '5eed0003-0000-4000-8000-000000000002',
   'score', '{{HINO_KEY}}', 'application/pdf', 'Hino_de_Testes.pdf', {{HINO_SIZE}}, 'Hino de Testes — Coro')
ON CONFLICT (id) DO UPDATE SET byte_size = EXCLUDED.byte_size, storage_key = EXCLUDED.storage_key;

INSERT INTO piece_file_toc_entries (id, organization_id, piece_file_id, label, sort_order, target_page_number, end_page_number)
VALUES
  ('5eed0005-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '5eed0004-0000-4000-8000-000000000001', 'I. Allegro', 1, 1, 4),
  ('5eed0005-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', '5eed0004-0000-4000-8000-000000000001', 'II. Andante', 2, 5, 8),
  ('5eed0005-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', '5eed0004-0000-4000-8000-000000000001', 'III. Minueto', 3, 9, 10),
  ('5eed0005-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', '5eed0004-0000-4000-8000-000000000001', 'IV. Final', 4, 11, 12),
  ('5eed0005-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000001', '5eed0004-0000-4000-8000-000000000002', 'Estrofe 1', 1, 1, 2),
  ('5eed0005-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000001', '5eed0004-0000-4000-8000-000000000002', 'Refrão', 2, 3, 4)
ON CONFLICT (id) DO NOTHING;

-- Eventos: um passado e próximos ensaios (datas relativas a hoje, atualizadas a cada execução).
CREATE TEMP TABLE seed_events (id UUID, kind event_kind, title TEXT, day_offset INT, hour INT, group_id UUID) ON COMMIT DROP;
INSERT INTO seed_events VALUES
  ('5eed0006-0000-4000-8000-000000000001', 'rehearsal', 'Ensaio geral (passado)', -6, 19, 'c0000000-0000-4000-8000-000000000001'),
  ('5eed0006-0000-4000-8000-000000000002', 'rehearsal', 'Ensaio da Orquestra', 2, 19, 'c0000000-0000-4000-8000-000000000001'),
  ('5eed0006-0000-4000-8000-000000000003', 'rehearsal', 'Ensaio da Orquestra', 9, 19, 'c0000000-0000-4000-8000-000000000001'),
  ('5eed0006-0000-4000-8000-000000000004', 'rehearsal', 'Ensaio do Coral', 3, 18, 'c0000000-0000-4000-8000-000000000003'),
  ('5eed0006-0000-4000-8000-000000000005', 'class', 'Aula da Big Band', 4, 20, 'c0000000-0000-4000-8000-000000000002'),
  ('5eed0006-0000-4000-8000-000000000006', 'service', 'Apresentação', 14, 10, 'c0000000-0000-4000-8000-000000000001');

INSERT INTO events (id, organization_id, type_id, title, starts_at, ends_at, location, created_by)
SELECT e.id, 'a0000000-0000-4000-8000-000000000001',
  (SELECT t.id FROM event_types t WHERE t.organization_id = 'a0000000-0000-4000-8000-000000000001' AND t.kind = e.kind ORDER BY t.sort_order LIMIT 1),
  e.title,
  (date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') + make_interval(days => e.day_offset, hours => e.hour)) AT TIME ZONE 'America/Sao_Paulo',
  (date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') + make_interval(days => e.day_offset, hours => e.hour + 2)) AT TIME ZONE 'America/Sao_Paulo',
  'Sala de ensaio', NULL
FROM seed_events e
ON CONFLICT (id) DO UPDATE SET starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at;

INSERT INTO event_groups (organization_id, event_id, group_id)
SELECT 'a0000000-0000-4000-8000-000000000001', e.id, e.group_id FROM seed_events e
ON CONFLICT DO NOTHING;

INSERT INTO program_items (id, organization_id, event_id, piece_id, sort_order)
VALUES
  ('5eed000a-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '5eed0006-0000-4000-8000-000000000002', '5eed0003-0000-4000-8000-000000000001', 1),
  ('5eed000a-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', '5eed0006-0000-4000-8000-000000000004', '5eed0003-0000-4000-8000-000000000002', 1)
ON CONFLICT (id) DO NOTHING;

-- Tarefas: cobrem todos os estados (pendente, atrasada, perdida, enviada, avaliada, refazer, encerrada).
CREATE TEMP TABLE seed_tasks (
  id UUID, created_by UUID, title TEXT, instructions TEXT,
  piece_id UUID, piece_file_id UUID, toc_entry_id UUID, target_page INT, target_x REAL, target_y REAL,
  due_days INT, accept_late BOOLEAN, closed BOOLEAN, linked_event_id UUID
) ON COMMIT DROP;
INSERT INTO seed_tasks VALUES
  ('5eed0007-0000-4000-8000-000000000001', '5eed0001-0000-4000-8000-000000000001', 'Allegro: exposição completa',
   'Grave o Allegro do início até o fim da exposição. Atenção às arcadas do c. 5 ao 12.',
   '5eed0003-0000-4000-8000-000000000001', '5eed0004-0000-4000-8000-000000000001', '5eed0005-0000-4000-8000-000000000001', 1, NULL, NULL,
   5, TRUE, FALSE, '5eed0006-0000-4000-8000-000000000003'),
  ('5eed0007-0000-4000-8000-000000000002', '5eed0001-0000-4000-8000-000000000001', 'Andante: dinâmicas',
   'Trabalhe o crescendo da segunda linha. Toque devagar primeiro.',
   '5eed0003-0000-4000-8000-000000000001', '5eed0004-0000-4000-8000-000000000001', NULL, 6, 0.3, 0.45,
   12, TRUE, FALSE, NULL),
  ('5eed0007-0000-4000-8000-000000000003', '5eed0001-0000-4000-8000-000000000001', 'Final: passagem dos metais',
   'Só a entrada dos metais na página 11.',
   '5eed0003-0000-4000-8000-000000000001', '5eed0004-0000-4000-8000-000000000001', '5eed0005-0000-4000-8000-000000000004', 11, NULL, NULL,
   3, TRUE, FALSE, NULL),
  ('5eed0007-0000-4000-8000-000000000004', '5eed0001-0000-4000-8000-000000000002', 'Swing: improviso de 8 compassos',
   'Improvise 8 compassos sobre a base. Não aceito envios atrasados.',
   '5eed0003-0000-4000-8000-000000000003', NULL, NULL, NULL, NULL, NULL,
   -2, FALSE, FALSE, NULL),
  ('5eed0007-0000-4000-8000-000000000005', '5eed0001-0000-4000-8000-000000000002', 'Hino: refrão afinado',
   'Cante o refrão a cappella. Use o afinador antes de começar.',
   '5eed0003-0000-4000-8000-000000000002', '5eed0004-0000-4000-8000-000000000002', NULL, 3, NULL, NULL,
   -1, TRUE, FALSE, NULL),
  ('5eed0007-0000-4000-8000-000000000006', '5eed0001-0000-4000-8000-000000000001', 'Escalas em Ré maior',
   'Duas oitavas, semínima = 80, ligado e destacado.',
   NULL, NULL, NULL, NULL, NULL, NULL,
   10, TRUE, FALSE, NULL),
  ('5eed0007-0000-4000-8000-000000000007', '5eed0001-0000-4000-8000-000000000001', 'Minueto (encerrada)',
   'Tarefa antiga, já encerrada.',
   '5eed0003-0000-4000-8000-000000000001', '5eed0004-0000-4000-8000-000000000001', '5eed0005-0000-4000-8000-000000000003', 9, NULL, NULL,
   -7, TRUE, TRUE, NULL);

-- Volume: várias tarefas no mesmo arquivo (testa agrupamento, filtros e busca no leitor).
INSERT INTO seed_tasks
SELECT
  ('5eed0007-0000-4000-8000-' || lpad((100 + n)::text, 12, '0'))::uuid,
  '5eed0001-0000-4000-8000-000000000001',
  format('Estudo %s: página %s', n, ((n - 1) % 12) + 1),
  'Tarefa gerada para volume.',
  '5eed0003-0000-4000-8000-000000000001', '5eed0004-0000-4000-8000-000000000001', NULL,
  ((n - 1) % 12) + 1, NULL, NULL,
  (n % 9) - 2, TRUE, FALSE, NULL
FROM generate_series(1, 10) AS n;

INSERT INTO practice_tasks (
  id, organization_id, created_by, title, instructions, piece_id, piece_file_id, toc_entry_id,
  target_page, target_x, target_y, due_at, accept_late_submissions, closed_at, linked_event_id
)
SELECT
  t.id, 'a0000000-0000-4000-8000-000000000001', t.created_by, t.title, t.instructions,
  t.piece_id, t.piece_file_id, t.toc_entry_id, t.target_page, t.target_x, t.target_y,
  -- 23:59 no horário de Brasília (como o formulário faz), não em UTC.
  (date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo')
    + make_interval(days => t.due_days) + interval '23 hours 59 minutes') AT TIME ZONE 'America/Sao_Paulo',
  t.accept_late,
  CASE WHEN t.closed THEN now() - interval '1 day' END,
  t.linked_event_id
FROM seed_tasks t
ON CONFLICT (id) DO UPDATE SET
  due_at = EXCLUDED.due_at,
  closed_at = EXCLUDED.closed_at;

INSERT INTO practice_task_groups (organization_id, task_id, group_id)
SELECT 'a0000000-0000-4000-8000-000000000001'::uuid, v.task_id::uuid, v.group_id::uuid
FROM (VALUES
  ('5eed0007-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001'),
  ('5eed0007-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001'),
  ('5eed0007-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000002'),
  ('5eed0007-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000003'),
  ('5eed0007-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000001')
) AS v(task_id, group_id)
UNION ALL
SELECT 'a0000000-0000-4000-8000-000000000001'::uuid, t.id, 'c0000000-0000-4000-8000-000000000001'::uuid
FROM seed_tasks t WHERE t.title LIKE 'Estudo %'
ON CONFLICT DO NOTHING;

INSERT INTO practice_task_musicians (organization_id, task_id, musician_id)
VALUES
  ('a0000000-0000-4000-8000-000000000001', '5eed0007-0000-4000-8000-000000000003', '5eed0002-0000-4000-8000-000000000012'),
  ('a0000000-0000-4000-8000-000000000001', '5eed0007-0000-4000-8000-000000000003', '5eed0002-0000-4000-8000-000000000021'),
  ('a0000000-0000-4000-8000-000000000001', '5eed0007-0000-4000-8000-000000000006', '5eed0002-0000-4000-8000-000000000011')
ON CONFLICT DO NOTHING;

-- Entregas (áudios WAV já enviados ao storage). Datas relativas ao prazo da tarefa.
INSERT INTO practice_submissions (
  id, organization_id, task_id, musician_id, submitted_by, attempt, storage_path, mime_type,
  duration_ms, byte_size, page_marks, student_note, status, submitted_at, reviewed_at, reviewed_by, feedback
)
SELECT
  s.id, 'a0000000-0000-4000-8000-000000000001', s.task_id, s.musician_id, m.user_id, s.attempt,
  'a0000000-0000-4000-8000-000000000001/practice/' || s.task_id || '/' || s.musician_id || '/' || s.id || '.wav',
  'audio/wav', {{AUDIO_DURATION_MS}}, {{AUDIO_SIZE}},
  s.page_marks::jsonb, s.note, s.status::practice_submission_status,
  t.due_at + s.submitted_offset,
  CASE WHEN s.status <> 'submitted' THEN t.due_at + s.submitted_offset + interval '1 day' END,
  CASE WHEN s.status <> 'submitted' THEN s.reviewer END,
  s.feedback
FROM (VALUES
  -- Ana enviou e aguarda avaliação.
  ('5eed0008-0000-4000-8000-000000000001'::uuid, '5eed0007-0000-4000-8000-000000000001'::uuid, '5eed0002-0000-4000-8000-000000000011'::uuid, 1,
   '[{"atSec":0,"pieceFileId":"5eed0004-0000-4000-8000-000000000001","page":1},{"atSec":4,"pieceFileId":"5eed0004-0000-4000-8000-000000000001","page":2}]',
   'Fiz mais devagar no c. 9.', 'submitted', interval '-2 days', NULL::uuid, NULL),
  -- Bruno: avaliado com comentário.
  ('5eed0008-0000-4000-8000-000000000002', '5eed0007-0000-4000-8000-000000000001', '5eed0002-0000-4000-8000-000000000012', 1,
   '[]', NULL, 'reviewed', interval '-3 days', '5eed0001-0000-4000-8000-000000000001', 'Muito bom! Cuidado com a afinação no c. 7.'),
  -- Carla: pediram para refazer (pode reenviar).
  ('5eed0008-0000-4000-8000-000000000003', '5eed0007-0000-4000-8000-000000000001', '5eed0002-0000-4000-8000-000000000013', 1,
   '[]', NULL, 'redo_requested', interval '-4 days', '5eed0001-0000-4000-8000-000000000001', 'Faltou a repetição. Grave de novo com ela.'),
  -- Carla: entrega atrasada no Coral.
  ('5eed0008-0000-4000-8000-000000000004', '5eed0007-0000-4000-8000-000000000005', '5eed0002-0000-4000-8000-000000000013', 1,
   '[]', 'Desculpe o atraso.', 'submitted', interval '6 hours', NULL, NULL),
  -- Ana: duas tentativas na tarefa encerrada (a segunda avaliada).
  ('5eed0008-0000-4000-8000-000000000005', '5eed0007-0000-4000-8000-000000000007', '5eed0002-0000-4000-8000-000000000011', 1,
   '[]', NULL, 'redo_requested', interval '-3 days', '5eed0001-0000-4000-8000-000000000001', 'Tempo instável, refaça com metrônomo.'),
  ('5eed0008-0000-4000-8000-000000000006', '5eed0007-0000-4000-8000-000000000007', '5eed0002-0000-4000-8000-000000000011', 2,
   '[]', 'Agora com metrônomo.', 'reviewed', interval '-1 day', '5eed0001-0000-4000-8000-000000000001', 'Ótimo, bem mais estável.'),
  -- Ana enviou uma das tarefas de volume (aparece "1 para ouvir" no leitor).
  ('5eed0008-0000-4000-8000-000000000007', '5eed0007-0000-4000-8000-000000000103', '5eed0002-0000-4000-8000-000000000011', 1,
   '[]', NULL, 'submitted', interval '-1 day', NULL, NULL)
) AS s(id, task_id, musician_id, attempt, page_marks, note, status, submitted_offset, reviewer, feedback)
JOIN practice_tasks t ON t.id = s.task_id
JOIN musicians m ON m.id = s.musician_id
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Para apagar tudo desta carga (arquivos no storage ficam; o script `seed:test -- --clean` remove):
--   DELETE FROM practice_tasks WHERE id::text LIKE '5eed%';
--   DELETE FROM events WHERE id::text LIKE '5eed%';
--   DELETE FROM pieces WHERE id::text LIKE '5eed%';
--   DELETE FROM musicians WHERE id::text LIKE '5eed%';
--   DELETE FROM auth.users WHERE id::text LIKE '5eed%';
