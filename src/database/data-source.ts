import { join } from 'node:path';
import dotenv from 'dotenv';
import { DataSource } from 'typeorm';

dotenv.config({ quiet: true });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: required('DB_USER'),
  password: required('DB_PASSWORD'),
  database: required('DB_NAME'),
  migrations: [join(import.meta.dirname, 'migrations/*{.ts,.js}')],
  synchronize: false,
  logging: ['error', 'migration'],
});
