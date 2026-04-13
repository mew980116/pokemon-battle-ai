// 项目入口文件

// 导入核心模块
const battleAI = require('./core/battleAI');
const moveData = require('./data/moveData');
const utils = require('./utils/helpers');

// 初始化应用
function init() {
  console.log('Pokemon Battle AI Initialized');
  
  // 加载招式数据
  moveData.loadMoveData();
  
  // 示例：测试战斗AI
  console.log('Testing Battle AI...');
  
  // 这里可以添加测试代码或启动逻辑
}

// 运行应用
init();

module.exports = {
  battleAI,
  moveData,
  utils
};