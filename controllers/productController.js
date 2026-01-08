const { getProducts } = require("../services/productService");

async function getPublicProducts(req, res) {
  try {
    const products = await getProducts();
    const payload = products.map((product) => ({
      productId: product.productId,
      name: product.name,
      price: product.price,
      stock: product.stock,
    }));
    return res.json(payload);
  } catch (err) {
    return res
      .status(500)
      .json({ error: "無法取得商品列表: " + err.message });
  }
}

module.exports = { getPublicProducts };
