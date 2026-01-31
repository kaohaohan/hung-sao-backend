import "dotenv/config";
import mongoose from "mongoose";
import { redis } from "../queue/redis.js";
import { Product } from "../models/Product.js";

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const products = await Product.find({}, { productId: 1, stock: 1, _id: 0 });
  const safetyBuffer = Number(process.env.SAFETY_BUFFER || 0);

  for (const p of products) {
    const redisStock = p.stock;

    await redis.set(`stock:${p.productId}`, redisStock);
    console.log(`sync ${p.productId}: DB=${p.stock} -> Redis=${redisStock}`);
  }

  await mongoose.disconnect();
  await redis.quit();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
