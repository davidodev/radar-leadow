import { pool, migrate, q } from './lib/db.js';
import { runRadar, heartbeat } from './jobs/radar.js';
import { auditUrl, renderReport } from './jobs/audit.js';
import { fetchCeidg, probePkd } from './sources/ceidg.js';
import { SEGMENTS } from './config/pkd.js';

const [, , cmd, ...args] = process.argv;

const cmds = {
  async migrate() { await migrate(); },

  async radar() {
    const n = await runRadar();
    console.log(`alertow wyslanych: ${n}`);
  },

  async heartbeat() { await heartbeat(); },

  async audit() {
    const url = args[0];
    if (!url) { console.error('uzycie: npm run audit -- example.pl'); process.exit(1); }
    const r = await auditUrl(url, { strategies: ['mobile'] });
    console.log(renderReport(r));
  },

  async 'ceidg:probe'() { await probePkd(); },

  async ceidg() {
    const days = Number(args[0] || 7);
    const rows = await fetchCeidg({ days });
    let n = 0;
    for (const c of rows) {
      const r = await q(
        `INSERT INTO companies (ceidg_id, nip, regon, name, city, province, pkd, pkd_version,
                                registered_at, channel, source, raw)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'C','ceidg',$10)
         ON CONFLICT (ceidg_id) DO NOTHING RETURNING id`,
        [c.ceidgId, c.nip, c.regon, c.name, c.city, c.province, c.pkd, c.pkdVersion,
         c.registeredAt, JSON.stringify({ ...c.raw, segment: c.segment, powiat: c.powiat,
                                          postcode: c.postcode, detailUrl: c.detailUrl })],
      );
      if (r.rowCount) n++;
    }
    console.log(`CEIDG: pobrano ${rows.length}, nowych firm ${n}`);
    const bySeg = {};
    for (const c of rows) bySeg[c.segment] = (bySeg[c.segment] || 0) + 1;
    for (const s of SEGMENTS) console.log(`  ${s.label}: ${bySeg[s.key] || 0}`);
  },

  async report() {
    const { rows } = await q(`
      SELECT source, count(*) AS n,
             count(*) FILTER (WHERE relevance >= 45) AS trafne,
             count(*) FILTER (WHERE status = 'answered') AS odpowiedziane
        FROM signals
       WHERE created_at > now() - interval '30 days'
       GROUP BY source ORDER BY n DESC`);
    console.table(rows);
    const { rows: top } = await q(`
      SELECT relevance, city, title, url FROM signals
       WHERE status = 'new' AND relevance >= 45
       ORDER BY relevance DESC, created_at DESC LIMIT 15`);
    console.table(top);
  },
};

const run = cmds[cmd];
if (!run) {
  console.log('komendy: migrate | radar | heartbeat | audit <url> | ceidg [dni] | ceidg:probe | report');
  process.exit(1);
}
run().catch((e) => { console.error(e); process.exitCode = 1; })
     .finally(() => pool.end());
