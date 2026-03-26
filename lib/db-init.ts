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
  await pool.query(`ALTER TABLE official_records ADD COLUMN IF NOT EXISTS investment_id INTEGER REFERENCES investments(id) ON DELETE SET NULL`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS official_records (
      id              SERIAL        PRIMARY KEY,
      created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      inventory_id    INTEGER       REFERENCES inventory(id) ON DELETE SET NULL,
      lead_id         INTEGER       REFERENCES leads(id) ON DELETE SET NULL,
      doc_type        TEXT          NOT NULL,
      doc_label       TEXT          NOT NULL,
      file_path       TEXT,
      storage_ref     TEXT,
      notes           TEXT,
      created_by      TEXT
    )
  `);
}
