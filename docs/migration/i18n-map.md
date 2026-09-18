# 旧 key → 新命名空间映射表（i18n-map）

> T00.1 建格式；T00.8 填充公共/菜单/认证/错误映射并建立四语言基座；T00.9 冻结各页命名空间/文件归属终版；各页面任务在 `tasks/<ID>.md` 提供本页分片，统筹者合并。
> 旧资源：`C:\code\dd\src\locales\<lang>.json`（顶层 key 数 zh-CN/en-US 2092、zh-TW/ja-JP/ko-KR 1478，2026-09-17 实测与规格 18.1 一致）。
> 目标规范：中文 key 即文案（`keySeparator/nsSeparator: false`），按业务命名空间懒加载；五语言目录 `src/i18n/locales/<语言>/<命名空间>.ts`。

## 语言持久化迁移（T00.8）

| 旧来源 | 新来源 | 行为 |
| --- | --- | --- |
| localStorage `umi_locale`（Umi 同源） | localStorage `apex-admin:lang` | 首次读取时迁移：写入新 key、删除旧 key，一次迁移不留双源；`normalizeLanguage` 归一化（繁中变体 zh-tw/zh-hk/zh-mo/zh-hant* → zh-TW 精确保留；en* → en-US；ja* → ja-JP；ko* → ko-KR；其余回退 zh-CN） |

## 命名空间归属（T00.8 更新）

| 命名空间 | 归属 | 四语言基座（zh-TW/ja-JP/ko-KR） |
| --- | --- | --- |
| common / menu / auth / error | T00 统筹 | T00.8 全量交付 |
| map | T00（共享地图能力） | T00.8 全量交付 |
| apexTable（非 i18next ns） | T00.5 | T00.5 全量交付（locale 包） |
| 页面私有（profile/system/orderRecord/dashboard 等） | 对应页面任务 | 未交付，懒加载表查无返回空资源自动回退简中（i18n-missing.md 登记） |

## 各页命名空间/文件归属终版（T00.9 冻结）

命名规则：页面私有命名空间 = 目标路由 path 核心段 camelCase；懒加载分片放 `src/i18n/locales/{zh-CN,en-US,zh-TW,ja-JP,ko-KR}/<命名空间>.ts`（zh-CN 目录仅当 key≠value 时才需要文件），并在 `src/i18n/i18n.ts` 对应语言的懒加载表登记。业务域目录（features/services/types）与命名空间同名 camelCase；标注「沿用」者使用现有目录，不制造平行实现。三处例外以业务命名并注明理由。

| 任务 | 目标入口 | 命名空间 | 前端文件域（features/services/types） |
| --- | --- | --- | --- |
| P01 登录 | /auth/login | auth（T00 基座） | 沿用 features/auth + services/auth |
| P02 软件授权 | /authorize-ingress | **license-activation**（P02 已按任务卡业务命名修正：激活业务组件与语言分片供 P29 复用，按路由段命名不适合跨页语义；三处例外规则同理） | license-activation |
| P03 任务管理 | /order-record | orderRecord（已声明） | 沿用 features/order-record + services/order-record + types/order-record |
| P04 车辆分组 | vehicle-group | vehicleGroup | vehicleGroup |
| P05 车辆列表 | vehicle-display | vehicleList | vehicleList |
| P06 载具类型 | vehicle-type | **carrierType**（路径段 vehicle-type 会与车辆业务混淆，按真实载具业务命名） | carrierType |
| P07 节点映射 | node-mapping | nodeMapping | nodeMapping |
| P08 告警码管理 | alarm-code | alarmCode | alarmCode |
| P09 地图列表 | map-list | mapList | mapList |
| P10 地图关联 | cross-maps | crossMaps | crossMaps |
| P11 多地图点边组合 | point-edge-combination | pointEdgeCombination | pointEdgeCombination |
| P12 地图推送记录 | map-push-records | mapPushRecord | mapPushRecord |
| P13 调度中心 | /dispatch-hub | dispatchHub | dispatchHub |
| P14 电梯 | elevator | elevator | elevator |
| P15 自动门 | auto-door | autoDoor | autoDoor |
| P16 充电桩 | charge-pile | chargePile | chargePile |
| P17 交通灯 | traffic-lights | trafficLight | trafficLight |
| P18 风淋门 | air-shower-door | airShowerDoor | airShowerDoor |
| P19 三方交管 | tri-traffic | triTraffic | triTraffic |
| P20 任务工艺 | mission-create | missionCreate | missionCreate |
| P21 工艺管理 | mission-flow | missionFlow | missionFlow |
| P22 避障模板 | obstacle-avoidance | obstacleAvoidance | obstacleAvoidance |
| P23 车辆动作 | agv-action | agvAction | agvAction |
| P24 动作分组 | agv-action-group | agvActionGroup | agvActionGroup |
| P25 版本管理 | version-control | versionControl | versionControl |
| P26 系统日志 | system-log | systemLog | systemLog |
| P27 系统设置 | system-setting | systemSetting | systemSetting |
| P28 操作日志 | operation-log | operationLog | operationLog |
| P29 软件信息 | software-information | softwareInformation | softwareInformation |
| P30 数据库备份 | database-backup | databaseBackup | databaseBackup |
| P31 用户管理 | user-management | userManagement | 沿用 pages/system/user + services/system/user |
| P32 角色管理 | role-management | roleManagement | 沿用 pages/system/role + services/system/role |
| P33 任务统计 | order-statistics | orderStatistics | orderStatistics |
| P34 合并首页/实时看板 | /dashboard（+旧 dashboard-realtime 重定向） | dashboard（已声明） | 沿用 pages/dashboard + features/dashboard + services/dashboard + types/dashboard |
| P35 任务统计报表 | dashboard-task | **taskReport**（避免与 P34 dashboard 命名空间混淆，按业务命名） | taskReport |
| P36 故障告警 | dashboard-fault | **faultAlarm**（同上） | faultAlarm |
| P37 车辆状态统计 | vehicle-status | vehicleStatus | vehicleStatus |
| P38 任务详情 | /order-info | orderInfo | orderInfo |
| P39 车辆详情 | /vehicle-info | vehicleInfo | vehicleInfo |
| P40 服务器资源 | /server-resource（别名 server-resource-monitor 同实现） | serverResource | serverResource |
| P41 无权限页 | /no-permission | **access-denied**（已交付；P41 按任务卡独立分片，覆盖冻结时「复用 common/error」的盘点） | 沿用 pages/un-access |
| P42 兜底错误页 | /404、/500 | **error**（已交付；沿用 T00 基座分片并入基座常载 BASE_NAMESPACES；旧 404 页 key「抱歉，您访问的页面不存在/首页」迁入，en 旧真译沿用，移除无消费模板 key） | 沿用 pages/error |
| P43 模板个人中心清理 | /profile | profile（已声明） | 沿用 features/profile |
| H01 调度监控暂缓 | over-look | 复用 common+menu（暂缓说明统一组件；已交付，标题走 menu 旧真译，无新增 key） | 无业务文件（D07） |
| H02 地图编辑暂缓 | map-nest-modify | 复用 common+menu（暂缓说明统一组件） | 无业务文件（D07） |
| H03 录制回放暂缓 | record-playback | 复用 common+menu（暂缓说明统一组件） | 无业务文件（D07） |

> 消费方式：页面在路由 `meta.i18nNamespaces` 声明本页命名空间（+按需 `'map'`/`'error'`）；基座 common/menu 随外壳全局加载。分片文件四语言（zh-TW/ja-JP/ko-KR/en-US）随页面任务交付后，从 `i18n-missing.md` 移除对应回退登记。

## 基座命名空间映射结论（T00.8）

1. **common**：旧资源中「取消/确定/保存/编辑/删除/操作/登录/退出/继续/重试/调度系统/登录已过期，请重新登录」等键为简中占位或少量真译；T00.8 按目标键集合全量交付四语言。旧真译沿用：`重试` → 重試/再試行/재시도。插值占位（`{{name}}/{{count}}/{{action}}/{{reason}}/{{status}}/{{code}}/{{succeeded}}/{{failed}}/{{unknown}}/{{id}}`）与简中 key 一致，不做本地化改写。
2. **menu**：旧资源为 `menu.<分组>.<页面>` 三层嵌套，新资源扁平化为页面标题 key（由路由 meta.title 消费）。旧真译沿用并登记：載具類型/キャリアタイプ/캐리어 유형（载具类型）、告警碼管理/アラームコード管理/알람 코드 관리（告警码管理）、多地圖點邊組合/マルチマップノードエッジグループ/멀티 맵 노드-엣지 그룹（多地图点边组合）、權限管理/権限管理/권한 관리（权限管理）、使用者管理/ユーザー管理/사용자 관리（用户管理）、即時看板/リアルタイムダッシュボード/실시간 대시보드（实时看板）、任務統計報表/タスク統計レポート/작업 통계 보고서（任务统计报表）、ロール管理/역할 관리（角色管理，ja/ko）、故障・アラート/고장 및 알림（故障告警，ja/ko）。旧资源其余菜单值为简中占位，按新译补齐，不构成译文丢失。
3. **auth / error**：旧资源无独立对应分片（登录页与错误页文案散落顶层占位键）；T00.8 按目标键集合交付。「重试」沿用旧真译。P42 补齐 404 页旧 key 映射：`抱歉，您访问的页面不存在`（en 真译 Sorry, the page you visited does not exist；繁日韩 B1 基线译文）、`首页`（en 真译 Home）、`去登录`（en 真译 Go to Login，与 access-denied 同术语）；同时移除无消费者的模板 key「页面不存在或已被移动」「返回工作台」。
4. **map**：T00.7 新增键，无旧 key 映射；T00.8 补齐四语言。

## 规则摘要（详见规格 18.2）

1. 旧 Umi 嵌套菜单 key 按目标路由元数据重新映射，不机械复制结构。
2. 中文 key 与值不同的简中资源须显式保留值差异；相同可省略。
3. React Intl `{name}` 插值 → i18next `{{name}}`；ICU/富文本/业务 JSON 花括号单独检查，不盲替。
4. 暂缓页（H01–H03）与历史页面资源保留映射去向，不加载到本期业务页。
5. 每条映射注明语言范围与迁移任务；未覆盖即缺失，进 `i18n-missing.md`。
