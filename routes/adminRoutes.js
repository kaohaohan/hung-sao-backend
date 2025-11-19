const express = require("express");
const router = express.Router();

const { getOrders } = require("../controllers/adminController");
const { shipOrder } = require("../controllers/adminShipController");

// GET /api/admin/orders
router.get("/api/admin/orders", getOrders); // 👉 新增：出貨 API
router.post("/api/admin/orders/:orderId/ship", shipOrder);


module.exports = router;
