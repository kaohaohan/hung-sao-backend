//ecpayService 的工作：
/**
 * 建立綠界付款
 * @param {Object} orderData - 訂單資料
 * @param {string} orderData.orderId - 訂單編號
 * @param {number} orderData.amount - 金額
 * @param {string} orderData.description - 商品描述
 * @returns {string} 付款表單 HTML
 */
//. 回傳「付款表單 HTML」或「付款 URL」
// ============================================
// 綠界金流服務
// 負責：產生付款表單、驗證簽章
// ============================================

const ecpay_payment = require("ecpay_aio_nodejs");
// const { generateOrderId } = require("../utils/helpers"); // 等下會建立

// 🎓 從環境變數讀取的設定 白話 設定身份證
//有點像mongo 把資料庫連線key
const options = {
  OperationMode: "Test",
  MercProfile: {
    MerchantID: process.env.ECPAY_MERCHANT_ID,
    HashKey: process.env.ECPAY_HASH_KEY,
    HashIV: process.env.ECPAY_HASH_IV,
  },
  IgnorePayment: [],
  IsProjectContractor: false,
};

async function createPayment(orderData) {
  const moment = require("moment");
  const dateStr = moment().format("YYYY/MM/DD HH:mm:ss");
  // Step 1: 準備參數
  const base_param = {
    MerchantTradeNo: orderData.orderId,
    MerchantTradeDate: dateStr,
    TotalAmount: String(orderData.amount),
    TradeDesc: "Order",
    ItemName: "Product",
    ReturnURL: process.env.ECPAY_WEBHOOK_URL, // Webhook（後端）
    ClientBackURL: process.env.ECPAY_FRONTEND_RETURN_URL, // 前端返回頁面
    ChoosePayment: "ALL",
    PaymentType: "aio", // ← 加上這行！
    EncryptType: 1,
  };

  // Step 2: 呼叫 SDK（只傳一個參數）
  const create = new ecpay_payment(options);
  const html = create.payment_client.aio_check_out_all(base_param);

  // TODO: Step 3 - 回傳結果
  return html;
}

module.exports = {
  createPayment,
};
