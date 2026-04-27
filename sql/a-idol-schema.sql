-- =====================================================================
-- A-idol — PostgreSQL Schema DDL  (v1.0.0, 2026-04-18)
-- Target: PostgreSQL 16+
-- Convention: snake_case, UUID v7 PK, TIMESTAMPTZ, soft delete via deleted_at
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----- ENUMs -----------------------------------------------------------
CREATE TYPE auth_provider     AS ENUM ('email','apple','google','kakao');
CREATE TYPE user_status       AS ENUM ('active','suspended','withdrawn');
CREATE TYPE audition_type     AS ENUM ('preliminary','final');
CREATE TYPE round_status      AS ENUM ('scheduled','active','closed','canceled');
CREATE TYPE vote_channel      AS ENUM ('online','sms','popularity');
CREATE TYPE order_status      AS ENUM ('pending','paid','refunded','failed');
CREATE TYPE product_type      AS ENUM ('chat_coupon','vote_ticket','photo_card_set');
CREATE TYPE chat_sender       AS ENUM ('user','idol','system');
CREATE TYPE admin_role        AS ENUM ('super_admin','content_admin','audition_admin','cs_admin');

-- =====================================================================
-- IDENTITY
-- =====================================================================
CREATE TABLE users (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider          auth_provider NOT NULL,
  provider_user_id  text NOT NULL,
  email             citext UNIQUE,
  nickname          varchar(30) NOT NULL,
  avatar_url        text,
  instagram_handle  varchar(40),
  birthdate         date NOT NULL,
  status            user_status NOT NULL DEFAULT 'active',
  marketing_opt_in  boolean NOT NULL DEFAULT false,
  push_opt_in       boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz,
  UNIQUE (provider, provider_user_id)
);
CREATE INDEX idx_users_status ON users(status) WHERE deleted_at IS NULL;

CREATE TABLE auth_sessions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash text NOT NULL,
  device_id          varchar(80),
  ip                 inet,
  user_agent         text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  expires_at         timestamptz NOT NULL,
  revoked_at         timestamptz
);
CREATE INDEX idx_auth_sessions_user ON auth_sessions(user_id) WHERE revoked_at IS NULL;

CREATE TABLE consent_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doc_code    varchar(40) NOT NULL,
  doc_version varchar(10) NOT NULL,
  agreed      boolean NOT NULL,
  agreed_at   timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- CATALOG
-- =====================================================================
CREATE TABLE agencies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        varchar(80) NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE TABLE idols (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id      uuid NOT NULL REFERENCES agencies(id) ON DELETE RESTRICT,
  name           varchar(40) NOT NULL,
  stage_name     varchar(40),
  birthdate      date,
  mbti           varchar(4),
  character_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  bio            text,
  hero_image_url text,
  heart_count    bigint NOT NULL DEFAULT 0,
  follow_count   bigint NOT NULL DEFAULT 0,
  published_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz
);
CREATE INDEX idx_idols_published ON idols(published_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE idol_media (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idol_id     uuid NOT NULL REFERENCES idols(id) ON DELETE CASCADE,
  kind        varchar(20) NOT NULL, -- image, video
  url         text NOT NULL,
  order_index int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_idol_media_idol ON idol_media(idol_id, order_index);

CREATE TABLE schedules (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idol_id    uuid NOT NULL REFERENCES idols(id) ON DELETE CASCADE,
  title      varchar(80) NOT NULL,
  start_at   timestamptz NOT NULL,
  end_at     timestamptz,
  location   varchar(80),
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_schedules_time ON schedules(idol_id, start_at);

-- =====================================================================
-- FANDOM
-- =====================================================================
CREATE TABLE hearts (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idol_id    uuid NOT NULL REFERENCES idols(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, idol_id)
);

CREATE TABLE follows (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idol_id    uuid NOT NULL REFERENCES idols(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, idol_id)
);

CREATE TABLE fan_clubs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idol_id    uuid NOT NULL UNIQUE REFERENCES idols(id) ON DELETE CASCADE,
  tier       varchar(20) NOT NULL DEFAULT 'official',
  price      numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fan_club_id   uuid NOT NULL REFERENCES fan_clubs(id) ON DELETE CASCADE,
  joined_at     timestamptz NOT NULL DEFAULT now(),
  left_at       timestamptz,
  UNIQUE (user_id, fan_club_id)
);
CREATE INDEX idx_memberships_user ON memberships(user_id) WHERE left_at IS NULL;

-- =====================================================================
-- CHAT
-- =====================================================================
CREATE TABLE chat_rooms (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idol_id       uuid NOT NULL REFERENCES idols(id) ON DELETE CASCADE,
  fan_club_id   uuid NOT NULL REFERENCES fan_clubs(id) ON DELETE CASCADE,
  last_msg_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idol_id)
);

CREATE TABLE chat_messages (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id     uuid NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender      chat_sender NOT NULL,
  text        text NOT NULL,
  meta        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
-- initial partitions
CREATE TABLE chat_messages_2026m04 PARTITION OF chat_messages
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE chat_messages_2026m05 PARTITION OF chat_messages
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
-- (later months created by maintenance job)

CREATE TABLE chat_coupons (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id      uuid REFERENCES chat_rooms(id) ON DELETE CASCADE,
  source       varchar(20) NOT NULL, -- 'daily','purchased','reward'
  balance      int NOT NULL CHECK (balance >= 0),
  valid_from   timestamptz NOT NULL DEFAULT now(),
  valid_until  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_coupons_user_active ON chat_coupons(user_id) WHERE balance > 0;

CREATE TABLE auto_message_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_club_id uuid NOT NULL REFERENCES fan_clubs(id) ON DELETE CASCADE,
  slot        varchar(20) NOT NULL, -- 'morning','noon','night'
  text        text NOT NULL,
  cron_expr   varchar(40) NOT NULL, -- 스케줄
  enabled     boolean NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fan_club_id, slot)
);

-- =====================================================================
-- COMMERCE
-- =====================================================================
CREATE TABLE orders (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  product_type product_type NOT NULL,
  product_code varchar(40) NOT NULL,
  amount       numeric(14,2) NOT NULL,
  currency     char(3) NOT NULL DEFAULT 'KRW',
  status       order_status NOT NULL DEFAULT 'pending',
  platform     varchar(10) NOT NULL, -- 'ios','android','web'
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_user ON orders(user_id, created_at DESC);

CREATE TABLE receipts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       uuid NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  platform       varchar(10) NOT NULL,
  transaction_id varchar(120) NOT NULL,
  raw            jsonb NOT NULL,
  verified_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, transaction_id)
);

CREATE TABLE photo_card_sets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idol_id      uuid NOT NULL REFERENCES idols(id) ON DELETE CASCADE,
  name         varchar(60) NOT NULL,
  cover_url    text,
  price        numeric(14,2) NOT NULL,
  released_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);

CREATE TABLE photo_card_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id      uuid NOT NULL REFERENCES photo_card_sets(id) ON DELETE CASCADE,
  order_index int NOT NULL, -- 1..12
  image_url   text NOT NULL,
  rarity      varchar(10) NOT NULL DEFAULT 'N', -- N,R,SR,SSR (phase2)
  weight      int NOT NULL DEFAULT 1,           -- 균등(1), 추후 가중
  UNIQUE (set_id, order_index)
);

CREATE TABLE user_cards (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_item_id      uuid NOT NULL REFERENCES photo_card_items(id) ON DELETE RESTRICT,
  order_id          uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  drawn_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_cards_user ON user_cards(user_id);

-- =====================================================================
-- AUDITION
-- =====================================================================
CREATE TABLE auditions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       varchar(80) NOT NULL,
  type        audition_type NOT NULL, -- preliminary/final series
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE vote_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audition_id     uuid NOT NULL REFERENCES auditions(id) ON DELETE CASCADE,
  name            varchar(40) NOT NULL,
  online_weight    numeric(4,3) NOT NULL,
  sms_weight       numeric(4,3) NOT NULL,
  popularity_weight numeric(4,3) NOT NULL,
  version          int NOT NULL DEFAULT 1,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK ((online_weight + sms_weight + popularity_weight) BETWEEN 0.999 AND 1.001)
);

CREATE TABLE rounds (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audition_id   uuid NOT NULL REFERENCES auditions(id) ON DELETE CASCADE,
  index         int NOT NULL, -- 1..10 예선, 11 결선 등
  label         varchar(40) NOT NULL,
  status        round_status NOT NULL DEFAULT 'scheduled',
  starts_at     timestamptz NOT NULL,
  ends_at       timestamptz NOT NULL,
  vote_rule_id  uuid NOT NULL REFERENCES vote_rules(id),
  pass_quota    int,              -- 진출자 수
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (audition_id, index)
);

CREATE TABLE vote_tickets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source      varchar(20) NOT NULL, -- 'purchased','reward'
  balance     int NOT NULL CHECK (balance >= 0),
  valid_from  timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vote_tickets_user ON vote_tickets(user_id) WHERE balance > 0;

CREATE TABLE votes (
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  round_id   uuid NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  idol_id    uuid NOT NULL REFERENCES idols(id) ON DELETE CASCADE,
  channel    vote_channel NOT NULL DEFAULT 'online',
  amount     int NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
CREATE TABLE votes_2026m04 PARTITION OF votes FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE votes_2026m05 PARTITION OF votes FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE INDEX idx_votes_round_idol ON votes (round_id, idol_id);

CREATE TABLE round_rankings (
  round_id      uuid NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  idol_id       uuid NOT NULL REFERENCES idols(id) ON DELETE CASCADE,
  online_count  bigint NOT NULL DEFAULT 0,
  sms_count     bigint NOT NULL DEFAULT 0,
  popularity    numeric(12,4) NOT NULL DEFAULT 0,
  weighted_score numeric(16,4) NOT NULL DEFAULT 0,
  rank          int,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (round_id, idol_id)
);

-- =====================================================================
-- CONTENT
-- =====================================================================
CREATE TABLE posts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idol_id    uuid REFERENCES idols(id) ON DELETE CASCADE,
  author_id  uuid REFERENCES admin_users(id), -- 작성자(관리자)
  title      varchar(120),
  body       text,
  publish_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE media_assets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type varchar(20) NOT NULL, -- 'post','idol','chat'
  owner_id   uuid,
  url        text NOT NULL,
  mime       varchar(40),
  bytes      bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- NOTIFICATION
-- =====================================================================
CREATE TABLE push_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform   varchar(10) NOT NULL,
  token      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  invalidated_at timestamptz,
  UNIQUE (platform, token)
);

CREATE TABLE notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       varchar(30) NOT NULL, -- payment, chat, audition, marketing
  title      varchar(120) NOT NULL,
  body       text,
  meta       jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);

-- =====================================================================
-- ADMIN
-- =====================================================================
CREATE TABLE admin_users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      citext UNIQUE NOT NULL,
  name       varchar(30) NOT NULL,
  role       admin_role NOT NULL,
  password_hash text NOT NULL,
  mfa_secret text,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE audit_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  action       varchar(40) NOT NULL,
  target_table varchar(40) NOT NULL,
  target_id    uuid,
  diff         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_target ON audit_logs(target_table, target_id);

-- =====================================================================
-- Triggers: updated_at autoset
-- =====================================================================
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','idols','agencies','chat_coupons','orders','photo_card_sets',
    'vote_tickets','posts','auto_message_templates']
  LOOP
    EXECUTE format('CREATE TRIGGER trg_%I_upd BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION touch_updated_at();', t, t);
  END LOOP;
END $$;

-- END OF DDL
