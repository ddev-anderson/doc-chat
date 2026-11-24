import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateChunks1795478400002 implements MigrationInterface {
  name = 'CreateChunks1795478400002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "chunks" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "document_id" uuid NOT NULL,
        "chunk_index" int NOT NULL,
        "content" text NOT NULL,
        "embedding" vector(1024) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chunks_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_chunks_document_chunk" UNIQUE ("document_id", "chunk_index"),
        CONSTRAINT "FK_chunks_document" FOREIGN KEY ("document_id")
          REFERENCES "documents"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_chunks_document_id" ON "chunks" ("document_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "chunks"');
  }
}
