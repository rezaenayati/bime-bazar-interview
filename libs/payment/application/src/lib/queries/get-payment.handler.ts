import { Inject, NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PAYMENT_REPOSITORY, PaymentRepository } from '@bime-bazar/payment/domain';
import { GetPaymentQuery } from './get-payment.query';
import { PaymentDto } from '../dto';
import { toPaymentDto } from '../payment-mapper';

@QueryHandler(GetPaymentQuery)
export class GetPaymentHandler implements IQueryHandler<GetPaymentQuery, PaymentDto> {
    constructor(@Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository) {}

    async execute(query: GetPaymentQuery): Promise<PaymentDto> {
        const payment = await this.payments.findById(query.paymentId);
        if (!payment) throw new NotFoundException(`Payment ${query.paymentId} not found`);
        return toPaymentDto(payment);
    }
}
