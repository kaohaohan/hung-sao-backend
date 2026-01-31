const { Queue } = require("bullmq");
const { redis } = require("./redis");

const orderQueue = new Queue("orderQueue", { connection: redis });

module.exports = { orderQueue };
