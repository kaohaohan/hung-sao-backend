const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");

router.post("/api/orders", orderController.createOrder);
router.get("/api/orders/:orderId", orderController.getOrderById);
router.post(
  "/api/orders/:orderId/retry-payment",
  orderController.retryPayment
);
module.exports = router;
