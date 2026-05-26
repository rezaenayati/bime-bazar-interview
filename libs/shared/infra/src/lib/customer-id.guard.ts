import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

declare module 'express' {
    interface Request {
        customerId?: string;
    }
}

@Injectable()
export class CustomerIdGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const req = context.switchToHttp().getRequest<Request>();
        const customerId = req.header('x-customer-id');
        if (!customerId) {
            throw new UnauthorizedException(
                'Missing X-Customer-Id header. Create a customer first via POST /customers.',
            );
        }
        req.customerId = customerId;
        return true;
    }
}
