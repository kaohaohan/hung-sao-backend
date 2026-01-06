const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  productId: { type: String, required: true, unique: true },
  name: String,
  price: Number,
  stock: { type: Number, default: 0 },
});

const Product = mongoose.model("Product", productSchema);

module.exports = { Product };
