import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface HealthStatus {
  status: 'ok';
  db: 'up';
  pgvector: string;
}

interface PgExtensionRow {
  extversion: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly dataSource: DataSource) {}

  async check(): Promise<HealthStatus> {
    try {
      await this.dataSource.query('SELECT 1');

      const rows = (await this.dataSource.query(
        "SELECT extversion FROM pg_extension WHERE extname = 'vector'",
      )) as PgExtensionRow[];

      const pgvectorVersion = rows[0]?.extversion;
      if (!pgvectorVersion) {
        throw new Error('pgvector extension is not installed');
      }

      return {
        status: 'ok',
        db: 'up',
        pgvector: pgvectorVersion,
      };
    } catch (error) {
      this.logger.error(
        'Health check failed',
        error instanceof Error ? error.stack : String(error),
      );

      throw new ServiceUnavailableException(
        'Database or pgvector is unavailable',
      );
    }
  }
}
