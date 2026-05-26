import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const CurrentCustomer = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (!req.customerId) {
        throw new Error('CurrentCustomer used without CustomerIdGuard');
    }
    return req.customerId;
});
