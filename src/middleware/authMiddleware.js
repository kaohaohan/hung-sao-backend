const admin = require("../../lib/firebaseAdmin");
const { sendError } = require("../../utils/response");

//驗證要拆分 A:驗證一般會員驗證 B: 管理員後台驗證看ADMIN_UID
async function checkAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return sendError(res, 401, "Missing Authorization header", "AUTH_MISSING");
  if (!authHeader.startsWith("Bearer "))
    return sendError(
      res,
      401,
      "Invalid authorization format",
      "AUTH_BAD_FORMAT"
    );

  const token = authHeader.split(" ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    if (!process.env.ADMIN_UIDS) {
      return sendError(res, 500, "ADMIN_UIDS is not set", "AUTH_CONFIG");
    }
    //用我要求的帳密.UID去對這個登入進來的UID
    const adminUids = process.env.ADMIN_UIDS.split(",");
    if (!adminUids.includes(decodedToken.uid)) {
      return sendError(
        res,
        403,
        "Access denied: Not an admin",
        "AUTH_NO_PERMISSION"
      );
    }
    req.user = decodedToken;
    return next();
  } catch (error) {
    console.log(error.code, error.message);
    return sendError(res, 401, "Invalid or expired token", "AUTH_INVALID");
  }
}

async function checkAuthMember(req, res, next) {
  //Middleware
  //前端(註冊)-> 回傳ID token -> "驗證token"!
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return sendError(res, 401, "Missing Authorization header", "AUTH_MISSING");
  if (!authHeader.startsWith("Bearer "))
    return sendError(
      res,
      401,
      "Invalid authorization format",
      "AUTH_BAD_FORMAT"
    );

  const token = authHeader.split(" ")[1];
  try {
    //用firebase verifyIdToken驗證
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    return next();
  } catch (error) {
    console.log(error.code, error.message);
    return sendError(res, 401, "Invalid or expired token", "AUTH_INVALID");
  }
}
module.exports = { checkAuth, checkAuthMember };
