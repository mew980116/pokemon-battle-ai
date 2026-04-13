// 工具函数

// 示例：计算伤害
function calculateDamage(attacker, defender, move) {
  // 伤害计算逻辑
}

// 示例：获取随机数
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 示例：格式化输出
function formatOutput(data) {
  return JSON.stringify(data, null, 2);
}

module.exports = {
  calculateDamage,
  getRandomInt,
  formatOutput
};