import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('chunks')
export class Chunk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'document_id', type: 'uuid' })
  documentId: string;

  @Column({ name: 'chunk_index', type: 'int' })
  chunkIndex: number;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'vector', length: 1024 })
  embedding: number[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
