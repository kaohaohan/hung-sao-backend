const mongoose = require("mongoose");

// productId + expDate
const batchSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  mfgDate: { type: Date, required: true }, // 生產日期
  expDate: { type: Date, required: true },
  quantity: { type: Number, required: true, min: 0 },
});

// 常拿來查詢 + 排序的欄位
batchSchema.index({ productId: 1, expDate: 1 });

const Batch = mongoose.model("Batch", batchSchema);

module.exports = { Batch };
