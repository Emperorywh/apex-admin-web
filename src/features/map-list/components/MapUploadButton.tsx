/**
 * 导入地图按钮（P09）：导入调度地图（.zip）/导入车载地图（.bin）共用的上传入口
 * （旧 UploadMapButton 等价迁移）。
 *
 * 与旧实现的关键差异（样板升级，非行为发散）：
 * - 旧实现为伪进度条（定时器逼近 90%）——本重写改为传输管理器登记的真实字节
 *   进度（G11/规格 10.5：total 缺失即不确定进度，不伪造百分比），进度行由宿主
 *   页统一渲染（切页继续、关页提示，A16）；
 * - 旧实现仅靠 accept 属性过滤文件——本重写在 beforeUpload 显式校验扩展名并
 *   提示（P08 告警码上传同样板）；
 * - 导入是新增性操作（新地图/新版本），不做破坏性确认（旧实现同样无确认）。
 */

import { useCallback, useState } from 'react'
import { App, Button, Upload } from 'antd'
import type { UploadProps } from 'antd'
import { useTranslation } from 'react-i18next'
import { useRequestScope } from '@/components/RequestScopeProvider/RequestScopeContext'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import { beginTransfer } from '@/services/transfer/transferManager'

interface MapUploadButtonProps {
  /** 接受的扩展名（如 .zip / .bin，透传 antd Upload accept） */
  accept: string
  /** 按钮文案 */
  buttonText: string
  /** 上传图标 */
  icon: React.ReactNode
  /** 真实上传函数（服务层 operation，multipart file 字段） */
  uploadFn: (
    file: File,
    onUploadProgress: (event: { loaded: number; total?: number | null }) => void,
    options?: { signal: AbortSignal },
  ) => Promise<unknown>
  /** 上传成功提示（旧实现按导入类型区分文案；宿主页已翻译） */
  successText: string
  /** 上传失败提示的 i18n 键（含 {{msg}} 插位，组件内翻译拼接原因） */
  errorTextKey: string
  /** 上传成功后回调（宿主页刷新列表） */
  onSucceeded: () => void
}

export function MapUploadButton({
  accept,
  buttonText,
  icon,
  uploadFn,
  successText,
  errorTextKey,
  onSucceeded,
}: MapUploadButtonProps) {
  const { t } = useTranslation('mapList')
  const { message } = App.useApp()

  // 页签 scope：传输登记按本页签 key 归属（切页继续、关页提示）
  const scope = useRequestScope()

  // 上传防连点：传输期间禁用按钮（旧实现 loading 同语义）
  const [uploading, setUploading] = useState(false)

  const doUpload = useCallback(
    (file: File) => {
      setUploading(true)
      const transfer = beginTransfer({
        tabKey: scope?.scopeKey ?? null,
        kind: 'upload',
        name: file.name,
      })
      uploadFn(
        file,
        // 真实字节进度上报：total 缺失即不确定进度（不伪造百分比）
        (event) => transfer.setProgress(event.loaded, event.total ?? null),
        { signal: transfer.signal },
      )
        .then(() => {
          transfer.succeed()
          message.success(successText)
          onSucceeded()
        })
        .catch((error: unknown) => {
          if (!isCancelledError(error)) {
            const reason = t(errorTextKey, { msg: apiErrorMessage(error) })
            transfer.fail(reason)
            message.error(reason)
          } else {
            // 主动取消仅代表本机终止等待：按「结果待确认」语义标记失败说明
            transfer.fail(t('导入结果未知（本机已取消等待）'))
          }
        })
        .finally(() => setUploading(false))
    },
    [errorTextKey, message, onSucceeded, scope, successText, t, uploadFn],
  )

  /** 上传前：显式校验扩展名（旧实现仅 accept 过滤，误选文件无提示） */
  const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    const ext = accept.split(',')[0]
    if (!file.name.toLowerCase().endsWith(ext)) {
      message.warning(t('仅支持 {{ext}} 格式的文件', { ext }))
      return Upload.LIST_IGNORE
    }
    // 返回 false 阻止 antd 自动上传，由 doUpload 手动调用接口（真实进度登记）
    doUpload(file)
    return false
  }

  return (
    <Upload accept={accept} showUploadList={false} beforeUpload={beforeUpload} disabled={uploading}>
      <Button icon={icon} loading={uploading}>
        {buttonText}
      </Button>
    </Upload>
  )
}
