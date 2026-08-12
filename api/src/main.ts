import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter, AllExceptionsFilter } from './common/filters/http-exception.filter';
import { DomainResolverService } from './common/services/domain-resolver.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const domainResolver = app.get(DomainResolverService);

  // Disable Express ETag to prevent stale 304 responses on multi-tenant data
  app.getHttpAdapter().getInstance().set('etag', false);

  // Security headers — relax CSP for Swagger UI inline scripts
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV !== 'production' ? false : undefined,
    }),
  );

  // Enable CORS — CORS_ORIGIN cubre las apps internas (ERP web, POS, panel
  // admin del e-commerce): lista separada por comas, "*" o vacío. Cualquier
  // otro origen se valida dinámicamente contra la tabla `Domain` — así un
  // dominio de tienda nuevo no requiere redeploy del API, solo una fila en
  // esa tabla + su DNS.
  const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000,http://localhost:5173,http://localhost:4321')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: async (origin, callback) => {
      // Permitir requests sin Origin (curl, server-to-server, healthchecks)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      try {
        if (await domainResolver.isKnownStorefrontOrigin(origin)) {
          return callback(null, true);
        }
      } catch {
        // fall through to reject below
      }
      return callback(new Error(`Origin not allowed by CORS: ${origin}`), false);
    },
    credentials: true,
  });

  // Global exception filters — prevent stack traces leaking to clients
  app.useGlobalFilters(new AllExceptionsFilter(), new HttpExceptionFilter());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // API prefix
  app.setGlobalPrefix('api');

  // Swagger — only in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('POS Admin API')
      .setDescription('POS Admin Panel API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`Server running on http://localhost:${port}`);
}
bootstrap();
