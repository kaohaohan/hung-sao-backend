const ecpayService = require("../services/ecpayService");
const orderService = require("../services/orderService");

async function createOrder(req, res) {
  try {
    // 1. 接收前端資料（items, customerInfo）
    const { items, customerInfo } = req.body;

    // 2. 計算總金額和每個商品的小計
    const itemsWithSubtotal = items.map((item) => ({
      ...item,
      subtotal: item.price * item.quantity,
    }));

    const total = itemsWithSubtotal.reduce(
      (sum, item) => sum + item.subtotal,
      0
    );

    // 3. 產生訂單編號
    const orderId = "ORD" + Date.now();

    // 4. 準備訂單數據
    const orderData = {
      orderId: orderId,
      amount: total,
      status: "pending", // 初始狀態：待付款
      items: itemsWithSubtotal,
      customerInfo: customerInfo,
    };

    // 5. 存入 MongoDB
    const savedOrder = await orderService.createOrder(orderData);
    console.log("✅ 訂單已存入資料庫:", savedOrder.orderId);

    // 6. 呼叫綠界創建付款
    const paymentData = {
      orderId: orderId,
      amount: total,
      description: "紅騷羊肉麵訂單",
      customerInfo: customerInfo,
      items: itemsWithSubtotal,
    };

    const html = await ecpayService.createPayment(paymentData);

    // 7. 回傳付款頁面 HTML
    res.send(html);
  } catch (error) {
    console.error("訂單建立失敗:", error);
    res.status(500).json({ error: "訂單建立失敗: " + error.message });
  }
}

module.exports = {
  createOrder,
};
