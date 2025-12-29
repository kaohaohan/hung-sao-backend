// utils/logisticsHelper.js

/**
 * 根據商品數量估算包裹尺寸 (這只是個範例，你要依照你的羊肉麵包裝大小調整)
 * @param {Array} items - 訂單商品陣列
 * @returns {string} 黑貓規格代碼 (0001~0004)
 */
function estimatePackageSize(items) {
  // 算出總件數 (假設每包羊肉麵體積差不多)
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  // 假設邏輯：
  // 1-2 包 -> 60cm (0001)
  // 3-6 包 -> 90cm (0002)
  // 7-12 包 -> 120cm (0003)
  // 12 包以上 -> 150cm (0004)

  if (totalQuantity <= 2) return "0001";
  if (totalQuantity <= 6) return "0002";
  if (totalQuantity <= 12) return "0003";
  return "0004";
}

module.exports = { estimatePackageSize };
