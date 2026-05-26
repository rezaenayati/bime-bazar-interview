import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

@Module({
    imports: [
        PinoLoggerModule.forRoot({
            pinoHttp: {
                level: process.env['LOG_LEVEL'] || 'info',
                transport:
                    process.env['NODE_ENV'] === 'production'
                        ? undefined
                        : { target: 'pino-pretty', options: { singleLine: true, colorize: true } },
                autoLogging: true,
                customProps: (req) => ({ requestId: (req as { id?: string }).id }),
                genReqId: (req, res) => {
                    const incoming =
                        (req.headers['x-request-id'] as string | undefined) ?? undefined;
                    const id = incoming ?? crypto.randomUUID();
                    res.setHeader('x-request-id', id);
                    return id;
                },
            },
        }),
    ],
    exports: [PinoLoggerModule],
})
export class LoggerModule {}
