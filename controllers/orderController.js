const ecpayService = require("../services/ecpayService");
const orderService = require("../services/orderService");
const { calculateServerShipping } = require("../utils/shippingCalculator");
const { sendError } = require("../utils/response");
const { randomUUID } = require("crypto");
const { redis } = require("../queue/redis");
const { orderQueue } = require("../queue/orderQueue");
const { Order } = require("../models/Order");

async function createOrder(req, res) {
  try {
    // 1. 拿req.body（items, customerInfo...其他的）
    const {
      items,
      customerInfo,
      pickupDate,
      deliveryDate,

      paymentMethod, // 'CREDIT_CARD' 或 'COD' (貨到付款)
      shippingMethod, // 'HOME_COOL' (宅配冷藏)
      deliveryTime, // 'anytime', 'before_13', '14_18'
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
    //12/22 加上
    // 2. 計算商品小計 (Subtotal)
    const itemsWithSubtotal = items.map((item) => ({
      ...item,
      subtotal: item.price * item.quantity,
    }));

    // 商品總金額 (純商品)
    const subtotal = itemsWithSubtotal.reduce(
      (sum, item) => sum + item.subtotal,
      0,
    );

    // 3. 計算運費 (Shipping Fee)
    // 建議傳入 shippingMethod 變數，保持彈性
    const shippingFee = calculateServerShipping(
      items,
      shippingMethod || "HOME_COOL",
    );
    console.log(`💰 試算結果: 商品 $${subtotal} + 運費 $${shippingFee}`);
    // 4. 計算總金額 (Total Amount) 貨到付款加收30塊手續費
    const COD_FEE = 30;
    const isCOD = paymentMethod === "COD";
    const totalAmount = subtotal + shippingFee + (isCOD ? COD_FEE : 0);

    // 5. 產生訂單編號 (randomUID 避免高併發撞號)
    const orderId = `ORD-${randomUUID().slice(0, 8)}`;

    //修正 1: 定義 logisticsOptions 物件
    const logisticsOptions = {
      type: "HOME",
      subType: "TCAT",
      temperature: "0002", // 冷藏
      deliveryTime: deliveryTime || "anytime", // 存入客人選的時段
    };

    // 4. 準備 orderData要的資料
    const orderData = {
      orderId,
      subtotal: subtotal, // 商品小計
      shippingFee: shippingFee, // 運費
      amount: totalAmount, // 總金額

      paymentStatus: "pending",
      logisticsStatus: "unshipped",

      items: itemsWithSubtotal,
      customerInfo,
      pickupDate,
      deliveryDate,

      logisticsOptions: logisticsOptions,

      // 儲存使用者在下單時選的付款方式（CREDIT_CARD / COD）
      paymentMethod: paymentMethod || null,
      // paymentInfo 等綠界付款成功後，webhook 才會填入
      // 不要在這裡先填，因為用戶還沒真正付款
    };

    const safetyBuffer = Number(process.env.SAFETY_BUFFER || 0);
    const reserved = [];
    for (const item of orderData.items) {
      const key = `stock:${item.itemId}`;
      const qty = item.quantity;
      //資料完整性永遠都要一樣
      const remaining = await redis.decrby(key, qty);

      //檢查 剩下的庫存
      if (remaining < safetyBuffer) {
        // 先把這次扣的加回去
        await redis.incrby(key, qty);
        // 再把前面成功扣的全部加回去
        for (const r of reserved) {
          await redis.incrby(r.key, r.qty);
        }
        return res.status(409).json({ error: "庫存不足" });
      }
      //// 這個 item 預扣成功 像是 stock:mutton_stew = 29
      reserved.push({ key, qty });
    }
    // Step 1: 先建立訂單（狀態 queued）
    let order;
    try {
      order = await Order.create({
        ...orderData,
        orderStatus: "queued",
      });
    } catch (e) {
      // Order.create 失敗 → 把 Redis 庫存加(incrby)回去
      for (const r of reserved) await redis.incrby(r.key, r.qty);
      throw e;
    }
    // Step 2: 再入隊
    try {
      await orderQueue.add("createOrderJob", orderData);
    } catch (e) {
      for (const r of reserved) await redis.incrby(r.key, r.qty);
      // queue 失敗：把 queued 訂單標記 failed（避免卡 queued）
      await Order.updateOne(
        { orderId: orderData.orderId },
        { $set: { orderStatus: "failed" } },
      );
      throw e;
    }
    // Step 3: 回應 202
    console.log("reserved:", reserved);
    console.log("enqueue orderId:", orderData.orderId);

    return res.status(202).json({
      status: "queued",
      orderId: orderData.orderId,
      amount: orderData.amount,
    });

    // // 6. 存入 MongoDB
    // const savedOrder = await orderService.createOrderWithStock(orderData);
    // console.log(" 訂單已存入資料庫:", savedOrder.orderId);

    //改成Radis 預扣庫存 + Queue排隊 API快速回應 202 queued 後面由我們啟動好的worker 去寫入db

    // 6. 分流：信用卡 vs 貨到付款
    if (paymentMethod === "COD") {
      // 貨到付款上限 5000 元
      if (totalAmount > 5000) {
        return res.status(400).json({
          error: "貨到付款金額上限為 $5,000，請改用信用卡付款",
        });
      }
      // [情境 A] 貨到付款：直接回傳 JSON 成功
      return res.status(200).json({
        success: true,
        message: "訂單建立成功 (貨到付款)",
        orderId: orderId,
        amount: totalAmount,
      });
    } else {
      // [情境 B] 信用卡：呼叫綠界產生 HTML
      const paymentData = {
        orderId: orderId,
        amount: totalAmount, // 含運費總額
        description: "紅騷羊肉麵訂單",
        customerInfo: customerInfo,
        items: itemsWithSubtotal,
      };

      const html = await ecpayService.createPayment(paymentData);
      res.send(html);
    }
  } catch (error) {
    console.error(
      "createOrder error:",
      error?.name,
      error?.code,
      error?.message,
    );
    if (error.code === "BUSY" || error.message === "BUSY") {
      return res.status(503).json({ error: "系統忙碌，請稍後再試" });
    }
    if (error.message === "庫存不足") {
      return res.status(409).json({ error: "庫存不足" });
    }
    if (error.message === "MAX_QTY") {
      return sendError(res, 400, "單筆超過上限");
    }
    return res.status(500).json({ error: "訂單建立失敗: " + error.message });
  }
}

async function getOrderById(req, res) {
  try {
    const orderId = req.params.orderId;
    // 呼叫 Service 去 DB 撈資料
    const order = await orderService.getOrderById(orderId);

    if (!order) {
      return res.status(404).json({ error: "找不到該筆訂單" });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

function buildMerchantTradeNo(orderId) {
  const tail = String(orderId)
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(-6);
  const suffix = String(Date.now()).slice(-10);
  return `RT${tail}${suffix}`;
}

async function retryPayment(req, res) {
  try {
    const { orderId } = req.params;
    const order = await orderService.prepareOrderForRetry(orderId);

    if (!order) {
      return res.status(404).json({ error: "找不到該筆訂單" });
    }

    const paymentData = {
      merchantTradeNo: buildMerchantTradeNo(order.orderId),
      orderId: order.orderId,
      amount: order.amount,
      description: "紅騷羊肉麵訂單",
      customerInfo: order.customerInfo,
      items: order.items,
    };

    const html = await ecpayService.createPayment(paymentData);
    res.send(html);
  } catch (error) {
    if (error.message === "ORDER_PAID") {
      return res.status(400).json({ error: "訂單已付款，無需重新付款" });
    }
    if (error.message === "ORDER_COD") {
      return res.status(400).json({ error: "貨到付款無需重新付款" });
    }
    if (error.message === "庫存不足") {
      return res.status(409).json({ error: "庫存不足，無法重新付款" });
    }
    return res.status(500).json({ error: "重新付款失敗: " + error.message });
  }
}

module.exports = {
  createOrder,
  getOrderById,
  retryPayment,
};
