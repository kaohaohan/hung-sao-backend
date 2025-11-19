// controllers/adminController.js

const { Order } = require("../services/orderService");
const { shipOrder: shipOrderService } = require("../services/orderService");

/**
 * GET /api/admin/orders
 * 查詢訂單列表（可依狀態、時間篩選）
 */
async function getOrders(req, res) {
  try {
    const { status, startDate, endDate } = req.query;

    let query = {};

    // 狀態過濾
    if (status) {
      query.status = status;
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
 * 出貨（更新訂單狀態 + trackingNumber）
 */
async function shipOrder(req, res) {
  try {
    const { trackingNumber } = req.body;

    const { orderId } = req.params;

    const updated = await shipOrderService(orderId, trackingNumber);

    //找不到回傳404
    if (!updated) {
      return res.status(404).json({ error: "找不到訂單" });
    }
    res.json({
      message: "訂單已出貨",
      order: updated,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getOrders,
  shipOrder,
};
