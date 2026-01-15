// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  // 🔥 核心：用這個 ID 來對應 Firebase
  firebaseUid: { type: String, required: true, unique: true, index: true },

  email: { type: String, required: true },
  name: { type: String },
  phone: { type: String }, // 羊肉麵店最重要：聯絡電話
  address: { type: String }, // 羊肉麵店最重要：預設地址

  isEmailVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);
