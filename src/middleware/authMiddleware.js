const { sendError } = require("../../utils/response");

//「header 拿 token → 拆 Bearer → 驗 JWT → 掛 req → next()」
function checkAuth(req, res, next) {
  //要整串檢查 連Bearer都要有
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return sendError(res, 401, "Missing Authorization header", "AUTH_MISSING");
  }
  if (!authHeader.startsWith("Bearer ")) {
    return sendError(res, 401, "Invalid authorization format", "AUTH_BAD_FORMAT");
  }
  const token = authHeader.split(" ")[1];

  if (token !== process.env.ADMIN_TOKEN) {
    return sendError(res, 401, "Invalid token", "AUTH_INVALID");
  }
  return next();
}

module.exports = checkAuth;
