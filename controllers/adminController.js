// controllers/adminController.js

const {
  createShipment,
  downloadLabel,
} = require("../services/logisticsService");
const {
  getOrderById,
  shipOrder: updateShipStatus,
  Order,
} = require("../services/orderService");
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
    //1.取得 訂單的ID
    const { orderId } = req.params;

    // 2.去DB 查訂單  存在嗎？
    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ error: "找不到訂單" });
    }

    // 2. 檢查這單字 是否已付款
    if (order.paymentStatus !== "paid") {
      return res.status(400).json({ error: "訂單尚未付款，無法出貨" });
    }

    // 3. 檢查是否已出貨（避免重複出貨）
    if (order.logisticsStatus === "shipping") {
      return res.status(400).json({ error: "訂單已出貨" });
    }

    // 4. 取得店家指定的出貨日（可選，沒填就用明天）
    const customPickupDate = req.body.pickupDate || null;

    // 5. 呼叫黑貓 API（傳入 customPickupDate）
    const shipResult = await createShipment(order, customPickupDate);

    if (!shipResult.success) {
      return res
        .status(500)
        .json({ error: "黑貓下單失敗: " + shipResult.message });
    }

    // 6. 更新訂單狀態，並存入完整物流資訊
    // 傳入 orderId, tcatResult, 以及實際出貨日
    const updated = await updateShipStatus(
      orderId,
      shipResult,
      customPickupDate
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

/**
 * GET /api/admin/orders/:orderId/label
 * 下載託運單 PDF
 */
async function printLabel(req, res) {
  try {
    // 你的程式碼
    //取得 orderId（從 req.params）
    const { orderId } = req.params;
    //查訂單一樣 格式{ 欄位名: 值 }
    const order = await Order.findOne({ orderId });
    //取得 fileNo
    const fileNo = order.logisticsInfo.fileNo;
    //找不到回傳 錯誤
    if (!fileNo) {
      return res.status(404).json({ error: "找不到 fileNo" });
    }

    // 如果成功
    const pdfResult = await downloadLabel(fileNo);
    const trackingNumber = order.logisticsInfo.trackingNumber;

    if (pdfResult.success) {
      res.setHeader("Content-Type", "application/pdf"); // PDF 的 MIME type
      res.setHeader(
        "Content-Disposition",
        `inline; filename=${trackingNumber}.pdf`
      ); // 檔名
      res.send(pdfResult.data); // 送什麼資料給前端？
    } else {
      res.status(500).json({ error: "PDF 下載失敗: " + pdfResult.message });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
module.exports = {
  getOrders,
  shipOrder,
  printLabel,
};
