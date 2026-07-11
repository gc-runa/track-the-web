const { Client } = require("pg");

(async () => {
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  const r = await c.query(
    `UPDATE sessions
     SET status = 'stopped',
         stats = jsonb_set(COALESCE(stats, '{}'::jsonb), '{status}', '"stopped"'),
         updated_at = NOW()
     RETURNING id, company, status`,
  );
  console.log(JSON.stringify(r.rows, null, 2));
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
