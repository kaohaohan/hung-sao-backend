# 測試指南（Unit vs Integration）

目的：測試要小、穩、好懂。

## 快速執行

- 跑全部：`npm test`
- 跑單一檔案：`npx jest test/integration/orders.cod.int.test.js`

## Unit tests（快、無真實 DB）

這些測試用 mock 取代外部服務，只驗證單一模組邏輯。

- `test/ecpay.test.js`
  - 產生/驗證 CheckMacValue 是否對齊 ECPay SDK。
  - 驗簽被竄改會失敗。
- `test/ecpayService.test.js`
  - `createPayment` 傳參數正確（CustomField1 對應原訂單）。
  - ECPay SDK 走 mock。
- `test/orderController.test.js`
  - 庫存不足回 409。
  - 重新付款會產生新的 MerchantTradeNo。
- `test/paymentWebhook.test.js`
  - Webhook 冪等（重送不重複更新）。
  - 付款失敗會回補庫存且不標記 paid。
- `test/adminShipOrder.test.js`
  - COD 訂單 pending 仍可出貨。
  - 信用卡未付款不可出貨。
  - 物流錯誤不更新出貨狀態。

## Integration tests（API + DB）

使用 `supertest` + `mongodb-memory-server`（replica set 模式），
因為 transaction 需要 replica set。沒有用到真實 Atlas。

- `test/integration/orders.cod.int.test.js`
  - 成功：stock = qty + buffer（剛好可下單）。
  - 失敗：stock = qty + buffer - 1（回 409）。
  - 驗證訂單建立、paymentStatus pending、庫存扣減。
- `test/integration/payment-notify.int.test.js`
  - 成功：pending -> paid，寫入 paymentInfo。
  - 失敗：pending -> failed，庫存回補。
  - 驗簽失敗：回 `0|CheckMacValue Error`，DB 不變。
  - 冪等性：重送成功 webhook 不會重複副作用。

## CI

GitHub Actions 會跑 `npm test`，所以 unit + integration 都會跑到。
