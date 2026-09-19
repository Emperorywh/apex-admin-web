/**
 * en-US · system-branding 命名空间（P27 系统设置页；key 为简体中文文案）。
 * 旧系统 en-US 资源对本页 key 有真译，逐条沿用（卡片标题/描述/上传反馈）；
 * 「{{label}}上传成功」旧资源为 {label} 单花括号形态，统一改 {{label}} 插值
 * （P25/P26 同款修正）；「仅支持 {{types}} 格式的文件」为本页新增防御性校验
 * 文案（accept 二次校验，P08 同款），无旧译按既有句式补译。
 */

export default {
  // Tab
  '图片配置': 'Image Settings',
  // 卡片标题与描述（旧真译沿用）
  '顶部导航栏图片': 'Top Navigation Bar Image',
  '顶部导航栏图片描述': 'Top navigation bar image',
  '登录背景图': 'Login Background Image',
  '登录背景图描述': 'Login background image',
  '网站 Tab 图标': 'Website Tab Icon',
  '网站 Tab 图标描述': 'Website tab icon',
  // 预览与上传
  '暂无图片': 'No Image',
  '点击预览': 'Click to Preview',
  '上传图片': 'Upload Image',
  '{{label}}上传成功': '{{label}} uploaded successfully',
  '上传失败': 'Upload Failed',
  '仅支持 {{types}} 格式的文件': 'Only {{types}} files are supported',
}
