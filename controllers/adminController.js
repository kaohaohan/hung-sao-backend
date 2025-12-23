// controllers/adminController.js

const {
  Order,
  shipOrder: shipOrderService,
} = require("../services/orderService");
const { createShipment } = require("../services/logisticsService");

/**
 * GET /api/admin/orders
 * 查詢訂單列表（可依狀態、時間篩選）
 */
async function getOrders(req, res) {
  try {
    const { paymentStatus, logisticsStatus, startDate, endDate } = req.query;

    let query = {};

    // 狀態過濾
    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }
    if (logisticsStatus) {
      query.logisticsStatus = logisticsStatus;
    }

    // 日期篩選（createdAt）
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const orders = await Order.find(query).sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: "無法取得訂單列表: " + error.message });
  }
}

/**
 * POST /api/admin/orders/:orderId/ship
 * 出貨：呼叫黑貓 API 拿託運單號，更新訂單狀態
 */
async function shipOrder(req, res) {
  try {
    const { orderId } = req.params;

    // 1. 先找訂單
    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ error: "找不到訂單" });
    }

    // 2. 檢查是否已付款
    if (order.paymentStatus !== "paid") {
      return res.status(400).json({ error: "訂單尚未付款，無法出貨" });
    }

    // 3. 檢查是否已出貨（避免重複出貨）
    if (order.logisticsStatus === "shipping") {
      return res.status(400).json({ error: "訂單已出貨" });
    }

    // 4. 呼叫黑貓 API
    const shipResult = await createShipment(order);

    if (!shipResult.success) {
      return res
        .status(500)
        .json({ error: "黑貓下單失敗: " + shipResult.message });
    }

    // 5. 更新訂單狀態，並存入完整物流資訊
    const logisticsInfo = {
      obtNumber: shipResult.obtNumber,
      fileNo: shipResult.fileNo,
      pdfLink: shipResult.pdfLink,
    };

    const updated = await shipOrderService(
      orderId,
      shipResult.obtNumber,
      logisticsInfo
    );

    res.json({
      message: "訂單已出貨",
      order: updated,
      trackingNumber: shipResult.obtNumber,
      pdfLink: shipResult.pdfLink,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getOrders,
  shipOrder,
};
