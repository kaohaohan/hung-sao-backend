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

async function getExpiringBatches(days = 7) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + days);

  return await Batch.find(
    { expDate: { $gte: start, $lt: end }, quantity: { $gt: 0 } },
    { productId: 1, expDate: 1, quantity: 1, _id: 0 }
  ).sort({ expDate: 1 });
}

module.exports = {
  createBatch,
  findBatchesByProduct,
  getExpiringBatches,
};
