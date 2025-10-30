const ecpayService = require("../services/ecpayService");

async function createOrder(req, res) {
  try {
    // 1. 接收前端資料（items, customerInfo） 怎樣的資料？ 一個陣列會有很多物件
    const { items, customerInfo } = req.body;

    // 2. 計算總金額
    const total = items.reduce((sum, item) => {
      return sum + item.price * item.quantity;
    }, 0);
    // 3. 產生訂單編號
    const orderId = "ORD" + Date.now();
    // 4. 呼叫 ecpayService.createPayment()
    //裝箱子
    const orderData = {
      orderId: orderId, // ← 裝進去
      amount: total, // ← 裝進去
      description: "紅騷羊肉麵訂單", // ← 裝進去
    };

    // 5. 呼叫service的createPayment 把 HTML 回傳給前端
    const html = await ecpayService.createPayment(orderData);
    res.send(html);
  } catch (error) {
    console.error("訂單建立失敗:", error);
    res.status(500).json({ error: "訂單建立失敗" });
  }
}
module.exports = {
  createOrder,
};
