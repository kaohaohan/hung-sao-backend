require("dotenv").config();
const mongoose = require("mongoose");
const { Worker } = require("bullmq");
const { redis } = require("../queue/redis");
const { Order } = require("../models/Order");
const { Product } = require("../models/Product");

async function connectMongo() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Worker connected to MongoDB");
}

async function startWorker() {
  await connectMongo();

  const worker = new Worker(
    "orderQueue",
    async (job) => {
      const orderData = job.data;

      try {
        // // 測試用：設 FORCE_FAIL_WORKER=1 可以模擬失敗
        // if (process.env.FORCE_FAIL_WORKER === "1") {
        //   throw new Error("FORCE_FAIL");
        // }

        //鎖住
        const claimed = await Order.findOneAndUpdate(
          { orderId: orderData.orderId, orderStatus: "queued" }, // 找這筆訂單，而且要是 queued
          { $set: { orderStatus: "processing" } }, // 把它改成 processing
          { new: true }, // 回傳更新後的文件
        );

        if (!claimed) {
          // 找不到 = 別人已經處理過了（可能是 processing/done/failed）
          return; // 直接結束，不做事
        }
        //// 開一個 session 操作成功或全部失敗
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
          for (const item of orderData.items || []) {
            const result = await Product.updateOne(
              { productId: item.itemId, stock: { $gte: item.quantity } }, // 找商品，庫存要 >= 購買數量
              { $inc: { stock: -item.quantity } }, // 扣庫存
              { session }, // 在 transaction 內
            );
            if (result.modifiedCount === 0) {
              // 沒扣到 = 庫存不夠
              throw new Error("DB_STOCK_NOT_ENOUGH");
            }
          }
          //標記成功的 orderStatus -> done
          await Order.updateOne(
            { orderId: orderData.orderId },
            { $set: { orderStatus: "done" } },
            { session },
          );
          // 全部成功，一起寫入 DB
          await session.commitTransaction();
        } catch (e) {
          await session.abortTransaction();
          throw e; // 讓外層 catch 去做 Redis 回補 + failed
        } finally {
          session.endSession();
        }

        return { orderId: orderData.orderId };
      } catch (err) {
        //任何地方出錯：
        //1. Redis 庫存加回去（因為 API 扣過了）
        //2. 訂單標記 failed
        //3. 告訴 BullMQ「這個 Job 失敗了」

        for (const item of orderData.items || []) {
          await redis.incrby(`stock:${item.itemId}`, item.quantity);
        }

        // 標記失敗
        await Order.updateOne(
          { orderId: orderData.orderId },
          { $set: { orderStatus: "failed" } },
        );
        // 讓 BullMQ 知道 Job 失敗
        throw err;
      }
    },
    { connection: redis },
  );
  //監聽event
  worker.on("completed", (job) => {
    console.log("✅ Job done", job.id);
  });

  worker.on("failed", (job, err) => {
    console.error("❌ Job failed", job?.id, err?.message);
  });
}

startWorker().catch((err) => {
  console.error(err);
  process.exit(1); // 啟動失敗就結束程式
});
