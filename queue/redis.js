const Redis = require("ioredis");

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
// BullMQ uses blocking Redis commands; ioredis must set maxRetriesPerRequest=null.
const redis = new Redis(redisUrl, { maxRetriesPerRequest: null });

module.exports = { redis };
