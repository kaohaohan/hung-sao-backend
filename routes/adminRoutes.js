const express = require("express");
const router = express.Router();

const {
  getOrders,
  shipOrder,
  printLabel,
  syncOrderStatus,
  getProducts,
  upsertProduct,
  updateStock,
  getProductionNeeds,
  askAdminAgent,
  verify,
} = require("../controllers/adminController");
//登入要驗證到api

router.get("/verify", verify);

// ==========================================
// 訂單管理
// ==========================================
router.get("/orders", getOrders);
router.post("/orders/:orderId/ship", shipOrder);
router.get("/orders/:orderId/label", printLabel);
router.post("/orders/sync-status", syncOrderStatus);

// ==========================================
// 商品管理
// ==========================================
router.get("/products", getProducts);
router.post("/products", upsertProduct);
router.patch("/products/:productId/stock", updateStock);
router.get("/production/needs", getProductionNeeds);

router.post("/agent/ask", askAdminAgent);
module.exports = router;
