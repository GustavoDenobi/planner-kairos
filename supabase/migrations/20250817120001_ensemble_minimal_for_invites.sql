-- Minimal Ensemble tables required for invite acceptance

CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind group_kind NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE musicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  birth_date DATE,
  education TEXT,
  cpf TEXT,
  user_id UUID REFERENCES profiles (id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  musician_id UUID NOT NULL REFERENCES musicians (id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  section_id UUID,
  part_id UUID,
  ensemble_role ensemble_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- FK group_invites -> groups (deferred from 001)
ALTER TABLE group_invites
  ADD CONSTRAINT group_invites_group_id_fkey
  FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE CASCADE;

CREATE TRIGGER groups_updated_at
  BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER musicians_updated_at
  BEFORE UPDATE ON musicians
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER assignments_updated_at
  BEFORE UPDATE ON assignments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
