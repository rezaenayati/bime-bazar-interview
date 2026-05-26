import { Payment } from '@bime-bazar/payment/domain';
import { PaymentDto } from './dto';

export function toPaymentDto(payment: Payment): PaymentDto {
    return {
        id: payment.id,
        orderId: payment.orderId,
        customerId: payment.customerId,
        idempotencyKey: payment.idempotencyKey,
        totalCents: payment.totalCents,
        status: payment.status,
        attempts: payment.attempts.map((a) => ({
            provider: a.props.provider,
            amountCents: a.props.amountCents,
            status: a.props.status,
            externalRef: a.props.externalRef,
            failureReason: a.props.failureReason,
            message: a.props.message,
        })),
    };
}
