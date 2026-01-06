//統一錯誤格式
function sendError(res, status, message, code) {
  const payload = { message };
  if (code) payload.code = code;
  return res.status(status).json(payload);
}

function sendSuccess(res, data, message) {
  const payload = { message: message || "ok" };
  if (data !== undefined) payload.data = data;
  return res.json(payload);
}

module.exports = {
  sendError,
  sendSuccess,
};
