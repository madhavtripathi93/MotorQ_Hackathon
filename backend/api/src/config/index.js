const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  UI_ORIGIN: z.string().default('http://localhost:5173'),
  JWT_SECRET: z.string().default('vista-super-secret-production-signing-key-32chars!'),
  DATABASE_URL: z.string().default('postgres://vista:vista_secret@localhost:5432/vista'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  KAFKA_BROKERS: z.string().default('localhost:9092'),
  CLICKHOUSE_URL: z.string().default('http://localhost:8123'),
  CLICKHOUSE_USER: z.string().default('default'),
  CLICKHOUSE_PASSWORD: z.string().default(''),
  TENANT_SALT: z.string().default('vista-tenant-location-salt-hash-entropy'),
  LOG_LEVEL: z.string().default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:', parsed.error.format());
  process.exit(1);
}

// Enforce production JWT secret validation
if (parsed.data.NODE_ENV === 'production') {
  const insecurePlaceholders = [
    'vista-super-secret-production-signing-key-32chars!',
    'replace_with_secure_random_production_secret_32chars_min',
    'secret',
    'changeme',
  ];
  if (!process.env.JWT_SECRET || insecurePlaceholders.includes(process.env.JWT_SECRET)) {
    console.error('❌ FATAL: Production startup refused. An explicit, high-entropy JWT_SECRET environment variable is required.');
    process.exit(1);
  }
}

module.exports = parsed.data;
