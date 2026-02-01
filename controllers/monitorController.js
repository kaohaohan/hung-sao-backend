const { Product } = require("../models/Product");

async function getStock(req, res) {
  try {
    const { productId } = req.query;
    const safetyBuffer = Number(process.env.SAFETY_BUFFER || 0);

    if (productId) {
      const product = await Product.findOne(
        { productId },
        { _id: 0, productId: 1, name: 1, stock: 1 }
      );
      if (!product) {
        return res.status(404).json({ error: "找不到商品" });
      }

      return res.json({
        ...product.toObject(),
        safetyBuffer,
        available: Math.max(0, product.stock - safetyBuffer),
        timestamp: new Date().toISOString(),
      });
    }

    const items = await Product.find(
      {},
      { _id: 0, productId: 1, name: 1, stock: 1 }
    );
    const withAvailable = items.map((item) => ({
      ...item.toObject(),
      safetyBuffer,
      available: Math.max(0, item.stock - safetyBuffer),
    }));

    return res.json({
      items: withAvailable,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

module.exports = { getStock };
