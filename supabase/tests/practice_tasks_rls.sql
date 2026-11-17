-- Teste das policies de tarefas de estudo (practice_*), num banco local.
-- Roda tudo numa transação e desfaz no final: não altera o banco.
--
-- Requer as migrations 20261103120000_practice_tasks e 20261103140000_practice_tasks_late_submissions.
-- Se a primeira ainda não foi aplicada localmente:
--   docker cp supabase/migrations/20261103120000_practice_tasks.sql supabase_db_planner-kairos:/tmp/practice_migration.sql
-- (se já foi aplicada, remova a linha "\i /tmp/practice_migration.sql")
--   docker cp supabase/tests/practice_tasks_rls.sql supabase_db_planner-kairos:/tmp/practice_tasks_rls.sql
--   docker exec supabase_db_planner-kairos psql -U postgres -q -f /tmp/practice_tasks_rls.sql
-- No Git Bash, exporte MSYS_NO_PATHCONV=1 antes.

\set ON_ERROR_STOP 1
BEGIN;

\i /tmp/practice_migration.sql

CREATE FUNCTION pg_temp.expect_fail(p_sql TEXT, p_label TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ok  (bloqueado) %: %', p_label, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: deveria bloquear: %', p_label;
END $$;

CREATE FUNCTION pg_temp.expect_count(p_sql TEXT, p_expected INT, p_label TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v INT;
BEGIN
  EXECUTE p_sql INTO v;
  IF v IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION 'FALHOU: % (esperado %, veio %)', p_label, p_expected, v;
  END IF;
  RAISE NOTICE 'ok  %', p_label;
END $$;

CREATE FUNCTION pg_temp.act_as(p_user UUID) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::TEXT, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::TEXT, true);
END $$;

GRANT EXECUTE ON FUNCTION pg_temp.expect_fail(TEXT, TEXT), pg_temp.expect_count(TEXT, INT, TEXT), pg_temp.act_as(UUID) TO authenticated;

-- Fixtures ------------------------------------------------------------------
INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
VALUES
  ('a0000000-7e57-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@t.test', '{"full_name":"Admin"}', now(), now()),
  ('a0000000-7e57-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'prof@t.test', '{"full_name":"Prof"}', now(), now()),
  ('a0000000-7e57-4000-8000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'aluno@t.test', '{"full_name":"Aluno"}', now(), now()),
  ('a0000000-7e57-4000-8000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outro@t.test', '{"full_name":"Outro"}', now(), now());

INSERT INTO organizations (id, name, slug, plan_id)
VALUES ('b0000000-7e57-4000-8000-000000000001', 'Org Teste', 'org-teste-practice', (SELECT id FROM plans LIMIT 1));

INSERT INTO memberships (organization_id, user_id, access_role) VALUES
  ('b0000000-7e57-4000-8000-000000000001', 'a0000000-7e57-4000-8000-00000000000a', 'owner'),
  ('b0000000-7e57-4000-8000-000000000001', 'a0000000-7e57-4000-8000-00000000000b', 'member'),
  ('b0000000-7e57-4000-8000-000000000001', 'a0000000-7e57-4000-8000-00000000000c', 'member'),
  ('b0000000-7e57-4000-8000-000000000001', 'a0000000-7e57-4000-8000-00000000000d', 'member');

-- Os gatilhos de limite do plano exigem um usuário autenticado e membro da org.
SELECT pg_temp.act_as('a0000000-7e57-4000-8000-00000000000a');

INSERT INTO groups (id, organization_id, name, kind) VALUES
  ('c0000000-7e57-4000-8000-000000000001', 'b0000000-7e57-4000-8000-000000000001', 'Turma A', 'class'),
  ('c0000000-7e57-4000-8000-000000000002', 'b0000000-7e57-4000-8000-000000000001', 'Turma B', 'class');

INSERT INTO musicians (id, organization_id, full_name, user_id) VALUES
  ('d0000000-7e57-4000-8000-00000000000b', 'b0000000-7e57-4000-8000-000000000001', 'Prof', 'a0000000-7e57-4000-8000-00000000000b'),
  ('d0000000-7e57-4000-8000-00000000000c', 'b0000000-7e57-4000-8000-000000000001', 'Aluno', 'a0000000-7e57-4000-8000-00000000000c'),
  ('d0000000-7e57-4000-8000-00000000000d', 'b0000000-7e57-4000-8000-000000000001', 'Outro', 'a0000000-7e57-4000-8000-00000000000d');

INSERT INTO assignments (organization_id, musician_id, group_id, ensemble_role) VALUES
  ('b0000000-7e57-4000-8000-000000000001', 'd0000000-7e57-4000-8000-00000000000b', 'c0000000-7e57-4000-8000-000000000001', 'teacher'),
  ('b0000000-7e57-4000-8000-000000000001', 'd0000000-7e57-4000-8000-00000000000c', 'c0000000-7e57-4000-8000-000000000001', 'member'),
  ('b0000000-7e57-4000-8000-000000000001', 'd0000000-7e57-4000-8000-00000000000d', 'c0000000-7e57-4000-8000-000000000002', 'member');

INSERT INTO pieces (id, organization_id, title, category_id)
VALUES ('e0000000-7e57-4000-8000-000000000001', 'b0000000-7e57-4000-8000-000000000001', 'Sonata',
  (SELECT id FROM piece_categories WHERE organization_id = 'b0000000-7e57-4000-8000-000000000001' LIMIT 1));

INSERT INTO piece_files (id, organization_id, piece_id, kind, storage_key, mime_type, original_name, title)
VALUES ('e1000000-7e57-4000-8000-000000000001', 'b0000000-7e57-4000-8000-000000000001', 'e0000000-7e57-4000-8000-000000000001',
  'score', 'b0000000-7e57-4000-8000-000000000001/pieces/x/y.pdf', 'application/pdf', 'y.pdf', 'Violino');

INSERT INTO piece_file_toc_entries (id, organization_id, piece_file_id, label, sort_order, target_page_number, target_y)
VALUES ('e2000000-7e57-4000-8000-000000000001', 'b0000000-7e57-4000-8000-000000000001', 'e1000000-7e57-4000-8000-000000000001',
  '2º movimento', 0, 3, 0.25);

-- Professor -----------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT pg_temp.act_as('a0000000-7e57-4000-8000-00000000000b');

INSERT INTO practice_tasks (id, organization_id, title, due_at, piece_id, piece_file_id, toc_entry_id)
VALUES ('f0000000-7e57-4000-8000-000000000001', 'b0000000-7e57-4000-8000-000000000001', 'Estudar 2º mov.',
  now() + interval '3 days', 'e0000000-7e57-4000-8000-000000000001', 'e1000000-7e57-4000-8000-000000000001',
  'e2000000-7e57-4000-8000-000000000001')
RETURNING toc_label_snapshot, target_page, target_y, created_by;

SELECT pg_temp.expect_count($q$SELECT count(*) FROM practice_tasks WHERE toc_label_snapshot = '2º movimento' AND target_page = 3$q$, 1,
  'professor cria tarefa; sumário copiado pelo servidor; INSERT RETURNING visível');

INSERT INTO practice_task_groups (organization_id, task_id, group_id)
VALUES ('b0000000-7e57-4000-8000-000000000001', 'f0000000-7e57-4000-8000-000000000001', 'c0000000-7e57-4000-8000-000000000001');
SELECT pg_temp.expect_fail($q$INSERT INTO practice_task_groups (organization_id, task_id, group_id)
  VALUES ('b0000000-7e57-4000-8000-000000000001', 'f0000000-7e57-4000-8000-000000000001', 'c0000000-7e57-4000-8000-000000000002')$q$,
  'professor não indica grupo em que não atua');
SELECT pg_temp.expect_fail($q$INSERT INTO practice_task_musicians (organization_id, task_id, musician_id)
  VALUES ('b0000000-7e57-4000-8000-000000000001', 'f0000000-7e57-4000-8000-000000000001', 'd0000000-7e57-4000-8000-00000000000d')$q$,
  'professor não indica aluno de outro grupo');

-- Aluno --------------------------------------------------------------------
SELECT pg_temp.act_as('a0000000-7e57-4000-8000-00000000000c');
SELECT pg_temp.expect_count('SELECT count(*) FROM practice_tasks', 1, 'aluno do grupo vê a tarefa');
SELECT pg_temp.expect_fail($q$INSERT INTO practice_tasks (organization_id, title, due_at)
  VALUES ('b0000000-7e57-4000-8000-000000000001', 'x', now())$q$, 'aluno não cria tarefa');

INSERT INTO storage.objects (bucket_id, name)
VALUES ('org-assets', 'b0000000-7e57-4000-8000-000000000001/practice/f0000000-7e57-4000-8000-000000000001/d0000000-7e57-4000-8000-00000000000c/s1.webm');
SELECT pg_temp.expect_fail($q$INSERT INTO storage.objects (bucket_id, name)
  VALUES ('org-assets', 'b0000000-7e57-4000-8000-000000000001/practice/f0000000-7e57-4000-8000-000000000001/d0000000-7e57-4000-8000-00000000000d/s9.webm')$q$,
  'aluno não envia arquivo em nome de outro');

INSERT INTO practice_submissions (id, organization_id, task_id, musician_id, attempt, storage_path, mime_type, duration_ms, byte_size)
VALUES ('f1000000-7e57-4000-8000-000000000001', 'b0000000-7e57-4000-8000-000000000001', 'f0000000-7e57-4000-8000-000000000001',
  'd0000000-7e57-4000-8000-00000000000c', 1,
  'b0000000-7e57-4000-8000-000000000001/practice/f0000000-7e57-4000-8000-000000000001/d0000000-7e57-4000-8000-00000000000c/s1.webm',
  'audio/webm', 30000, 1234)
RETURNING status;
SELECT pg_temp.expect_fail($q$INSERT INTO practice_submissions (organization_id, task_id, musician_id, attempt, storage_path, mime_type, duration_ms, byte_size)
  VALUES ('b0000000-7e57-4000-8000-000000000001', 'f0000000-7e57-4000-8000-000000000001', 'd0000000-7e57-4000-8000-00000000000c', 2,
  'b0000000-7e57-4000-8000-000000000001/branding/x.webm', 'audio/webm', 1, 1)$q$, 'caminho fora da pasta da tarefa');
SELECT pg_temp.expect_fail($q$INSERT INTO practice_submissions (organization_id, task_id, musician_id, attempt, storage_path, mime_type, duration_ms, byte_size, status)
  VALUES ('b0000000-7e57-4000-8000-000000000001', 'f0000000-7e57-4000-8000-000000000001', 'd0000000-7e57-4000-8000-00000000000c', 2,
  'b0000000-7e57-4000-8000-000000000001/practice/f0000000-7e57-4000-8000-000000000001/d0000000-7e57-4000-8000-00000000000c/s2.webm',
  'audio/webm', 1, 1, 'reviewed')$q$, 'aluno não envia já como revisado');
SELECT pg_temp.expect_count($q$WITH u AS (UPDATE practice_submissions SET status = 'reviewed' RETURNING 1) SELECT count(*) FROM u$q$, 0,
  'aluno não revisa o próprio envio');

-- Aluno de outro grupo -------------------------------------------------------
SELECT pg_temp.act_as('a0000000-7e57-4000-8000-00000000000d');
SELECT pg_temp.expect_count('SELECT count(*) FROM practice_tasks', 0, 'outro aluno não vê a tarefa');
SELECT pg_temp.expect_count('SELECT count(*) FROM practice_submissions', 0, 'outro aluno não vê envios');
SELECT pg_temp.expect_count($q$SELECT count(*) FROM storage.objects WHERE name LIKE '%/practice/%'$q$, 0,
  'outro membro não lê o arquivo da gravação');

-- Professor revisa -------------------------------------------------------------
SELECT pg_temp.act_as('a0000000-7e57-4000-8000-00000000000b');
SELECT pg_temp.expect_count('SELECT count(*) FROM practice_submissions', 1, 'professor vê o envio');
SELECT pg_temp.expect_count($q$SELECT count(*) FROM storage.objects WHERE name LIKE '%/practice/%'$q$, 1, 'professor lê o arquivo');
SELECT pg_temp.expect_fail($q$UPDATE practice_submissions SET storage_path = 'x' WHERE id = 'f1000000-7e57-4000-8000-000000000001'$q$,
  'professor não altera o arquivo do envio');
SELECT pg_temp.expect_count($q$WITH u AS (
    UPDATE practice_submissions SET status = 'reviewed', feedback = 'Muito bem'
    WHERE id = 'f1000000-7e57-4000-8000-000000000001'
    RETURNING reviewed_by, reviewed_at)
  SELECT count(*) FROM u WHERE reviewed_by = 'a0000000-7e57-4000-8000-00000000000b' AND reviewed_at IS NOT NULL$q$, 1,
  'professor revisa; servidor grava autor e data da revisão');

-- Aluno depois da revisão -------------------------------------------------------
SELECT pg_temp.act_as('a0000000-7e57-4000-8000-00000000000c');
SELECT pg_temp.expect_fail($q$INSERT INTO practice_submissions (organization_id, task_id, musician_id, attempt, storage_path, mime_type, duration_ms, byte_size)
  VALUES ('b0000000-7e57-4000-8000-000000000001', 'f0000000-7e57-4000-8000-000000000001', 'd0000000-7e57-4000-8000-00000000000c', 2,
  'b0000000-7e57-4000-8000-000000000001/practice/f0000000-7e57-4000-8000-000000000001/d0000000-7e57-4000-8000-00000000000c/s2.webm',
  'audio/webm', 1, 1)$q$, 'sem novo envio depois de revisado');
SELECT pg_temp.expect_count($q$WITH d AS (DELETE FROM practice_submissions RETURNING 1) SELECT count(*) FROM d$q$, 0,
  'aluno não apaga envio já revisado');

-- Exclusão de arquivos ------------------------------------------------------------
-- A Storage API libera DELETE direto com esta configuração; aqui só vale dentro da transação.
SELECT set_config('storage.allow_delete_query', 'true', true);
SELECT pg_temp.act_as('a0000000-7e57-4000-8000-00000000000d');
SELECT pg_temp.expect_count($q$WITH d AS (DELETE FROM storage.objects WHERE name LIKE '%/practice/%' RETURNING 1) SELECT count(*) FROM d$q$, 0,
  'outro aluno não apaga a gravação');
SELECT pg_temp.act_as('a0000000-7e57-4000-8000-00000000000b');
SELECT pg_temp.expect_count($q$WITH d AS (DELETE FROM storage.objects WHERE name LIKE '%/practice/%' RETURNING 1) SELECT count(*) FROM d$q$, 1,
  'professor da tarefa apaga a gravação (ao excluir a tarefa)');

-- Envios atrasados (migration 20261103140000) ---------------------------------
RESET ROLE;
INSERT INTO practice_tasks (id, organization_id, title, due_at, accept_late_submissions, created_by)
VALUES ('f0000000-7e57-4000-8000-000000000002', 'b0000000-7e57-4000-8000-000000000001', 'Prazo rígido',
  now() - interval '1 day', false, 'a0000000-7e57-4000-8000-00000000000b');
INSERT INTO practice_task_groups (organization_id, task_id, group_id)
VALUES ('b0000000-7e57-4000-8000-000000000001', 'f0000000-7e57-4000-8000-000000000002', 'c0000000-7e57-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT pg_temp.act_as('a0000000-7e57-4000-8000-00000000000c');
SELECT pg_temp.expect_fail($q$INSERT INTO practice_submissions (organization_id, task_id, musician_id, attempt, storage_path, mime_type, duration_ms, byte_size)
  VALUES ('b0000000-7e57-4000-8000-000000000001', 'f0000000-7e57-4000-8000-000000000002', 'd0000000-7e57-4000-8000-00000000000c', 1,
  'b0000000-7e57-4000-8000-000000000001/practice/f0000000-7e57-4000-8000-000000000002/d0000000-7e57-4000-8000-00000000000c/a.webm',
  'audio/webm', 1, 1)$q$, 'tarefa sem envios atrasados recusa envio após o prazo');
RESET ROLE;
INSERT INTO practice_submissions (organization_id, task_id, musician_id, submitted_by, attempt, storage_path, mime_type, duration_ms, byte_size, status)
VALUES ('b0000000-7e57-4000-8000-000000000001', 'f0000000-7e57-4000-8000-000000000002', 'd0000000-7e57-4000-8000-00000000000c',
  'a0000000-7e57-4000-8000-00000000000c', 1,
  'b0000000-7e57-4000-8000-000000000001/practice/f0000000-7e57-4000-8000-000000000002/d0000000-7e57-4000-8000-00000000000c/b.webm',
  'audio/webm', 1, 1, 'redo_requested');
SET LOCAL ROLE authenticated;
SELECT pg_temp.act_as('a0000000-7e57-4000-8000-00000000000c');
INSERT INTO practice_submissions (organization_id, task_id, musician_id, attempt, storage_path, mime_type, duration_ms, byte_size)
VALUES ('b0000000-7e57-4000-8000-000000000001', 'f0000000-7e57-4000-8000-000000000002', 'd0000000-7e57-4000-8000-00000000000c', 2,
  'b0000000-7e57-4000-8000-000000000001/practice/f0000000-7e57-4000-8000-000000000002/d0000000-7e57-4000-8000-00000000000c/c.webm',
  'audio/webm', 1, 1);
SELECT pg_temp.expect_count($q$SELECT count(*) FROM practice_submissions WHERE task_id = 'f0000000-7e57-4000-8000-000000000002' AND attempt = 2$q$, 1,
  'pedido para refazer permite reenviar mesmo após o prazo');

-- Admin ---------------------------------------------------------------------
SELECT pg_temp.act_as('a0000000-7e57-4000-8000-00000000000a');
SELECT pg_temp.expect_count($q$SELECT count(*) FROM practice_tasks WHERE id = 'f0000000-7e57-4000-8000-000000000001'$q$, 1, 'admin vê a tarefa');

-- Referência sobrevive a exclusões ------------------------------------------
RESET ROLE;
DELETE FROM piece_file_toc_entries WHERE id = 'e2000000-7e57-4000-8000-000000000001';
SELECT pg_temp.expect_count($q$SELECT count(*) FROM practice_tasks
  WHERE toc_entry_id IS NULL AND toc_label_snapshot = '2º movimento' AND target_page = 3$q$, 1,
  'item do sumário apagado: cópia mantida');
DELETE FROM piece_files WHERE id = 'e1000000-7e57-4000-8000-000000000001';
SELECT pg_temp.expect_count($q$SELECT count(*) FROM practice_tasks
  WHERE piece_id IS NOT NULL AND piece_file_id IS NULL AND toc_label_snapshot IS NULL AND target_page IS NULL$q$, 1,
  'arquivo apagado: tarefa fica só com a obra');

-- Tarefa encerrada --------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT pg_temp.act_as('a0000000-7e57-4000-8000-00000000000b');
UPDATE practice_tasks SET closed_at = now() WHERE id = 'f0000000-7e57-4000-8000-000000000001';
SELECT pg_temp.expect_count($q$SELECT count(*) FROM practice_tasks WHERE closed_at IS NOT NULL AND id = 'f0000000-7e57-4000-8000-000000000001'$q$, 1, 'professor encerra a tarefa');

RESET ROLE;
\echo 'TODOS OS TESTES PASSARAM'
ROLLBACK;
