# 欲缚镇剧情编辑位置

- 序章的普通剧情、对话、按钮文字和任务提示：`prologue.js`
- 车队看守的技能、束缚、狂暴和战败任务：`../monsters/caravan-guard.js`
- 强盗头目、喽啰、胜败任务与战败任务池：`../monsters/bandit-leader.js`
- 序章唯一公开入口、Stage、地图跳转和读档续播：`../../systems/prologue.js`
- 镇内与野外运行代码：`../../systems/prologue-town.js`、`../../systems/prologue-wilderness.js`（内部模块，不要从其他系统直接调用）

修改文字时优先编辑数据文件，不要再把序章对白写回 `camp.js`、酒馆、商店或通用战斗 UI。
敌人 ID、Stage 数字与存档字段属于兼容接口，不要只为改文案而重命名。
