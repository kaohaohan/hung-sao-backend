const express = require("express");
const router = express.Router();

const { getStock } = require("../controllers/monitorController");

router.get("/api/monitor/stock", getStock);

module.exports = router;
