-- Dev seed: Orquestra Kairós + groups + admin user

DO $$
DECLARE
  v_org_id UUID := 'a0000000-0000-4000-8000-000000000001';
  v_user_id UUID := 'b0000000-0000-4000-8000-000000000001';
  v_group_orchestra UUID := 'c0000000-0000-4000-8000-000000000001';
  v_group_bigband UUID := 'c0000000-0000-4000-8000-000000000002';
  v_group_choir UUID := 'c0000000-0000-4000-8000-000000000003';
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
