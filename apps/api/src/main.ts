import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { DomainExceptionFilter } from '@bime-bazar/shared/infra';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule, { bufferLogs: true });
    app.useLogger(app.get(Logger));
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            forbidNonWhitelisted: true,
        }),
    );
    app.useGlobalFilters(new DomainExceptionFilter());

    const config = new DocumentBuilder()
        .setTitle('Bime Bazar API')
        .setDescription(
            'Mini e-commerce backend showcasing DDD, CQRS, and a pluggable payment provider system.',
        )
        .setVersion('0.1.0')
        .addApiKey(
            {
                type: 'apiKey',
                name: 'X-Api-Key',
                in: 'header',
                description: 'Client application API key (matches an entry in API_KEYS env).',
            },
            'X-Api-Key',
        )
        .addApiKey(
            {
                type: 'apiKey',
                name: 'X-Customer-Id',
                in: 'header',
                description: 'Identifies the customer the request is acting on behalf of.',
            },
            'X-Customer-Id',
        )
        .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);

    const port = Number(process.env['PORT'] ?? '3000');
    await app.listen(port);
    app.get(Logger).log(`API listening on http://localhost:${port} (docs at /docs)`);
}

bootstrap().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Failed to bootstrap api', err);
    process.exit(1);
});
