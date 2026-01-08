const express = require("express");
const router = express.Router();

const { getPublicProducts } = require("../controllers/productController");

router.get("/api/products", getPublicProducts);

module.exports = router;
