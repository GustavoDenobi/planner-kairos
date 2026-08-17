-- Dev seed: Orquestra Kairós + groups + parts + sections + admin user

DO $$
DECLARE
  v_org_id UUID := 'a0000000-0000-4000-8000-000000000001';
  v_user_id UUID := 'b0000000-0000-4000-8000-000000000001';
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
  INSERT INTO organizations (id, name, slug)
  VALUES (v_org_id, 'Orquestra Kairós', 'kairos')
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

  -- Admin dev user: email admin@kairos.local / password: kairos-admin
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  )
  VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin@kairos.local',
    crypt('kairos-admin', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Admin Kairós"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    v_user_id,
    v_user_id,
    format('{"sub":"%s","email":"admin@kairos.local"}', v_user_id)::jsonb,
    'email',
    v_user_id::TEXT,
    now(),
    now(),
    now()
  )
  ON CONFLICT (provider, provider_id) DO NOTHING;

  INSERT INTO profiles (id, display_name, email, theme)
  VALUES (v_user_id, 'Admin Kairós', 'admin@kairos.local', 'light')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO memberships (organization_id, user_id, access_role)
  VALUES (v_org_id, v_user_id, 'owner')
  ON CONFLICT (organization_id, user_id) DO NOTHING;
END $$;
