# 架构重构计划

目标：在不破坏现有存档和剧情流程的前提下，解决全局状态扁平化、迁移函数膨胀、系统循环依赖以及 `main.js` 职责过多的问题。

## 原则

- 存档中的玩法状态由对应领域拥有，UI 不作为状态源。
- 每次只迁移一个可验证的领域，旧字段至少保留一个版本的兼容入口。
- EventBus 只发布已经发生的领域事件；查询与命令使用明确接口。
- 依赖方向固定为：UI / 流程控制 → 应用服务 → 领域系统 → State。
- 每个阶段都必须通过旧档迁移、序列化往返、语法检查和浏览器冒烟测试。

## 阶段

1. **存档 v3 与领域骨架**
   - 建立 `state-schema.js`。
   - 首批迁移 `systems.glory` 与 `systems.prison`。
   - 旧 `_glory*`、`_prison*` 字段改为不可序列化兼容别名。
   - 增加迁移和序列化测试。
2. **迁移其余领域状态**
   - tavern / prostitute / mercenary。
   - restraints / contracts。
   - town / guard / pillory / reputation。
   - pStory / commission。
3. **拆分迁移器**
   - 将 `migrate()` 拆为版本迁移和领域校验器。
   - 每个迁移器保持幂等，可重复执行。
4. **建立 GameFlow**
   - 统一处理营地、移动、遭遇、战斗开始与战斗结算。
   - 移除 Camp、Commission、Battle 之间的反向回调。
5. **拆分 main.js**
   - bootstrap、title、settings、debug、movement-controller、encounter-controller、recovery。
6. **收紧接口**
   - 兼容别名至少保留一个存档版本，但不参与序列化；下个存档大版本再删除。
   - 记录并检查跨层依赖。

## 当前进度

- [x] `camp.js` 按领域拆分。
- [x] 酒馆按大厅、队长、NPC、工作拆分。
- [x] 存档 v3：glory / prison（嵌套存储与旧字段兼容层）。
- [x] 其余领域状态迁移（含 pStory / commission）。
- [x] 迁移器拆分为核心、妖缚、城镇、酒馆、战斗与装备阶段。
- [x] GameFlow：集中战斗请求、营地导航与剧情战结果分派。
- [x] `main.js` 拆分：设置/调试、死亡恢复/Boss 结局、移动与遭遇控制均已独立；主入口只保留启动、标题页与读档协调。
- [x] 收紧接口：移除 Camp 的剧情战兼容转发，Commission/Camp/Battle 通过 GameFlow 单向协调；v3 旧字段别名按兼容原则保留但不写入存档。
- [x] 回归验证：全量脚本语法、旧档迁移幂等、序列化往返与浏览器读档冒烟测试。
