const { Product } = require("../models/Product");
const { Order } = require("../models/Order");

//一鍋湯煮50包 紅騷or 當歸
const BATCH_SIZE = 50;
async function getProducts() {
  return await Product.find();
}

async function upsertProduct({ productId, name, price, stock }) {
  return await Product.findOneAndUpdate(
    { productId },
    { productId, name, price, stock },
    { upsert: true, new: true }
  );
}

async function updateStock(productId, stock, adjust) {
  let update;
  if (stock != null) {
    update = { $set: { stock } };
  } else if (adjust != null) {
    update = { $inc: { stock: adjust } };
  } else {
    return null;
  }

  return await Product.findOneAndUpdate({ productId }, update, { new: true });
}

async function getLowStockProducts(threshold = 10) {
  return await Product.find(
    { stock: { $lt: threshold } },
    { productId: 1, name: 1, stock: 1, _id: 0 }
  ).sort({ stock: 1 });
}

module.exports = {
  getProducts,
  upsertProduct,
  updateStock,
  getLowStockProducts,
};
