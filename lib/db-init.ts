import pool from "./db";

let initialized = false;

export async function initDb() {
  if (initialized) return;
  initialized = true;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory (
      id              SERIAL        PRIMARY KEY,
      created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      lead_id         INTEGER       REFERENCES leads(id) ON DELETE SET NULL,
      reg             TEXT          NOT NULL,
      car_name        TEXT,
      colour          TEXT,
      mileage_bought  INTEGER,
      purchase_price  NUMERIC,
      purchase_date   DATE,
      status          TEXT          NOT NULL DEFAULT 'Bought',
      location        TEXT,
      notes           TEXT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS finance_entries (
      id              SERIAL        PRIMARY KEY,
      created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      entry_date      DATE          NOT NULL DEFAULT CURRENT_DATE,
      type            TEXT          NOT NULL,
      category        TEXT          NOT NULL,
      description     TEXT          NOT NULL,
      amount          NUMERIC       NOT NULL,
      inventory_id    INTEGER       REFERENCES inventory(id) ON DELETE SET NULL,
      lead_id         INTEGER       REFERENCES leads(id) ON DELETE SET NULL,
      created_by      TEXT,
      notes           TEXT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bank_balances (
      id            SERIAL      PRIMARY KEY,
      bank_name     TEXT        NOT NULL,
      balance       NUMERIC     NOT NULL,
      balance_date  DATE        NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS investments (
      id               SERIAL      PRIMARY KEY,
      name             TEXT        NOT NULL,
      type             TEXT        NOT NULL,
      amount           NUMERIC     NOT NULL,
      investment_date  DATE        NOT NULL,
      notes            TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS receivables (
      id             SERIAL      PRIMARY KEY,
      name           TEXT        NOT NULL,
      description    TEXT,
      amount         NUMERIC     NOT NULL,
      due_date       DATE,
      received       BOOLEAN     NOT NULL DEFAULT FALSE,
      received_date  DATE,
      notes          TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`ALTER TABLE finance_entries ADD COLUMN IF NOT EXISTS vat_claimable BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`ALTER TABLE finance_entries ADD COLUMN IF NOT EXISTS off_the_records BOOLEAN NOT NULL DEFAULT FALSE`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS car_photos (
      id                SERIAL        PRIMARY KEY,
      created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      inventory_id      INTEGER       NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
      file_path         TEXT          NOT NULL,
      processed_path    TEXT,
      label             TEXT,
      sort_order        INTEGER       NOT NULL DEFAULT 0,
      processing_status TEXT          NOT NULL DEFAULT 'pending',
      processing_error  TEXT,
      created_by        TEXT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_jobs (
      id                        SERIAL      PRIMARY KEY,
      created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      photo_id                  INTEGER     REFERENCES car_photos(id) ON DELETE CASCADE,
      job_type                  TEXT        NOT NULL DEFAULT 'bg_removal',
      status                    TEXT        NOT NULL DEFAULT 'queued',
      replicate_prediction_id   TEXT,
      error_message             TEXT,
      completed_at              TIMESTAMPTZ
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS car_listings (
      id                  SERIAL      PRIMARY KEY,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      inventory_id        INTEGER     NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
      title               TEXT        NOT NULL,
      description         TEXT        NOT NULL,
      price               NUMERIC     NOT NULL,
      selected_photo_ids  INTEGER[],
      status              TEXT        NOT NULL DEFAULT 'draft',
      published_at        TIMESTAMPTZ,
      created_by          TEXT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS listing_publications (
      id            SERIAL      PRIMARY KEY,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      listing_id    INTEGER     NOT NULL REFERENCES car_listings(id) ON DELETE CASCADE,
      platform      TEXT        NOT NULL,
      status        TEXT        NOT NULL DEFAULT 'pending',
      published_at  TIMESTAMPTZ,
      external_url  TEXT,
      UNIQUE (listing_id, platform)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS official_records (
      id              SERIAL        PRIMARY KEY,
      created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      inventory_id    INTEGER       REFERENCES inventory(id) ON DELETE SET NULL,
      lead_id         INTEGER       REFERENCES leads(id) ON DELETE SET NULL,
      investment_id   INTEGER       REFERENCES investments(id) ON DELETE SET NULL,
      doc_type        TEXT          NOT NULL,
      doc_label       TEXT          NOT NULL,
      file_path       TEXT,
      storage_ref     TEXT,
      notes           TEXT,
      created_by      TEXT
    )
  `);

  await pool.query(`ALTER TABLE official_records ADD COLUMN IF NOT EXISTS investment_id INTEGER REFERENCES investments(id) ON DELETE SET NULL`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS car_showroom_photos (
      id         SERIAL      PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      photo_id   INTEGER     NOT NULL REFERENCES car_photos(id) ON DELETE CASCADE,
      scene_id   TEXT        NOT NULL,
      file_path  TEXT,
      status     TEXT        NOT NULL DEFAULT 'pending',
      error      TEXT
    )
  `);

  await pool.query(`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS use_cases TEXT[] DEFAULT '{}'`);
  await pool.query(`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS car_blurbs TEXT[] DEFAULT '{}'`);
  await pool.query(`ALTER TABLE car_photos ADD COLUMN IF NOT EXISTS active_showroom_id INTEGER REFERENCES car_showroom_photos(id) ON DELETE SET NULL`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS showroom_scenes (
      id              SERIAL      PRIMARY KEY,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      scene_key       TEXT        UNIQUE NOT NULL,
      label           TEXT        NOT NULL,
      preview_emoji   TEXT        NOT NULL DEFAULT '🚗',
      prompt_template TEXT        NOT NULL,
      background_path TEXT,
      is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
      sort_order      INTEGER     NOT NULL DEFAULT 0
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS dealer_settings (
      id            SERIAL      PRIMARY KEY,
      dealer_name   TEXT        NOT NULL DEFAULT 'HappyCarDeals',
      dealer_prompt TEXT,
      dealer_blurbs TEXT[]      DEFAULT '{}',
      badge_path    TEXT,
      car_slots     INTEGER     NOT NULL DEFAULT 5,
      dealer_slots  INTEGER     NOT NULL DEFAULT 3,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Seed default showroom scenes
  const defaultScenes = [
    { key: 'outdoor', label: 'Outdoor', emoji: '☀️', sort: 0, prompt: 'Replace ONLY the background of this car photo with a clean outdoor setting: bright blue sky with light clouds, green grass or tarmac surface. Keep the car itself completely unchanged — same position, same angle, same appearance. The car must remain the clear main subject.' },
    { key: 'showroom', label: 'Showroom', emoji: '🏢', sort: 1, prompt: 'Replace ONLY the background of this car photo with a premium indoor car showroom: white walls, polished white/grey floor, professional spotlights above. Keep the car itself completely unchanged — same position, same angle, same appearance. The car must remain the clear main subject.' },
    { key: 'urban', label: 'Urban', emoji: '🌆', sort: 2, prompt: 'Replace ONLY the background of this car photo with a city street scene at golden hour: urban buildings, street lights beginning to glow, warm sunset light. Keep the car itself completely unchanged — same position, same angle, same appearance. The car must remain the clear main subject.' },
    { key: 'nature', label: 'Nature', emoji: '🌿', sort: 3, prompt: 'Replace ONLY the background of this car photo with a scenic countryside road: lush green hills, trees, open sky. Keep the car itself completely unchanged — same position, same angle, same appearance. The car must remain the clear main subject.' },
  ];
  for (const s of defaultScenes) {
    await pool.query(
      `INSERT INTO showroom_scenes (scene_key, label, preview_emoji, prompt_template, sort_order)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (scene_key) DO NOTHING`,
      [s.key, s.label, s.emoji, s.prompt, s.sort]
    );
  }

  // Seed default dealer settings
  await pool.query(
    `INSERT INTO dealer_settings (dealer_name) VALUES ('HappyCarDeals')
     ON CONFLICT DO NOTHING`
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_usage_log (
      id            SERIAL        PRIMARY KEY,
      created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      operation     TEXT          NOT NULL,
      model         TEXT          NOT NULL,
      input_tokens  INTEGER       NOT NULL DEFAULT 0,
      output_tokens INTEGER       NOT NULL DEFAULT 0,
      cost_usd      NUMERIC(10,6) NOT NULL DEFAULT 0
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS video_jobs (
      id               SERIAL      PRIMARY KEY,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      inventory_id     INTEGER     REFERENCES inventory(id) ON DELETE CASCADE,
      prompt           TEXT        NOT NULL,
      photo_id         INTEGER     REFERENCES car_photos(id) ON DELETE SET NULL,
      operation_name   TEXT,
      status           TEXT        NOT NULL DEFAULT 'pending',
      file_path        TEXT,
      error            TEXT,
      duration_seconds INTEGER     NOT NULL DEFAULT 5
    )
  `);
}
