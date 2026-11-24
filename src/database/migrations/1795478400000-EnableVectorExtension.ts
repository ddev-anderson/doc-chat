import type { MigrationInterface, QueryRunner } from 'typeorm';

export class EnableVectorExtension1795478400000 implements MigrationInterface {
  name = 'EnableVectorExtension1795478400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS vector');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP EXTENSION IF EXISTS vector');
  }
}
