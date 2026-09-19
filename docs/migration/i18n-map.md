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
| 页面私有（profile/system/orderRecord/dashboard 等） | 对应页面任务 | orderRecord 已随 P03 交付四语言（zh-CN 无需分片）；其余未交付，懒加载表查无返回空资源自动回退简中（i18n-missing.md 登记） |

## 各页命名空间/文件归属终版（T00.9 冻结）

命名规则：页面私有命名空间 = 目标路由 path 核心段 camelCase；懒加载分片放 `src/i18n/locales/{zh-CN,en-US,zh-TW,ja-JP,ko-KR}/<命名空间>.ts`（zh-CN 目录仅当 key≠value 时才需要文件），并在 `src/i18n/i18n.ts` 对应语言的懒加载表登记。业务域目录（features/services/types）与命名空间同名 camelCase；标注「沿用」者使用现有目录，不制造平行实现。三处例外以业务命名并注明理由。

| 任务 | 目标入口 | 命名空间 | 前端文件域（features/services/types） |
| --- | --- | --- | --- |
| P01 登录 | /auth/login | auth（T00 基座） | 沿用 features/auth + services/auth |
| P02 软件授权 | /authorize-ingress | **license-activation**（P02 已按任务卡业务命名修正：激活业务组件与语言分片供 P29 复用，按路由段命名不适合跨页语义；三处例外规则同理） | license-activation |
| P03 任务管理 | /order-record | orderRecord（已声明，四语言已交付） | features/order-record/components + services/order-record（模板遗留 types/order-record 已删除，DTO 在 service.types） |
| P04 车辆分组 | vehicle-group | vehicleGroup（已交付四语言分片 33 key 同构：en 旧真译沿用+删除确认/影响说明/失效标注补译，繁日韩 B1 基线补译；Transfer 选项失败文案经 common「加载失败」共用；nsSeparator=false 下 t() 不带「ns:」前缀） | features/vehicle-group + pages/vehicle-deploy/VehicleGroup + services/vehicle/vehicle-group |
| P05 车辆列表 | vehicle-display | vehicleList | vehicleList |
| P06 载具类型 | vehicle-type | **carrierType**（路径段 vehicle-type 会与车辆业务混淆，按真实载具业务命名；已交付四语言分片 27 key 同构：en 旧真译沿用（Carrier Name/Carrier Length (mm)/Add Carrier Type 等），繁日韩 B1 基线补译，「载具」沿用旧译实绩词 キャリア/캐리어/載具） | features/carrier-type + pages/vehicle-deploy/VehicleType + services/vehicle/carrier |
| P07 节点映射 | node-mapping | **nodeMapping**（按入口路径命名；已交付四语言分片 54 key 同构：en 旧真译逐条沿用（Mapping Name/AGV Count/Pick from Map/No longer on the map 等）且插值改本项目 `{{var}}` 双花括号语法，繁日韩 B1 基线补译；选点弹窗画布文案消费共享 map 命名空间，路由 meta 已声明） | features/node-mapping + pages/vehicle-deploy/NodeMapping + services/vehicle/node-mapping |
| P08 告警码管理 | alarm-code-management | **vehicleAlarmCode**（按接口域 vehicleAlarmCode 命名；已交付四语言分片 49 key 同构：en 旧真译逐条沿用（Alarm Code/Upload File/Upload Overwrites All/AlarmCodes.xlsx 等）且插值改本项目 `{{var}}` 双花括号语法，繁日韩 B1 基线补译（告警碼/アラームコード/알람 코드 按 terminology；公共词对齐 P07 nodeMapping 分片）；菜单标题「告警码管理」T00.8 menu 分片已有真译） | features/vehicle-alarm-code + pages/system-involve/AlarmCodeManagement + services/vehicle/vehicle-alarm-code |
| P09 地图列表 | map-list | **mapList**（已交付四语言分片 77 key 同构（逐 key 比对一致）：en 旧真译逐条沿用（Map Name/Import Dispatch Map/Pull Map/Push Map Version 等）且插值改本项目 `{{var}}` 双花括号语法，繁日韩 B1 基线补译（地圖/地図/지도 沿用旧译；传输进度行/G07 拉取禁用说明/删除确认影响按旧真译风格补译，公共词对齐 P08 vehicleAlarmCode 分片）；菜单标题「地图列表」menu 分片已有真译） | features/map-list + pages/map-through/MapList + services/map/map-admin |
| P10 地图关联 | cross-maps | **crossMap**（按接口域 crossMap 命名；已交付四语言分片 33 key 同构（逐 key 比对一致）：en 旧真译逐条沿用（Cross-Map Name/Device ID/Add Association/At least two maps must be associated 等）且插值改本项目 `{{var}}` 双花括号语法（`地图 {index}`→`地图 {{index}}`），繁日韩 B1 基线补译（クロスマップ/교차 지도 按 terminology 与 P09 mapList 分片对齐；删除确认影响文案按旧真译风格补译）；页面自有按钮词按旧页面真译差异化保留（确定=Confirm/操作=Action，与 common 的 OK/Actions 区分）；菜单标题「地图关联」menu 分片已有真译；失效选项公共词「{{id}}（已不在当前选项中）」复用 common 已有四语言词条） | features/cross-map + pages/map-through/CrossMaps + services/cross-map |
| P11 多地图点边组合 | point-edge-combination | **nodeEdgeGroup**（按接口域 systemNodeEdgeGroup 语义命名；已交付四语言分片 36 key 同构（逐 key 比对一致）：en 旧真译逐条沿用（Group Name/Group Key/Included Groups/Updated/Node-Edge Group Name/Belonging Map/Node Count/Edge Count/Available & Selected Node-Edge Groups/Add/Remove 等），补译词条（删除影响说明、失效关联识别与阻止保存提示、出错拼接 {{msg}}）按旧真译风格；繁日韩 B1 基线（旧资源真繁体/真译沿用：刪除多地圖點邊組合/點邊組合名稱/グループ名/ノードエッジグループ/그룹 이름/노드-엣지 그룹 등，简体复制与欠落词补译；确定=確認/확인、取消=キャンセル/취소、清空=クリア/지우기 与 P10 crossMap 分片对齐）；「已不可用」公共词与 P04 vehicleGroup 分片同形） | features/node-edge-group + pages/map-through/PointEdgeCombination + services/node-edge-group |
| P12 地图推送记录 | map-push-records | **mapPushRecord**（按接口域 mapPushRecord 命名；已交付四语言分片 30 key 同构（逐 key 比对一致）：en 旧真译逐条沿用（Map Name/Map Version/Push SLAM Base Map/Push Result/Re-push/Cancel Push/Waiting/Pushing/Cancelled/Failure Reason/Waiting Reason/Re-push initiated 等）且插值改本项目 {{var}} 双花括号语法（重新推送出错：{msg}→{{msg}}），确认框影响说明按旧真译风格补译；繁日韩 B1 基线补译（推送SLAM底图=SLAM ベースマップをプッシュ/SLAM 베이스맵 푸시、再プッシュ/재푸시、キャンセル済み/취소됨；操作=操作/작업、取消=キャンセル/취소 与 P09 mapList / P10 crossMap 分片对齐；车辆名称=車両名/차량 이름、创建时间=作成日時/생성 시간 与既有分片同形）；五状态枚举 key（等待/推送中/失败/成功/已取消）主表计数 Tag 与子表状态 Tag 共用） | features/map-push-record + pages/map-through/MapPushNotificationRecords + services/map-push-record |
| P13 调度中心 | dispatch-hub | **dispatchConfig**（按页面域命名（与预填 dispatchHub 修正为既有 camelCase 分片惯例一致）；已交付四语言分片 16 key 同构（逐 key 比对一致）：en 旧真译逐条沿用（Config Name/Default Value/Config Value/Value Range/Unit/Please enter config value/Please select config value/Reset/Save current dispatch parameters?/Reset current dispatch parameters?/Dispatch parameters saved successfully 等）且插值改本项目 {{var}} 双花括号，冲突中止与重置影响说明按旧真译风格补译；繁日韩 B1 基线补译（配置名称=設定名/설정 이름、默认值=デフォルト値/기본값、配置值=設定値/설정값、配置值范围=値の範囲/값 범위、配置值单位=単位/단위；繁中「預設值」用台湾惯用语）；「保存」公共词走 common 命名空间回退（useTranslation 数组 fallback，不带 ns: 前缀）不重复入分片） | features/dispatch-config + pages/dispatch-hub/DispatchHub + services/dispatch-config |
| P07 节点映射 | node-mapping | nodeMapping | nodeMapping |
| P08 告警码管理 | alarm-code | alarmCode | alarmCode |
| P09 地图列表 | map-list | mapList | mapList |
| P10 地图关联 | cross-maps | crossMap | crossMap |
| P11 多地图点边组合 | point-edge-combination | nodeEdgeGroup | nodeEdgeGroup |
| P12 地图推送记录 | map-push-records | mapPushRecord | mapPushRecord |
| P13 调度中心 | dispatch-hub | dispatchConfig | dispatchConfig |
| P11 多地图点边组合 | point-edge-combination | pointEdgeCombination | pointEdgeCombination |
| P12 地图推送记录 | map-push-records | mapPushRecord | mapPushRecord |
| P13 调度中心 | dispatch-hub | dispatchConfig | dispatchConfig |
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
| P38 任务详情 | /order-info | orderInfo（已交付四语言分片 5 key；详情字段/表格文案共用 orderRecord 命名空间——弹窗与完整页同一业务组件，零重复 key；nsSeparator=false 下 t() 不带「ns:」前缀） | features/order-detail + pages/order-info |
| P39 车辆详情 | /vehicle-info | vehicleInfo（已交付四语言分片 67 key 同构：详情标签/枚举值文案 en 旧真译沿用、繁日韩 B1 基线补译 + P39 形态新增文案独立窗口/缺参数/不存在反馈；抽屉「完整详情」入口经 vehicleList fallback 共用此分片；nsSeparator=false 下 t() 不带「ns:」前缀，繁日韩分片 key 必须与页面简中 key 一致） | features/vehicle-detail + pages/vehicle-info |
| P40 服务器资源 | /server-resource（别名 server-resource-monitor 同实现） | serverResource | serverResource |
| P41 无权限页 | /no-permission | **access-denied**（已交付；P41 按任务卡独立分片，覆盖冻结时「复用 common/error」的盘点） | 沿用 pages/un-access |
| P42 兜底错误页 | /404、/500 | **error**（已交付；沿用 T00 基座分片并入基座常载 BASE_NAMESPACES；旧 404 页 key「抱歉，您访问的页面不存在/首页」迁入，en 旧真译沿用，移除无消费模板 key） | 沿用 pages/error |
| P43 模板个人中心清理 | /profile | profile（已声明） | 沿用 features/profile |
| H01 调度监控暂缓 | over-look | 复用 common+menu（暂缓说明统一组件；已交付，标题走 menu 旧真译，无新增 key） | 无业务文件（D07） |
| H02 地图编辑暂缓 | map-nest-modify | 复用 common+menu（暂缓说明统一组件；已交付，标题走 menu 旧真译，无新增 key） | 无业务文件（D07） |
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
