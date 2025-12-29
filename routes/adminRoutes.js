const express = require("express");
const router = express.Router();

const {
  getOrders,
  shipOrder,
  printLabel,
} = require("../controllers/adminController");

// GET /api/admin/orders - 查詢訂單列表
router.get("/orders", getOrders);

// POST /api/admin/orders/:orderId/ship - 出貨（呼叫黑貓 API）
router.post("/orders/:orderId/ship", shipOrder);

//下載托運
router.get("/orders/:orderId/label", printLabel);
module.exports = router;
