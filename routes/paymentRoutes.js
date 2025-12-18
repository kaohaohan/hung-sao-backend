const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");

router.post(
  "/api/orders/payment-notify",
  paymentController.receivePaymentNotify
);

module.exports = router;
