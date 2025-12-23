// 注意：後端要用 CommonJS 語法 (module.exports)

const PRODUCT_VOLUME = {
  // 為了安全，這裡的 key 建議跟資料庫的 itemId 一致
  mutton_stew: 2, // 紅騷羊肉
  angelica_mutton: 2, // 當歸羊肉
  duck_blood: 1, // 鴨血臭豆腐
};

const DEFAULT_VOLUME = 2;

module.exports = {
  PRODUCT_VOLUME,
  DEFAULT_VOLUME,
};
