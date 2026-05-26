import { timingSafeEqual } from 'node:crypto';
import {
    CanActivate,
    ExecutionContext,
    Injectable,
    Logger,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator';

const HEADER_NAME = 'x-api-key';

@Injectable()
export class ApiKeyGuard implements CanActivate {
    private readonly logger = new Logger(ApiKeyGuard.name);
    private readonly allowedKeyBuffers: Buffer[];

    constructor(
        private readonly config: ConfigService,
        private readonly reflector: Reflector,
    ) {
        const raw = this.config.get<string>('API_KEYS', '');
        this.allowedKeyBuffers = raw
            .split(',')
            .map((k) => k.trim())
            .filter(Boolean)
            .map((k) => Buffer.from(k, 'utf8'));

        if (this.allowedKeyBuffers.length === 0) {
            this.logger.warn(
                'API_KEYS env var is empty — every request will be rejected. Set API_KEYS=<comma-separated> to allow clients in.',
            );
        } else {
            this.logger.log(`ApiKeyGuard armed with ${this.allowedKeyBuffers.length} accepted key(s)`);
        }
    }

    canActivate(context: ExecutionContext): boolean {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) return true;

        const req = context.switchToHttp().getRequest<Request>();
        const provided = req.header(HEADER_NAME);

        if (!provided) {
            throw new UnauthorizedException(`Missing ${HEADER_NAME} header`);
        }
        if (this.allowedKeyBuffers.length === 0) {
            throw new UnauthorizedException('API key auth not configured on the server');
        }

        const providedBuf = Buffer.from(provided, 'utf8');
        const matched = this.allowedKeyBuffers.some((allowed) => safeEqual(providedBuf, allowed));

        if (!matched) {
            throw new UnauthorizedException('Invalid API key');
        }
        return true;
    }
}

function safeEqual(a: Buffer, b: Buffer): boolean {
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
}
