/**
 * One-time bootstrap for production: admin user + Orquestra Kairós org.
 * Usage: node scripts/bootstrap-prod-admin.mjs
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.
 */

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ADMIN_EMAIL = 'admin@kairos.local';
const ADMIN_PASSWORD = 'kairos-admin';
const ADMIN_NAME = 'Admin Kairós';

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: existingUsers } = await supabase.auth.admin.listUsers({ perPage: 1 });
if (existingUsers?.users?.length > 0) {
  console.error('Production already has users. Aborting to avoid duplicates.');
  process.exit(1);
}

const { data: created, error: createError } = await supabase.auth.admin.createUser({
  email: ADMIN_EMAIL,
  password: ADMIN_PASSWORD,
  email_confirm: true,
  user_metadata: { display_name: ADMIN_NAME },
});

if (createError || !created.user) {
  console.error('Failed to create admin user:', createError?.message ?? 'unknown error');
  process.exit(1);
}

const userId = created.user.id;
console.log(`Created auth user: ${ADMIN_EMAIL} (${userId})`);

const orgSql = `
DO $$
DECLARE
  v_org_id UUID := 'a0000000-0000-4000-8000-000000000001';
  v_user_id UUID := '${userId}';
  v_group_orchestra UUID := 'c0000000-0000-4000-8000-000000000001';
  v_group_bigband UUID := 'c0000000-0000-4000-8000-000000000002';
  v_group_choir UUID := 'c0000000-0000-4000-8000-000000000003';
  v_part_sax UUID := 'd0000000-0000-4000-8000-000000000001';
  v_part_violin UUID := 'd0000000-0000-4000-8000-000000000002';
  v_part_trombone UUID := 'd0000000-0000-4000-8000-000000000003';
  v_part_soprano UUID := 'd0000000-0000-4000-8000-000000000004';
  v_section_cordas UUID;
  v_section_metais UUID;
  v_section_sax UUID;
  v_section_sopranos UUID;
BEGIN
  INSERT INTO organizations (id, name, slug, plan_id)
  VALUES (v_org_id, 'Orquestra Kairós', 'kairos', 'f0000000-0000-4000-8000-000000000001')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO groups (id, organization_id, name, kind)
  VALUES
    (v_group_orchestra, v_org_id, 'Orquestra', 'ensemble'),
    (v_group_bigband, v_org_id, 'Big Band', 'ensemble'),
    (v_group_choir, v_org_id, 'Coral', 'choir')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO parts (id, organization_id, name, kind, sort_order)
  VALUES
    (v_part_sax, v_org_id, 'Sax alto', 'instrument', 1),
    (v_part_violin, v_org_id, 'Violino', 'instrument', 2),
    (v_part_trombone, v_org_id, 'Trombone', 'instrument', 3),
    (v_part_soprano, v_org_id, 'Soprano', 'voice', 4)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO part_divisions (organization_id, part_id, name, sort_order)
  VALUES
    (v_org_id, v_part_trombone, '1', 1),
    (v_org_id, v_part_trombone, '2', 2),
    (v_org_id, v_part_trombone, '3', 3)
  ON CONFLICT DO NOTHING;

  INSERT INTO sections (organization_id, group_id, name, sort_order)
  VALUES
    (v_org_id, v_group_orchestra, 'Cordas', 1),
    (v_org_id, v_group_orchestra, 'Metais', 2),
    (v_org_id, v_group_bigband, 'Saxofones', 1),
    (v_org_id, v_group_choir, 'Sopranos', 1)
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_section_cordas
  FROM sections
  WHERE organization_id = v_org_id AND group_id = v_group_orchestra AND name = 'Cordas';

  SELECT id INTO v_section_metais
  FROM sections
  WHERE organization_id = v_org_id AND group_id = v_group_orchestra AND name = 'Metais';

  SELECT id INTO v_section_sax
  FROM sections
  WHERE organization_id = v_org_id AND group_id = v_group_bigband AND name = 'Saxofones';

  SELECT id INTO v_section_sopranos
  FROM sections
  WHERE organization_id = v_org_id AND group_id = v_group_choir AND name = 'Sopranos';

  INSERT INTO section_parts (organization_id, section_id, part_id)
  VALUES
    (v_org_id, v_section_cordas, v_part_violin),
    (v_org_id, v_section_metais, v_part_trombone),
    (v_org_id, v_section_sax, v_part_sax),
    (v_org_id, v_section_sopranos, v_part_soprano)
  ON CONFLICT DO NOTHING;

  UPDATE profiles
  SET display_name = '${ADMIN_NAME.replace(/'/g, "''")}', email = '${ADMIN_EMAIL}'
  WHERE id = v_user_id;

  INSERT INTO memberships (organization_id, user_id, access_role)
  VALUES (v_org_id, v_user_id, 'owner')
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  INSERT INTO platform_admins (user_id)
  VALUES (v_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END $$;
`;

const sqlFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '.bootstrap-prod-admin.sql');
await import('node:fs/promises').then((fs) => fs.writeFile(sqlFile, orgSql, 'utf8'));

try {
  execSync(`npx supabase db query --linked --yes -f "${sqlFile}"`, {
    stdio: 'inherit',
    cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  });
} finally {
  await import('node:fs/promises').then((fs) => fs.unlink(sqlFile).catch(() => {}));
}

console.log('Bootstrap complete.');
console.log(`Login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
console.log('Org: Orquestra Kairós (slug: kairos)');
