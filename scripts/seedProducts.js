import "dotenv/config";
import mongoose from "mongoose";
import { Product } from "../models/Product.js";

const products = [
  {
    productId: "mutton_stew",
    name: "紅騷羊肉真空包裝",
    price: 750,
    stock: 50,
  },
  {
    productId: "angelica_mutton",
    name: "當歸羊肉真空包裝",
    price: 750,
    stock: 10,
  },
  {
    productId: "duck_blood",
    name: "鴨血臭豆腐",
    price: 200,
    stock: 50,
  },
];

async function seed() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("❌ 錯誤: .env 中未設定 MONGO_URI");
    process.exit(1);
  }

  const dbName = uri.split("/").pop().split("?")[0];
  console.log(`🔌 準備連線到資料庫: [ ${dbName} ] ...`);

  try {
    await mongoose.connect(uri);
    console.log("✅ MongoDB 連線成功");

    await Product.deleteMany({});
    console.log("🧹 舊商品資料已清空");

    await Product.insertMany(products);
    console.log(`✅ 成功寫入 ${products.length} 筆測試商品！`);

    const items = await Product.find(
      {},
      { name: 1, stock: 1, productId: 1, _id: 0 },
    );
    console.table(items.map((i) => ({ id: i.productId, name: i.name, stock: i.stock })));
  } catch (error) {
    console.error("❌ 初始化失敗:", error);
  } finally {
    await mongoose.disconnect();
    console.log("👋 連線已關閉");
    process.exit();
  }
}

seed();
