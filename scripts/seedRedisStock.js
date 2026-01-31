require("dotenv").config();
const { redis } = require("../queue/redis");

async function main() {
  await redis.set("stock:mutton_stew", 30);
  await redis.set("stock:angelica_mutton", 50);
  await redis.set("stock:duck_blood", 50);

  console.log("✅ Redis stock seeded");
  await redis.quit();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
