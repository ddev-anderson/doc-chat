import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDocuments1795478400001 implements MigrationInterface {
  name = 'CreateDocuments1795478400001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "documents" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "filename" text NOT NULL,
        "mime_type" text NOT NULL,
        "content" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_documents_id" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "documents"');
  }
}
