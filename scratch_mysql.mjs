import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection({
    host: '202.47.117.220',
    port: 3306,
    user: 'vivek_user',
    password: 'vivek@sql',
    database: 'vivek_erp',
    connectTimeout: 10000,
  });

  console.log('Connected to vivek_erp!');
  const [agents] = await conn.query('SELECT * FROM ai_agents');
  console.log('ai_agents:', JSON.stringify(agents, null, 2));

  const [hasState] = await conn.query("SHOW TABLES LIKE 'lms_catalogue_agent_state'");
  console.log('has lms_catalogue_agent_state:', hasState.length > 0);

  if (hasState.length) {
    const [state] = await conn.query('SELECT * FROM lms_catalogue_agent_state');
    console.log('lms_catalogue_agent_state:', JSON.stringify(state, null, 2));
  }

  const [hasTasks] = await conn.query("SHOW TABLES LIKE 'lms_catalogue_content_tasks'");
  console.log('has lms_catalogue_content_tasks:', hasTasks.length > 0);

  if (hasTasks.length) {
    const [tasks] = await conn.query('SELECT COUNT(*) as cnt FROM lms_catalogue_content_tasks');
    console.log('lms_catalogue_content_tasks count:', tasks[0].cnt);
  }

  const [runs] = await conn.query('SELECT COUNT(*) as cnt FROM ai_agent_runs');
  console.log('ai_agent_runs count:', runs[0].cnt);

  await conn.end();
}

main().catch(console.error);
