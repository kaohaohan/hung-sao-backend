const { Product } = require("../models/Product");

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

module.exports = {
  getProducts,
  upsertProduct,
  updateStock,
};
