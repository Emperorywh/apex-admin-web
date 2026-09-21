/** 登录页的工业导航场景：以仓储底图和实体 AGV 表达机器人控制平台定位，不承载运行数据。 */
import { useId } from 'react'
import styles from '@/pages/auth/Login/RobotScene.module.css'

/** paused 由登录页的动效开关统一控制；关闭动效时仍保留完整的静态场景。 */
interface RobotSceneProps {
  paused: boolean
}

/** 纯 SVG 装饰插图按固定等距视角缩放；独立实例使用唯一渐变标识，避免同页引用串色。 */
export function RobotScene({ paused }: RobotSceneProps) {
  const sceneId = useId()
  const paint = (name: string) => `url(#${sceneId}-${name})`

  return (
    <svg
      className={styles.scene}
      data-paused={paused}
      viewBox="0 0 720 390"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      {/* 金属和玻璃渐变保留实体层次，底板强调色复用控制台蓝色令牌；灯光滤镜限制在局部导航灯与路线。 */}
      <defs>
        <linearGradient id={`${sceneId}-floor`} x1="370" y1="87" x2="370" y2="374" gradientUnits="userSpaceOnUse">
          <stop stopColor="#123149" stopOpacity="0.35" />
          <stop offset="1" stopColor="#0B1C30" stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id={`${sceneId}-edge`} x1="86" y1="229" x2="665" y2="229" gradientUnits="userSpaceOnUse">
          <stop stopColor="#345E76" stopOpacity="0.1" />
          <stop offset="0.48" stopColor="var(--app-blue-2)" stopOpacity="0.7" />
          <stop offset="1" stopColor="#345E76" stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id={`${sceneId}-glass`} x1="150" y1="95" x2="150" y2="239" gradientUnits="userSpaceOnUse">
          <stop stopColor="#18394B" stopOpacity="0.62" />
          <stop offset="1" stopColor="#10233B" stopOpacity="0.25" />
        </linearGradient>
        <linearGradient id={`${sceneId}-deck`} x1="260" y1="160" x2="429" y2="249" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7392A7" />
          <stop offset="0.22" stopColor="#3B5E77" />
          <stop offset="0.64" stopColor="#183951" />
          <stop offset="1" stopColor="#446981" />
        </linearGradient>
        <linearGradient id={`${sceneId}-front`} x1="236" y1="204" x2="365" y2="295" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2B4C63" />
          <stop offset="0.4" stopColor="#142A41" />
          <stop offset="1" stopColor="#0A192B" />
        </linearGradient>
        <linearGradient id={`${sceneId}-side`} x1="366" y1="270" x2="462" y2="222" gradientUnits="userSpaceOnUse">
          <stop stopColor="#132A40" />
          <stop offset="1" stopColor="#294F68" />
        </linearGradient>
        <linearGradient id={`${sceneId}-sensor`} x1="330" y1="145" x2="371" y2="170" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6B8B9D" />
          <stop offset="0.5" stopColor="#1B3D53" />
          <stop offset="1" stopColor="#355B73" />
        </linearGradient>
        <radialGradient id={`${sceneId}-shadow`}>
          <stop stopColor="#000711" stopOpacity="0.9" />
          <stop offset="1" stopColor="#000711" stopOpacity="0" />
        </radialGradient>
        <filter id={`${sceneId}-light`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="2.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* 透视底板和离散网格提供坐标空间；蓝色边缘采用低对比度避免抢占登录表单视觉层级。 */}
      <path d="M73 227 370 78 667 227 370 376Z" fill={paint('floor')} stroke="#25465B" strokeOpacity="0.55" />
      <path d="M73 227v8l297 149 297-149v-8M370 376v8" stroke={paint('edge')} />
      <g stroke="#28516A" strokeOpacity="0.34" strokeWidth="0.7">
        <path d="M115 248l297-149M157 269l297-149M200 291l297-149M242 312l297-149M285 334l297-149M327 355l297-149" />
        <path d="M115 206l297 149M157 185l297 149M200 163l297 149M242 142l297 149M285 120l297 149M327 99l297 149" />
      </g>
      <path d="m73 227 25 13m-25-13 25-13m569 13-25 13m25-13-25-13M345 91l25-13 25 13M345 363l25 13 25-13" stroke="var(--app-blue-2)" strokeOpacity="0.7" />
      <g fill="#51758A" opacity="0.75">
        <circle cx="157" cy="227" r="1.5" />
        <circle cx="243" cy="270" r="1.5" />
        <circle cx="327" cy="312" r="1.5" />
        <circle cx="454" cy="290" r="1.5" />
        <circle cx="539" cy="248" r="1.5" />
        <circle cx="582" cy="227" r="1.5" />
      </g>

      {/* 后排库位以半透明体块、层架及投影表现物理障碍，不模拟未接入的设备状态。 */}
      <g stroke="#355F75" strokeWidth="0.85" strokeLinejoin="round">
        <path d="m145 156 63-32 65 33-63 32Z" fill="#152E41" fillOpacity="0.65" />
        <path d="M145 156v49l65 33v-49ZM210 189l63-32v49l-63 32Z" fill={paint('glass')} />
        <path d="m145 173 65 33 63-32m-128 15 65 33 63-32M166 167v49m23-38v49m43-49v49m21-60v49" opacity="0.64" />
        <path d="m153 151 55-28 57 29m-111 58 56 28 55-28" strokeDasharray="3 5" opacity="0.5" />
        <path d="m463 132 65-33 71 36-65 33Z" fill="#18384B" fillOpacity="0.5" />
        <path d="M463 132v56l71 36v-56ZM534 168l65-33v56l-65 33Z" fill={paint('glass')} />
        <path d="m463 151 71 36 65-33m-136 16 71 36 65-33m-112-29v56m24-44v56m44-55v56m21-67v56" opacity="0.7" />
        <path d="m489 93 39-20 43 22-39 20Z" fill="#112A3E" fillOpacity="0.65" />
        <path d="M489 93v21l43 22v-21l39-20v21l-39 20" fill={paint('glass')} />
        <path d="m151 206-19 10 78 39 78-39-17-9m194-15-16 9 85 43 80-41-15-8" strokeDasharray="2 5" opacity="0.5" />
      </g>

      {/* 导航路径与路点复用控制台的蓝色、亮蓝令牌，冷白路点形成层次，轻微流动仅作空间引导。 */}
      <path d="m144 270 67 34 101-51 70 35 150-76 52 26" stroke="var(--app-blue)" strokeWidth="1.2" strokeOpacity="0.55" />
      <path className={styles.route} d="m144 270 67 34 101-51 70 35 150-76 52 26" stroke="var(--app-cyan)" strokeWidth="1.8" strokeDasharray="5 17" />
      <g stroke="var(--app-blue-2)" strokeWidth="1">
        <ellipse cx="144" cy="270" rx="7" ry="3.5" />
        <ellipse cx="211" cy="304" rx="7" ry="3.5" />
        <ellipse cx="532" cy="212" rx="7" ry="3.5" />
        <ellipse cx="584" cy="238" rx="7" ry="3.5" />
      </g>
      <g fill="color-mix(in srgb, var(--app-cyan) 30%, white)">
        <ellipse cx="144" cy="270" rx="2" ry="1" />
        <ellipse cx="584" cy="238" rx="2" ry="1" />
      </g>

      {/* 椭圆扫描圈沿用控制台蓝色强调层级并围绕机器人落点展开，实体阴影保持贴地的机械质感。 */}
      <ellipse cx="357" cy="260" rx="124" ry="61" stroke="var(--app-blue)" strokeOpacity="0.32" strokeDasharray="3 7" />
      <ellipse className={styles.scan} cx="357" cy="260" rx="124" ry="61" stroke="var(--app-cyan)" strokeOpacity="0.55" />
      <path d="M233 260a124 61 0 0 1 51-49m146 96a124 61 0 0 1-66 14" stroke="var(--app-blue-2)" strokeOpacity="0.8" strokeWidth="1.5" />
      <ellipse cx="354" cy="271" rx="139" ry="64" fill={paint('shadow')} />

      {/* 三个外露轮组按透视压缩，轮毂、胎面与底盘边缘形成可辨识的 AGV 构造。 */}
      <g stroke="#29465D" strokeWidth="1.5">
        <g transform="matrix(0.9 0.45 0 1 263 248)">
          <ellipse rx="16" ry="20" fill="#050E1B" />
          <ellipse rx="9" ry="13" fill="#162A3D" />
          <ellipse rx="4" ry="7" fill="#37546A" />
        </g>
        <g transform="matrix(0.9 0.45 0 1 335 284)">
          <ellipse rx="16" ry="20" fill="#050E1B" />
          <ellipse rx="9" ry="13" fill="#162A3D" />
          <ellipse rx="4" ry="7" fill="#37546A" />
        </g>
        <g transform="matrix(0.9 -0.45 0 1 433 264)">
          <ellipse rx="15" ry="19" fill="#050E1B" />
          <ellipse rx="9" ry="13" fill="#1A3247" />
          <ellipse rx="4" ry="7" fill="#49687D" />
        </g>
      </g>

      {/* 机身采用倒角顶板及两向金属渐变，灯带和检修面板遵循同一等距投影。 */}
      <path d="m240 188 95-48a12 12 0 0 1 11 0l116 58q8 4 8 12v27q0 8-8 12l-89 45q-8 4-16 0l-117-59q-7-4-7-11v-24q0-8 7-12Z" fill="#12283C" stroke="#46667B" strokeWidth="1.1" />
      <path d="M234 201q0 7 9 12l113 56q9 5 10 15v13l-122-61q-10-5-10-12Z" fill={paint('front')} />
      <path d="m366 271 98-49q6-3 6-10v24q0 8-8 12l-89 45-7 3Z" fill={paint('side')} />
      <path d="m240 187 94-47q7-4 14 0l115 58q13 7 0 14l-88 45q-10 5-20 0l-115-57q-12-7 0-13Z" fill={paint('deck')} stroke="#7894A7" strokeWidth="1.1" />
      <path d="m244 197 114 57q8 4 15 0l88-45" stroke="#A4BFCD" strokeOpacity="0.65" />
      <path d="m250 184 85-42q6-3 13 1l101 50" stroke="#AFCDDB" strokeOpacity="0.4" />
      <path d="m246 226 103 52m34-3 72-36" stroke="#405C70" strokeWidth="1.4" />
      <path d="m247 239 9 4m47 24 11 5m77 12 21-11" stroke="#060F1E" strokeWidth="5" />

      {/* 顶部任务载台与螺钉强化设备细节；品牌标记及雷达灯沿用共享文字、蓝色令牌，不增加动态数值文案。 */}
      <path d="m290 194 51-26q6-3 12 0l78 39-63 32Z" fill="#0F293D" stroke="#52778D" strokeWidth="0.9" />
      <path d="m303 194 44-22 69 35-49 25Z" stroke="#325C73" strokeWidth="0.7" />
      <g fill="#7E9BAD">
        <ellipse cx="261" cy="194" rx="2.5" ry="1.3" />
        <ellipse cx="338" cy="154" rx="2.5" ry="1.3" />
        <ellipse cx="445" cy="207" rx="2.5" ry="1.3" />
        <ellipse cx="366" cy="246" rx="2.5" ry="1.3" />
      </g>
      {/* 中文品牌沿载台的等距方向居中，复用支持中文的项目字体并收紧字距，避免超出面板。 */}
      <text transform="matrix(0.9 0.45 -0.9 0.45 358 204)" textAnchor="middle" fill="var(--app-text-2)" fontSize="18" fontWeight="600" letterSpacing="1.5" fontFamily="var(--app-font)">睿芯行</text>
      <ellipse cx="351" cy="168" rx="28" ry="14" fill="#071726" stroke="#476E85" />
      <path d="M329 145v17c0 7 44 7 44 0v-17Z" fill={paint('sensor')} stroke="#567B90" />
      <path d="M331 153c3 8 36 8 40 0" stroke="var(--app-cyan)" strokeWidth="3" filter={paint('light')} />
      <ellipse cx="351" cy="145" rx="22" ry="11" fill="#385F76" stroke="#88A7B8" />
      <ellipse cx="351" cy="143" rx="13" ry="6.5" fill="#16354B" stroke="#4F7B91" />
      <ellipse cx="351" cy="142" rx="5" ry="2.5" fill="var(--app-blue-2)" />

      {/* 前照灯使用亮蓝混合冷白高光，侧灯沿用控制台蓝色；发光面积受限，避免影响页面阅读。 */}
      <path d="m250 216 94 47" stroke="#08121F" strokeWidth="8" strokeLinecap="round" />
      <path d="m253 216 29 15m18 9 40 20" stroke="color-mix(in srgb, var(--app-cyan) 30%, white)" strokeWidth="2.7" strokeLinecap="round" filter={paint('light')} />
      <g transform="matrix(0.88 -0.44 0 1 393 257)" stroke="#071726" strokeWidth="2.3">
        <path d="M0 0v12M6 0v12M12 0v12M18 0v12M24 0v12M30 0v12M36 0v12" />
      </g>
      <path d="m446 227 12-6v8l-12 6Z" fill="var(--app-blue-2)" fillOpacity="0.65" />

      {/* 低密度工程标注复用控制台文字与蓝色令牌，并放在场景空白处，避免覆盖机体和主要文案。 */}
      <g className={styles.annotations}>
        <path d="M350 116V87h-40M473 275h58l28 14" stroke="var(--app-text-4)" strokeOpacity="0.65" />
        <circle cx="350" cy="116" r="2" fill="var(--app-blue-2)" />
        <circle cx="473" cy="275" r="2" fill="var(--app-blue-2)" />
        <text x="242" y="90" fill="var(--app-text-3)">LIDAR</text>
        <text x="563" y="295" fill="var(--app-text-2)">AGV–01</text>
        <text x="95" y="333" fill="var(--app-text-4)" fontSize="8">NAVIGATION / AUTONOMOUS</text>
        <path d="M95 341h100" stroke="var(--app-text-4)" strokeOpacity="0.65" />
        <path d="M95 341h22" stroke="var(--app-cyan)" />
      </g>
    </svg>
  )
}
