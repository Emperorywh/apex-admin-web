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
| P14 电梯 | tri-resource/tri-device/elevator | **deviceElevator**（按页面域命名；已交付四语言分片 63 key 同构（逐 key 比对一致）：en 旧真译逐条沿用（Device Name/Device ID/Floor/Device Driver/IP Address/Call Elevator/Open- & Close Elevator Door/Clear Occupying Elevator Vehicle/Elevator Status/Current Floor/Running State/Front- & Back Elevator Door State/Vehicle Occupying Elevator/新增-编辑-删除与命令反馈全量等）且插值改本项目 {{var}} 双花括号，命令确认影响说明与 G06 禁用说明按旧真译风格补译；繁日韩旧资源对本页 key 均为简中复制（非有效译文），按 B1 基线补译：繁中 IP位址/連接埠/網路狀態/線上-離線 台湾惯用语，日文 デバイス名/エレベーター呼び出し/開扉-閉扉/車内呼び（内呼业界用语）/占用車両，韩文 장치 이름/엘리베이터 호출/문 열기-닫기/내부 호출；公共词对齐既有分片：编辑=編輯/편집、删除=刪除/삭제、启用禁用=啟用禁用（繁）有効無効（日）활성화 비활성화（韩）、在线离线=線上/離線（繁）、オンライン/オフライン（日）、온라인/오프라인（韩）；清空/确定/取消页内分片自带与 P06 carrierType 同形态不依赖 common 回退） | features/device-elevator + pages/tri-device/Elevator + services/device-elevator |
| P15 自动门 | tri-resource/tri-device/auto-door | **deviceAutoDoor**（按设备域命名与 deviceElevator 同构，T00 简表预留名 autoDoor 弃用；已交付四语言分片约 60 key 同构：en 旧真译逐条沿用（Device Name/Device ID/Driver/Enabled Status/IP Address/Open Door/Close Door/Clear Occupying Auto Door Vehicle/Auto Door Status/Door State/Auto door added successfully/Failed to parse device config JSON 等全量）且插值改本项目 {{var}} 双花括号，命令确认影响说明/占用车辆清单（{{count}} 台车辆：{{names}} 等）/删除引用检查说明按旧真译风格补译；繁日韩旧资源对本页 key 均为简中复制（非有效译文），按 B1 基线补译：繁中 IP位址/連接埠/網路狀態/線上-離線 台湾惯用语，日文 デバイス名/ドライバー/開扉-閉扉（设备业界用语）/自動ドア，韩文 장치 이름/드라이버/문 열기-닫기/자동문；公共词对齐 P14 deviceElevator 分片（编辑/删除/启用禁用/在线离线）；清空/确定/取消页内分片自带同 P14 形态；旧命令成功类 key（自动门开门成功等）按受理语义升级为「已发送…以「状态」查询为准」，key 映射登记本行） | features/device-auto-door + pages/tri-device/AutoDoor + services/device-auto-door |
| P16 充电桩 | tri-resource/tri-device/charge-pie | **deviceChargePile**（按设备域命名与 deviceElevator/deviceAutoDoor 同构，T00 简表预留名 chargePile 弃用；已交付四语言分片 50 key 同构（逐 key 比对一致）：en 旧真译逐条沿用（Device ID/Device Name/Device Status/Associated Driver/Device IP Address/Device Port/Charging Station Status/Start Charging/Stop Charging/Charging station added-deleted-updated successfully/Failed to start-stop charging/Please enter a valid IP address/Failed to parse device config JSON 等全量），命令确认影响说明与受理语义提示（已发送…以「充电桩状态」列为准）按旧真译风格补译；繁日韩旧资源对本页 key 均为简中复制（非有效译文），按 B1 基线补译：繁中 設備IP位址/設備連接埠/設備配置資訊/充電樁 台湾惯用语，日文 デバイス状態/関連ドライバー/充電ステーション（与 menu 分片对齐）/充電開始-充電停止/アイドル・満充電（状态词与 vehicleInfo 分片对齐），韩文 장치 상태/연동 드라이버/충전기（与 menu 分片对齐）/충전 시작-충전 정지/대기・충전 완료；公共词对齐 P14/P15 设备分片（编辑/删除/启用禁用/离线/清空 지우기/확인）；旧命令成功类 key（开始充电成功等）按受理语义升级为「已发送…以「充电桩状态」列为准」，key 映射登记本行） | features/device-charge-pile + pages/tri-device/ModbusChargePile + services/device-charge-pile |
| P17 交通灯 | tri-resource/tri-device/traffic-lights | **deviceTrafficLight**（按设备域命名与 deviceElevator/deviceAutoDoor/deviceChargePile 同构；已交付四语言分片 41 key 同构：en 旧真译逐条沿用（Device ID/Device Name/Request URL/Request Params/Response Success Expression/Sync Wait Response/Created/Test/Traffic light test successful, connectivity normal/Traffic light added-deleted-updated successfully/Arrival Notification/Please select whether to sync wait for response 等全量），命令确认标题与影响说明（测试交通灯/测试影响…/删除影响…）按旧真译风格补译；繁日韩旧资源对本页 key 均为简中复制（非有效译文），按 B1 基线补译：繁中 交通號誌（与 menu 分片对齐）/請求位址/回應成功表達式/同步等待回應/創建時間 台湾惯用语，日文 信号機（与 menu 分片对齐）/リクエスト URL/レスポンス成功式/同期応答待ち/到着通知/作成日時，韩文 신호등（与 menu 分片对齐）/요청 URL/응답 성공 표현식/동기 응답 대기/도착 알림/생성 시간；公共词对齐 P14–P16 设备分片（設備標識/장치 ID/デバイスドライバー/清空=クリア·지우기/确定=確定·확인）；旧 en key「确认删除当前交通灯?」随 Popconfirm→confirmCommand 升级改列影响说明补译，登记本行） | features/device-traffic-light + pages/tri-device/TrafficLights + services/device-traffic-light |
| P18 风淋门 | tri-resource/tri-device/air-shower-door | **deviceAirShower**（按设备域命名与 deviceElevator/deviceAutoDoor/deviceChargePile/deviceTrafficLight 同构；已交付四语言分片同构：en B1 基线补译（Air Shower Door/Device ID/Air Shower Status/Front Door State/Rear Door State/Fault/Open-door Type 等，与 menu 分片 Air Shower Door(s) 及 deviceElevator 的 Front Door/Rear Door 对齐），繁日韩旧资源对本页 key 均为简中复制（非有效译文），按 B1 基线补译：繁中 風淋門（与 menu 分片对齐）/IP位址/連接埠/線上·離線/開門類型·關門類型 台湾惯用语，日文 エアシャワードア（与 menu 分片对齐）/開扉·閉扉（沿用 P15 自动门）/前ドア·後ドア（沿用 P14 电梯），韩文 에어샤워 도어（与 menu 分片对齐）/문 열기·문 닫기（沿用 P15）/앞문·뒷문（沿用 P14）；公共词对齐 P14–P17 设备分片（清空=クリア·지우기/确定=確定·확인）；命令确认影响说明与受理反馈（已发送…執行結果以「狀態」查詢為準）沿用 P15 句式并携带门类型插值 {{door}}，登记本行） | features/device-air-shower + pages/tri-device/AirShowerDoor + services/device-air-shower |
| P22 避障模板 | mission-cluster/obstacle-avoidance | **obstacleTemplate**（页面私有命名空间；已交付四语言分片同构：en 旧真译逐条沿用（Obstacle Name/Obstacle Param Name/Obstacle Param Type/Enable Obstacle Param/Enabled/Disabled/Add Obstacle( Template)/Select Template/Available/Selected/Search Template Name/Parameters/Please enter (select) obstacle…/Please select at least one template/Default/Custom {index}→按 i18next 插值改 {{index}} 与 P10 crossMap 同形态/创建-更新-删除-查询 避障数据成功出错 等全量）+ 删除确认标题与影响说明/错误 msg 插值/无法识别参数提示按旧真译风格补译；繁日韩旧资源 14 个模板名与「預設/デフォルト/기본값」「自訂{index}/カスタム{index}/사용자 정의 {index}」有真译逐条沿用，其余 key 为简中复制按 B1 基线补译：繁中 避障範本（与 menu 分片对齐）/範本/參數設定/搜尋/儲存 台湾惯用语，日文 障害物回避テンプレート（与 menu 分片对齐）/テンプレート選択/候補·選択済みテンプレート/パラメータ設定/避障パラメータ種別，韩文 장애물 회피 템플릿（与 menu 分片对齐）/템플릿 선택/파라미터 설정/장애물 회피 파라미터 유형；公共词与 P11 nodeEdgeGroup 分片对齐（照会/조회、クリア/지우기、確認/확인、移除=移除/이동），登记本行） | features/obstacle-avoidance + pages/obstacle-avoidance/ObstacleAvoidance + services/obstacle-avoidance |
| P23 车辆动作 | mission-cluster/action-control/agv-action | **agvAction**（页面私有命名空间；已交付四语言分片同构：en 旧真译逐条沿用（Query AGV Actions/Add Action/Action Type/Description/Block Type/Parameters/Action Name/Action Value/Add Action Parameter/Please enter (select) action…/Action added-deleted-updated successfully/Error adding-editing-deleting action 等全量）+ 删除确认标题（Delete AGV Action）与影响说明/错误 msg 插值（Error … action: {{msg}}）按旧真译风格补译；繁日韩旧资源对本页 key 均为简中复制（非有效译文），按 B1 基线补译：繁中 車輛動作（与 menu 分片对齐）/動作類型/阻塞類型/新增動作參數 台湾惯用语，日文 車両アクション（与 menu 分片对齐）/アクション種別/ブロック種別/パラメータを追加，韩文 차량 액션（与 menu 分片对齐）/액션 유형/블록 유형/파라미터 추가；公共词与 P22 obstacleTemplate 分片对齐（照会/조회、クリア/지우기、確認/확인、取消=キャンセル·취소），登记本行） | features/action-control + pages/action-control/AGVAction + services/action/agv-action-manage |
| P25 版本管理 | system-involve/version-control | **systemVersion**（页面私有命名空间；四语言分片同构：en 旧真译逐条沿用（Version Type/Commit Description/Git Tag/Commit Message/Commit Time/Build Time/Current Version/Backup Version/Pending/Rollback/Restart Program/Confirm restart program?/Update Version Package/Cancel Upload/Upload completed/Remaining/{n} s·min 等全量；「确认删除该待升级版本?」与下载取消类文案旧资源 <MISSING> 按旧真译风格补译；错误反馈统一 {{msg}} 插值；ETA 旧 {n} 单花括号形态改 {{n}} i18next 标准——P22 同款修正）；繁日韩旧资源对本页 key 均为简中复制（非有效译文），按 B1 基线补译：繁中 重啟程式/目前版本/建置時間/伺服器/檔案 台湾惯用语，日文 バージョン種別/コミット説明/ビルド日時/更新待ち/プログラム再起動，韩文 버전 유형/커밋 설명/빌드 시간/업데이트 대기/프로그램 재시작；公共词与 P08 vehicleAlarmCode 分片对齐（다운로드/삭제/조작）；「版本管理」菜单名与 menu 分片对齐） | features/system-version + pages/system-involve/VersionControl + services/system/system-version |
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
| P14 电梯 | elevator | deviceElevator | deviceElevator |
| P15 自动门 | auto-door | deviceAutoDoor | deviceAutoDoor |
| P16 充电桩 | charge-pie | deviceChargePile | deviceChargePile |
| P17 交通灯 | traffic-lights | deviceTrafficLight | deviceTrafficLight |
| P18 风淋门 | air-shower-door | deviceAirShower | deviceAirShower |
| P22 避障模板 | obstacle-avoidance | obstacleTemplate | obstacleTemplate |
| P23 车辆动作 | action-control/agv-action | agvAction | agvAction |
| P17 交通灯 | traffic-lights | trafficLight | trafficLight |
| P18 风淋门 | air-shower-door | airShowerDoor | airShowerDoor |
| P18 风淋门 | air-shower-door | airShowerDoor | airShowerDoor |
| P19 三方交管 | tri-traffic | tripartite-traffic | tripartite-traffic |
| P20 任务工艺 | mission-create | missionCreate | missionCreate |
| P21 工艺管理 | mission-flow | missionFlow | missionFlow |
| P22 避障模板 | obstacle-avoidance | obstacleAvoidance | obstacleAvoidance |
| P23 车辆动作 | action-control/agv-action | agvAction（旧仓库无独立分片，动作文案混在全局资源） | agvAction |
| P23 车辆动作 | agv-action | agvAction | agvAction |
| P24 动作分组 | agv-action-group | agvActionGroup | agvActionGroup |
| P25 版本管理 | version-control | versionControl | versionControl |
| P26 系统日志 | system-involve/system-log | **systemLog**（页面私有命名空间；四语言分片同构：en 旧真译逐条沿用（Log Name/Last Modified/Log Type/Start Time/End Time/Query/Clear/Download Log/Please select logs to download/Log download completed 等）；「下载系统日志出错」旧「文案+err.message 拼接」改 {{msg}} 插值（P25 同款）；传输行三条与「已取消下载」沿用 P08/P25 既有译法；繁日韩旧资源对本页 key 均为简中复制（非有效译文），按 B1 基线补译：繁中 日誌名稱/下載日誌/最後修改時間，日文 ログ名/ログ種別（P25「種別」同款）/最終更新日時/ログダウンロード，韩文 로그 이름/로그 유형（P25「유형」同款）/마지막 수정 시간/로그 다운로드；公共词与 P03/P08 既有分片对齐（查詢/検索/조회、清空/クリア/지우기、開始時間/開始時刻/시작 시각）；「系统日志」菜单名与 menu 分片对齐） | pages/system-involve/SystemLog + services/system/system-log |
| P26 系统日志 | system-log | systemLog | systemLog |
| P27 系统设置 | system-involve/system-setting | **system-branding**（页面私有命名空间，命名空间名随 TASKS 台账 kebab 形态；四语言分片同构：en 旧真译逐条沿用（Image Settings/Top Navigation Bar Image/Login Background Image/Website Tab Icon/No Image/Click to Preview/Upload Image/Upload Failed 等）；「{{label}}上传成功」旧 {label} 单花括号改 {{label}} 插值（P25/P26 同款）；「仅支持 {{types}} 格式的文件」为本页新增防御校验文案（无旧译，四语言补译）；繁中旧资源与简中同形按 B1 基线补译（登入背景圖/網站 Tab 圖示，与 auth 分片「登入」对齐）；日韩 B1 基线补译：日文 画像設定/上部ナビゲーションバーの画像/ログイン背景画像/サイトタブアイコン/画像をアップロード，韩文 이미지 설정/상단 내비게이션 바 이미지/로그인 배경 이미지/사이트 탭 아이콘/이미지 업로드；「系统设置」菜单名与 menu 分片对齐（システム設定/시스템 설정）） | pages/system-involve/SystemSetting + services/system/brand |
| P27 系统设置 | system-branding | system-branding | system-branding |
| P28 操作日志 | operation-log | operationLog | operationLog |
| P29 软件信息 | system-involve/software-information | **software-license**（页面私有命名空间；激活弹窗复用 P02 组件故路由 meta 并声明 license-activation；四语言分片同构：en 旧真译逐条沿用+插值 {{label}} 形态修正，繁日韩 B1 基线真实译文与 P02 术语对齐——啟用/有効化/활성화） | software-license |
| P30 数据库备份 | system-involve/database-backup | **database-backup**（页面私有命名空间；四语言分片同构 24 键：en 旧真译逐条沿用+错误反馈 {{msg}} 插值形态修正，下载弹窗类旧资源缺失按 P25 风格补译并与 systemVersion 术语对齐，繁日韩 B1 基线真实译文——資料庫/データベース/데이터베이스 系；菜单项「数据库备份管理」四语言既有译文沿用） | database-backup |
| P31 用户管理 | access-management/user-management | **access-user**（页面私有命名空间；四语言分片同构：en 旧真译逐条沿用 35 键+{password}/{total} 占位改 i18next {{}} 插值形态+「新增用户成功/失败」「删除影响」旧资源缺失按旧真译风格补译，失败反馈统一「……失败：{{msg}}」插值（旧版裸拼接语义等价），繁日韩 B1 基线真实译文——使用者/ユーザー/사용자 系与 menu 对齐；「确定」按旧页语境 Confirm（common 为 OK 不冲突，分片优先命中）；模板遗留 en-US/system.ts 用户页死键 23 个已清理（role/menu 键保留归 P32/P43）） | access-user | 2026-09-20（P31；修复 useTranslation 命名空间名不一致致 en 分片未消费缺陷后复验全绿） |
| P32 角色管理 | access-management/role-management | **access-role**（页面私有命名空间；四语言分片同构：en 旧真译逐条沿用（列头/按钮/校验/反馈/三态全选词 Select All/Unselect All），失败反馈统一「……失败：{{msg}}」插值（旧版裸拼接语义等价），「删除影响」confirmCommand 升级文案按旧真译风格补译（P31 同款），繁日韩 B1 基线真实译文——角色/ロール/역할、分配權限/権限割り当て/권한 할당 与 menu/access-user 对齐；模板遗留 en-US/system.ts role 死键 19 个已清理（menu 键保留归 P43）） | access-role | 2026-09-20（P32） |
| P31 用户管理 | user-management | userManagement | 沿用 pages/system/user + services/system/user |
| P32 角色管理 | role-management | roleManagement | 重写 pages/access-management/RoleManagement + services/access-role（模板 system/role 链已删除，en 旧真译沿用 access-role 分片） |
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
