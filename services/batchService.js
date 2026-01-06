const { Batch } = require("../models/Batch");

async function createBatch(data) {
  const batch = new Batch(data);
  return await batch.save();
}

async function findBatchesByProduct(productId) {
  return await Batch.find({ productId, quantity: { $gt: 0 } }).sort({
    expDate: 1,
  });
}

module.exports = {
  createBatch,
  findBatchesByProduct,
};
