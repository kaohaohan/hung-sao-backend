const client = require("prom-client");

// Registry（所有 metrics 的集中地）
const register = new client.Registry();

// 全域標籤（非常重要）
register.setDefaultLabels({
  service: "hung-sao-backend",
  env: process.env.NODE_ENV || "development",
});

// 必須告訴 prom-client 用哪個 registry
client.collectDefaultMetrics({ register });

// HTTP Request Duration Histogram
const httpRequestDuration = new client.Histogram({
  name: "app_request_duration_seconds",
  help: "HTTP request latency",
  labelNames: ["method", "route", "status"],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});

register.registerMetric(httpRequestDuration);

// 錯誤統計
const errorCounter = new client.Counter({
  name: "app_errors_total",
  help: "Count of errors",
  
  labelNames: ["status", "route", "error_type"],
});

register.registerMetric(errorCounter);

module.exports = {
  register,
  httpRequestDuration,
  errorCounter,
};
