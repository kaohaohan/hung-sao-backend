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

  const { RtnCode, RtnMsg } = req.body;
  const orderId = req.body.CustomField1 || req.body.MerchantTradeNo;

  //避免綠界重覆處理
  const order = await orderService.getOrderById(orderId); // 用訂單號去 DB 查單

  if (!order) return res.send("1|OK"); // 查無此單，回 OK 讓綠界不要再吵了

  // 🔥 關鍵補強：冪等性檢查 (你原本漏了這段)
  // 如果這張單已經是 "paid" (付過了) 或 "failed" (處理過失敗了)
  // 代表這是重複的通知，直接忽略！
  if (order.paymentStatus === "paid" || order.paymentStatus === "failed") {
    console.log("⚠️ 重複通知，直接忽略");
    return res.send("1|OK");
  }
  const paymentInfo = {
    TradeNo: req.body.TradeNo,
    PaymentType: req.body.PaymentType,
    PaymentDate: req.body.PaymentDate,
    CheckMacValue: req.body.CheckMacValue,
  };

  const paymentMethod = mapPaymentMethod(req.body.PaymentType);

  if (RtnCode !== "1") {
    console.log(`❌ 付款失敗 (Code: ${RtnCode}): ${RtnMsg}`);

    // 呼叫 Service：它會負責「回補庫存」+「更新狀態為 failed」+「Transaction保護」
    try {
      await orderService.restoreStockForOrder(orderId);

      // 這裡不需要再呼叫 updateOrderStatus 了，因為上面已經做掉了
      // 但如果你需要紀錄 paymentInfo (失敗原因)，你可以稍微修改上面的 Service 讓它接受 paymentInfo
    } catch (err) {
      console.error("回補流程異常:", err);
      // 即使回補失敗，還是要回傳 1|OK 給綠界，不然它會一直重試
    }
    return res.send("1|OK"); // 🔥 記得要 return！不要往下跑
  }

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
