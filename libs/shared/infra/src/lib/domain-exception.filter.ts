import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { DomainError } from '@bime-bazar/shared/kernel';
import type { Response } from 'express';
import { QueryFailedError } from 'typeorm';

const DOMAIN_ERROR_STATUS: Record<string, number> = {
    CUSTOMER_NOT_FOUND: HttpStatus.NOT_FOUND,
    PRODUCT_NOT_FOUND: HttpStatus.NOT_FOUND,
    ORDER_NOT_FOUND: HttpStatus.NOT_FOUND,
    ORDER_NOT_PAYABLE: HttpStatus.CONFLICT,
    ORDER_ACCESS_DENIED: HttpStatus.FORBIDDEN,
    INSUFFICIENT_FUNDS: HttpStatus.CONFLICT,
    CUSTOMER_EMAIL_TAKEN: HttpStatus.CONFLICT,
    INVALID_ORDER: HttpStatus.BAD_REQUEST,
    INVALID_PAYMENT_REQUEST: HttpStatus.BAD_REQUEST,
};

const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';
const PG_NOT_NULL_VIOLATION = '23502';
const PG_CHECK_VIOLATION = '23514';
const PG_INVALID_TEXT_REPRESENTATION = '22P02';

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(DomainExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const res = host.switchToHttp().getResponse<Response>();

        if (exception instanceof DomainError) {
            const status = DOMAIN_ERROR_STATUS[exception.code] ?? HttpStatus.UNPROCESSABLE_ENTITY;
            res.status(status).json({
                statusCode: status,
                code: exception.code,
                message: exception.message,
            });
            return;
        }

        if (exception instanceof HttpException) {
            const status = exception.getStatus();
            const payload = exception.getResponse();
            res.status(status).json(
                typeof payload === 'string'
                    ? { statusCode: status, message: payload }
                    : { statusCode: status, ...(payload as object) },
            );
            return;
        }

        if (exception instanceof QueryFailedError) {
            const pgCode = (exception as QueryFailedError & { driverError?: { code?: string } })
                .driverError?.code;

            if (pgCode === PG_UNIQUE_VIOLATION) {
                this.logger.warn(`unique constraint violation (not translated upstream): ${exception.message}`);
                res.status(HttpStatus.CONFLICT).json({
                    statusCode: HttpStatus.CONFLICT,
                    code: 'UNIQUE_CONSTRAINT',
                    message: 'A resource with the same unique identifier already exists.',
                });
                return;
            }

            if (
                pgCode === PG_FOREIGN_KEY_VIOLATION ||
                pgCode === PG_NOT_NULL_VIOLATION ||
                pgCode === PG_CHECK_VIOLATION
            ) {
                this.logger.warn(`constraint violation (${pgCode}): ${exception.message}`);
                res.status(HttpStatus.BAD_REQUEST).json({
                    statusCode: HttpStatus.BAD_REQUEST,
                    code: 'DB_CONSTRAINT',
                    message: 'Request violates a database constraint.',
                });
                return;
            }

            if (pgCode === PG_INVALID_TEXT_REPRESENTATION) {
                this.logger.warn(`invalid id format: ${exception.message}`);
                res.status(HttpStatus.BAD_REQUEST).json({
                    statusCode: HttpStatus.BAD_REQUEST,
                    code: 'INVALID_ID_FORMAT',
                    message: 'One or more id parameters are not in the expected format (UUID).',
                });
                return;
            }

            this.logger.error(`unhandled QueryFailedError (${pgCode}): ${exception.message}`, exception.stack);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
                code: 'DATABASE_ERROR',
                message: 'A database error occurred.',
            });
            return;
        }

        this.logger.error(
            'Unhandled exception',
            exception instanceof Error ? exception.stack : exception,
        );
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Internal server error',
        });
    }
}
