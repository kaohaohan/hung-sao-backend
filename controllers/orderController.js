const ecpayService = require("../services/ecpayService");
const orderService = require("../services/orderService");

async function createOrder(req, res) {
  try {
    // 1. 接收前端資料（items, customerInfo...其他的）
    const {
      items,
      customerInfo,
      pickupDate,
      deliveryDate,
      logisticsOptions = {
        type: "HOME",
        subType: "TCAT",
        temperature: "0003",
      },
    } = req.body;
    //1.5  檢查 customerInfo
    if (
      !customerInfo ||
      !customerInfo.name ||
      !customerInfo.phone ||
      !customerInfo.address
    ) {
      return res.status(400).json({ error: "Missing customer fields" });
    }
    //檢查 deliveryDate 是否合法日期。
    if (!deliveryDate || Number.isNaN(Date.parse(deliveryDate))) {
      return res.status(400).json({ error: "Invalid deliveryDate" });
    }

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
      orderId,
      amount: total,
      paymentStatus: "pending", // 改用 paymentStatus
      logisticsStatus: "unshipped", // 補上物流狀態
      items: itemsWithSubtotal,
      customerInfo,
      pickupDate,
      deliveryDate, // 新增
      logisticsOptions: logisticsOptions || {
        type: "HOME",
        subType: "TCAT",
        temperature: "0003",
      }, // 新增
    };

    // 5. 存入 MongoDB
    const savedOrder = await orderService.createOrder(orderData);
    console.log(" 訂單已存入資料庫:", savedOrder.orderId);

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
