import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { env } from './env.js';

export const pool = new pg.Pool({ connectionString: env.db });
export const q = (text, params) => pool.query(text, params);

export async function migrate() {
  const sql = await readFile(new URL('../../db/schema.sql', import.meta.url), 'utf8');
  try {
    await q(sql);
  } catch (e) {
    if (e.code === 'ECONNREFUSED' || e.code === 'ENOTFOUND') {
      console.error(
        `Nie moge sie polaczyc z baza (${e.code}).\n` +
        `DATABASE_URL: ${String(env.db || '(nie ustawione)').replace(/:[^:@/]*@/, ':***@')}\n` +
        'Uruchom: npm run db:up   (albo popraw port w DATABASE_URL / RADAR_DB_PORT)',
      );
      process.exitCode = 1;
      return;
    }
    throw e;
  }
  console.log('schema ok');
}

/** Wstawia sygnal, ignoruje duplikat. Zwraca true jesli to nowosc. */
export async function upsertSignal(s) {
  const r = await q(
    `INSERT INTO signals
       (source, external_id, url, title, body, city, province, budget,
        published_at, deadline_at, channel, relevance, is_local, raw)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (source, external_id) DO NOTHING
     RETURNING id`,
    [s.source, s.externalId, s.url, s.title, s.body ?? null, s.city ?? null,
     s.province ?? null, s.budget ?? null, s.publishedAt ?? null, s.deadlineAt ?? null,
     s.channel ?? 'A', s.relevance ?? 0, s.isLocal ?? false, s.raw ?? null],
  );
  return r.rowCount > 0 ? r.rows[0].id : null;
}

export async function logRun({ source, ok, found = 0, inserted = 0, error = null }) {
  await q(
    `INSERT INTO source_runs (source, ok, found, inserted, error)
     VALUES ($1,$2,$3,$4,$5)`,
    [source, ok, found, inserted, error ? String(error).slice(0, 500) : null],
  );
}
