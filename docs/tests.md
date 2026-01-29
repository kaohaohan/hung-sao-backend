# Tests Guide (Unit vs Integration)

Goal: keep the test set small, stable, and easy to understand.

## Quick run

- Run all tests: `npm test`
- Run a single file: `npx jest test/integration/orders.cod.int.test.js`

## Unit tests (fast, no real DB)

These tests mock external services and focus on one module at a time.

- `test/ecpay.test.js`
  - CheckMacValue generate/verify against ECPay SDK.
  - Detects tampering (invalid signature).
- `test/ecpayService.test.js`
  - `createPayment` passes correct fields (CustomField1 maps to original order).
  - ECPay SDK is mocked.
- `test/orderController.test.js`
  - Out-of-stock returns 409.
  - Retry payment creates a new MerchantTradeNo.
- `test/paymentWebhook.test.js`
  - Webhook idempotency (duplicate notify does not double-update).
  - Failed payment restores stock and does not mark paid.
- `test/adminShipOrder.test.js`
  - COD can ship when pending.
  - Credit-card pending cannot ship.
  - Logistics errors do not update ship status.

## Integration tests (API + DB)

These tests use `supertest` + `mongodb-memory-server` in replica set mode
because transactions require a replica set. No real Atlas is used.

- `test/integration/orders.cod.int.test.js`
  - Success case: stock = qty + buffer (just enough to order).
  - Fail case: stock = qty + buffer - 1 (should return 409).
  - Verifies order created, paymentStatus pending, stock deducted.
- `test/integration/payment-notify.int.test.js`
  - Success: pending -> paid, paymentInfo written.
  - Fail: pending -> failed, stock restored.
  - Invalid signature: returns `0|CheckMacValue Error`, DB unchanged.
  - Idempotency: duplicate success webhook does not re-apply side effects.

## CI

GitHub Actions runs `npm test` on push/PR, so unit + integration both run.
