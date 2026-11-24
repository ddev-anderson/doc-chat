import { AppDataSource } from './data-source.js';

const action = process.argv[2] ?? 'run';

async function migrate(): Promise<void> {
  await AppDataSource.initialize();

  try {
    if (action === 'revert') {
      await AppDataSource.undoLastMigration();
      console.log('Reverted the last migration.');
      return;
    }

    const migrations = await AppDataSource.runMigrations();

    if (migrations.length === 0) {
      console.log('No pending migrations.');
      return;
    }

    for (const migration of migrations) {
      console.log(`Applied: ${migration.name}`);
    }
  } finally {
    await AppDataSource.destroy();
  }
}

if (action !== 'run' && action !== 'revert') {
  console.error('Usage: tsx src/database/migrate.ts [run|revert]');
  process.exitCode = 1;
} else {
  try {
    await migrate();
  } catch (error) {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  }
}
