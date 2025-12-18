const express = require("express");
const router = express.Router();

const { getOrders, shipOrder } = require("../controllers/adminController");

// GET /api/admin/orders
router.get("/api/admin/orders", getOrders); // 👉 出貨 API
router.post("/api/admin/orders/:orderId/ship", shipOrder); 

module.exports = router;
