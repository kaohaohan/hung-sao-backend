// src/ware/requestMetrics.js
const { httpRequestDuration } = require("../observability/metrics");

// 記錄 HTTP latency
function requestMetricsMiddleware(req, res, next) {
  const start = Date.now();

  res.on("finish", () => {
    const duration = (Date.now() - start) / 1000; // 秒

    httpRequestDuration.observe(
      {
        route: req.route ? req.route.path : req.path,
        method: req.method,
        status: res.statusCode,
      },
      duration
    );
  });

  next();
}

module.exports = requestMetricsMiddleware;
