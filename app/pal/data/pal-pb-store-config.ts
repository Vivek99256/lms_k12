export type DbConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

let cachedConfig: DbConfig | null = null;

export function getDbConfig(): DbConfig {
  if (cachedConfig) return cachedConfig;

  const host = process.env.MYSQL_HOST || process.env.DB_HOST || '127.0.0.1';
  const port = Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306);
  const user = process.env.MYSQL_USER || process.env.DB_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '';
  const database = process.env.MYSQL_DATABASE || process.env.DB_NAME || 'lms_k12';

  cachedConfig = { host, port, user, password, database };
  return cachedConfig;
}
