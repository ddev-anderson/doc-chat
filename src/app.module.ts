import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatModule } from './chat/chat.module.js';
import { validateEnv } from './config/env.validation.js';
import { createTypeOrmOptions } from './database/typeorm.config.js';
import { DocumentsModule } from './documents/documents.module.js';
import { HealthController } from './health/health.controller.js';
import { HealthService } from './health/health.service.js';
import { RetrievalModule } from './retrieval/retrieval.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: createTypeOrmOptions,
    }),
    DocumentsModule,
    RetrievalModule,
    ChatModule,
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule {}
