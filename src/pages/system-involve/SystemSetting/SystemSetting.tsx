/**
 * 系统设置页（P27 整页重写，替换迁移过渡占位）。
 *
 * 旧实现（C:\code\dd\src\pages\SystemInvolve\SystemSetting）：单 Tab「图片配置」
 * + 三张品牌图上传卡片（顶部导航栏图片 headerLogo / 登录背景图 loginBackground /
 * 网站 Tab 图标 favicon）。本重写保持业务闭环等价：
 * - 不新增通用设置 CRUD（SPEC：不假设存在通用设置 CRUD；旧页仅图片配置一个
 *   Tab，全部展示位均有对应接口，无「有配置无接口」缺口需要标明）；
 * - 预览：GET /systemLogos/{key}/file → objectURL，替换前/卸载时精确释放
 *   （A16 释放纪律）；失败/非图片/空体显示「暂无图片」占位，不伪装有图；
 * - 上传：PUT /systemLogos/{key} multipart 字段 file（G05，OpenAPI upsert 与
 *   旧实现同形态）；accept 过滤 + beforeUpload 扩展名二次校验（防「所有文件」
 *   绕过，P08 同款）；上传失败如实呈现且保留原已确认资源（不重拉不清空）；
 *   成功后经品牌变更通知刷新全部已挂载消费者（本页卡片 + 顶栏 logo + favicon），
 *   登录背景在下次进入登录页时以真实新资源呈现（登录页挂载即拉取）；
 * - 权限：菜单码 system:setting:view 挂路由守卫；三张卡片上传按钮分别挂
 *   system:setting:upload-navbar / upload-login-bg / upload-tab-icon，
 *   无权限隐藏上传按钮、预览保留可见（旧 §7.1 动作触发型隐藏同语义）；
 * - 品牌图是装饰性资源不是业务记录：无表格无列偏好无轮询；上传不接页签
 *   scope.signal（旧版同语义：axios 上传不随页面切换/卸载中止，小文件秒级
 *   完成，失败与结果经全局 message 如实呈现，不登记传输管理器）。
 */

import { useCallback, useEffect, useState } from 'react'
import { App, Button, Card, Image, Spin, Tabs, Typography, Upload } from 'antd'
import type { UploadProps } from 'antd'
import { Image as ImageIcon, ImagePlus, UploadCloud } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { usePermission } from '@/hooks/usePermission'
import { useBrandImage } from '@/hooks/useBrandImage'
import {
  notifyBrandResourcesChanged,
  upsertSystemImage,
} from '@/services/system/brand/brand.service'
import { apiErrorMessage } from '@/services/request/request'
import { PERM_BUTTON, type PermButtonCode } from '@/constants/auth/permission.constants'
import styles from './SystemSetting.module.css'

/** 品牌展示位配置：placementKey + 文案 key + accept + 上传按钮码（旧版同源四元组） */
interface BrandImageItem {
  key: string
  title: string
  description: string
  accept: string
  permCode: PermButtonCode
}

/** 三张品牌图卡片（顺序与旧版 ImageSettings 一致） */
const BRAND_IMAGE_ITEMS: BrandImageItem[] = [
  {
    key: 'headerLogo',
    title: '顶部导航栏图片',
    description: '顶部导航栏图片描述',
    accept: '.svg,.png,.jpg,.jpeg,.webp',
    permCode: PERM_BUTTON.SYSTEM_SETTING_UPLOAD_NAVBAR,
  },
  {
    key: 'loginBackground',
    title: '登录背景图',
    description: '登录背景图描述',
    accept: '.jpg,.jpeg,.png,.webp',
    permCode: PERM_BUTTON.SYSTEM_SETTING_UPLOAD_LOGIN_BG,
  },
  {
    key: 'favicon',
    title: '网站 Tab 图标',
    description: '网站 Tab 图标描述',
    accept: '.ico,.png,.svg',
    permCode: PERM_BUTTON.SYSTEM_SETTING_UPLOAD_TAB_ICON,
  },
]

export default function SystemSetting() {
  const { t } = useTranslation('system-branding')

  const items = [
    {
      key: 'image',
      label: (
        <span className={styles.tabLabel}>
          <ImageIcon size={15} aria-hidden="true" />
          {t('图片配置')}
        </span>
      ),
      children: (
        <div className={styles.grid}>
          {BRAND_IMAGE_ITEMS.map((item) => (
            <BrandUploadCard key={item.key} item={item} />
          ))}
        </div>
      ),
    },
  ]

  return (
    <div className={styles.page}>
      <Tabs items={items} defaultActiveKey="image" />
    </div>
  )
}

/** 单张品牌图卡片：预览（真实二进制）+ 上传（按钮码控入口，失败保留原图） */
function BrandUploadCard({ item }: { item: BrandImageItem }) {
  const { t } = useTranslation('system-branding')
  const { message } = App.useApp()
  const { hasPerm } = usePermission()

  // 无权限隐藏上传按钮，预览保留可见（旧 §7.1 同语义）
  const canUpload = hasPerm(item.permCode)

  // 预览 objectURL：useBrandImage 内部管理释放与品牌变更重拉（上传成功即刷新）
  const previewUrl = useBrandImage(item.key)
  const [uploading, setUploading] = useState(false)
  // 图片加载失败（内容损坏/伪图片——Blob 元数据校验防不住 contentType 误标）：
  // 显示「暂无图片」占位（旧版 antd Image onError → imgLoadError 同语义）；
  // key=previewUrl 使 src 变化时重建组件，错误态随之自然重置
  const [imgFailed, setImgFailed] = useState(false)
  // 预览 URL 更新（上传成功重拉/重挂载）时清除上一份资源的加载失败态
  useEffect(() => {
    setImgFailed(false)
  }, [previewUrl])

  /** 上传：扩展名二次校验 → PUT multipart → 成功通知全局刷新 / 失败如实呈现 */
  const beforeUpload: UploadProps['beforeUpload'] = useCallback(
    (file: File) => {
      const lowerName = file.name.toLowerCase()
      const matched = item.accept.split(',').some((ext) => lowerName.endsWith(ext))
      if (!matched) {
        message.warning(t('仅支持 {{types}} 格式的文件', { types: item.accept.replaceAll(',', ' / ') }))
        return Upload.LIST_IGNORE
      }

      setUploading(true)
      upsertSystemImage(item.key, file)
        .then(() => {
          message.success(t('{{label}}上传成功', { label: t(item.title) }))
          // 通知全部已挂载品牌消费者（本页三卡 + 顶栏 + favicon）重拉真实资源
          notifyBrandResourcesChanged()
        })
        .catch((err: unknown) => {
          // 真实失败如实呈现且不重拉（保留原已确认资源，A16）
          message.error(`${t('上传失败')}: ${apiErrorMessage(err)}`)
        })
        .finally(() => setUploading(false))
      // 返回 false 阻止 antd 自动上传，由本回调手动调用接口
      return false
    },
    [item, message, t],
  )

  return (
    <Card className={styles.card} title={t(item.title)} size="small">
      <div className={styles.cardContent}>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          {t(item.description)}
        </Typography.Text>
        <Spin spinning={uploading}>
          <div className={styles.previewArea}>
            {previewUrl && !imgFailed ? (
              <Image
                key={previewUrl}
                className={styles.previewImage}
                src={previewUrl}
                alt={t(item.title)}
                preview={{ mask: t('点击预览') }}
                onError={() => setImgFailed(true)}
              />
            ) : (
              <div className={styles.placeholder}>
                <ImagePlus className={styles.placeholderIcon} aria-hidden="true" />
                <span>{t('暂无图片')}</span>
              </div>
            )}
          </div>
        </Spin>
        {/* 上传图片：无权限隐藏，预览保留可见；在途禁用防连点 */}
        {canUpload && (
          <div className={styles.uploadActions}>
            <Upload
              accept={item.accept}
              showUploadList={false}
              beforeUpload={beforeUpload}
              disabled={uploading}
            >
              <Button type="primary" icon={<UploadCloud size={15} />} loading={uploading}>
                {t('上传图片')}
              </Button>
            </Upload>
          </div>
        )}
      </div>
    </Card>
  )
}
