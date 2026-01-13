const admin = require("../../lib/firebaseAdmin");
const { sendError } = require("../../utils/response");

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

module.exports = checkAuth;
