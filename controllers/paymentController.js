const ecpayHelper = require("../utils/ecpayHelper");

const orderService = require("../services/orderService");
async function receivePaymentNotify(req, res) {
  //1. 安全檢查 去檢查CheckMacValue
  // 檢查回傳跟綠界給的 CheckMacValue 不對
  const isValid = ecpayHelper.verifyCheckMacValue(
    req.body,
    process.env.ECPAY_HASH_KEY,
    process.env.ECPAY_HASH_IV
  );
  if (!isValid) {
    console.log(" 簽章驗證失敗！");
    return res.send("0|CheckMacValue Error");
  }

  console.log("簽章驗證通過！！！！！");
  //2. 檢查付款狀態
  // 1. 從 req.body 取出 RtnCode
  // 2. 判斷 RtnCode 是否等於 '1'
  // 3. 如果不是 '1'，打印"付款失敗"並
  const { RtnCode, RtnMsg } = req.body;

  if (RtnCode !== "1") {
    console.log("❌ 付款失敗:", RtnMsg);
    return res.send("1|OK"); // ← 失敗也要回傳 1|OK
  }

  //4. 更新訂單

  const orderId = req.body.MerchantTradeNo;
  const paymentInfo = {
    TradeNo: req.body.TradeNo, // 綠界交易編號
    PaymentType: req.body.PaymentType, // 付款方式
    PaymentDate: req.body.PaymentDate, // 付款時間
    CheckMacValue: req.body.CheckMacValue, // 驗證碼
  };

  // 依綠界 PaymentType 對應成我們的 paymentMethod，給前端好顯示
  const mapPaymentMethod = (paymentTypeRaw) => {
    if (!paymentTypeRaw) return null;
    const t = paymentTypeRaw.toLowerCase();
    if (t.startsWith("credit")) return "CREDIT_CARD"; // 含 Apple/Google Pay 也會帶 credit 開頭
    if (t.startsWith("atm")) return "ATM";
    if (t.startsWith("cvs")) return "CVS";
    if (t.startsWith("barcode")) return "BARCODE";
    return "UNKNOWN";
  };
  const paymentMethod = mapPaymentMethod(req.body.PaymentType);

  const updatedOrder = await orderService.updateOrderStatus(
    orderId, // 訂單號
    "paid", // 新狀態（注意引號！）
    paymentInfo, // 付款訊息物件
    paymentMethod // 付款方式 (自動對應)
  );
  console.log("✅ 訂單已經更新:", updatedOrder);
  res.send("1|OK");
}

module.exports = {
  receivePaymentNotify,
};
