// 招式数据管理
const fs = require('fs');
const path = require('path');

let moveData = [];

// 加载招式数据
function loadMoveData() {
  try {
    const dataPath = path.join(__dirname, '../../movedata.json');
    const data = fs.readFileSync(dataPath, 'utf8');
    moveData = JSON.parse(data);
    console.log(`Loaded ${moveData.length} moves`);
  } catch (error) {
    console.error('Error loading move data:', error);
  }
}

// 根据编号获取招式
function getMoveByNum(num) {
  return moveData.find(move => move.num === num);
}

// 根据名称获取招式
function getMoveByName(name) {
  return moveData.find(move => move.name === name);
}

// 获取所有招式
function getAllMoves() {
  return moveData;
}

module.exports = {
  loadMoveData,
  getMoveByNum,
  getMoveByName,
  getAllMoves
};