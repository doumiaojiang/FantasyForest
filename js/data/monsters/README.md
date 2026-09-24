# 怪物文件说明

每个怪物独占一个文件；名称、生命、奖励、六种攻击和怪物专属任务参数都在对应文件中修改。

- `tentacle.js`：触手怪
- `orc.js`：兽人
- `sorceress.js`：女巫
- `succubus.js`：魅魔
- `caravan-guard.js`：派克的车队看守
- `bandit-leader.js`：桥洞强盗头目
- `goblins.js`：哥布林
- `werewolf.js`：狼人
- `spirit-of-forest.js`：森林之灵

`monsters.js` 只负责建立注册表，`monsters/index.js` 负责汇总。不要把具体怪物重新写回这两个文件。

战斗回合、伤害结算和弹窗属于公共机制，仍保留在 `systems/battle.js` 与 `ui/battle.js`，避免每个怪物复制一套容易不同步的代码。
