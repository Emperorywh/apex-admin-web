/**
 * 更新版本包上传组件（P25；旧实现 UpdateVersion/index.tsx 等价迁移）。
 *
 * 业务语义（旧 v2_dev 定版，SPEC_update_version_real_upload_progress.md）：
 * - 仅上传版本包到「待升级」列表，不自动重启、不跳登录；成功后回调父级刷新列表；
 * - 真实上传进度（百分比 / 已传·总大小 MB / 速度 / 剩余时间），进度与进度条
 *   完全来自传输事件，不推进任何模拟数值（旧伪进度已在旧仓库改造中移除，
 *   本迁移保持真实进度纪律）；
 * - 「传输完成 ≠ 处理完成」：字节发完（loaded ≥ total）即切「等待服务器处理」
 *   阶段（服务端落盘/校验耗时不受限制），拿到成功响应才算完成（任务卡验收点）；
 * - 取消上传经二次确认后中止（已传部分被丢弃，需重新选择文件上传）；
 * - 仅上传中拦截 beforeunload（关闭/刷新弹浏览器原生确认），响应返回即解除；
 * - 失败不自动重试（版本包上传非幂等），手动重选文件重传。
 *
 * 通道差异登记（等价迁移取舍）：旧实现走自研 XHR 封装（含 60s 连接/上传停滞
 * 自动中止）；新架构统一走请求层 axios 通道（鉴权/业务码/语言头由拦截器统一
 * 处理，无需复刻），axios 无停滞事件，故不落地停滞自动中止——保留取消入口与
 * 网络错误兜底呈现，差异已在任务记录登记。
 *
 * 传输经传输管理器登记（切页继续、关页提示；100% 后 markProcessing 标记
 * 「服务端处理中」，与弹窗阶段文案一致）。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { App, Button, Upload } from 'antd'
import type { UploadProps } from 'antd'
import { UploadCloud } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { apiErrorMessage, isCancelledError } from '@/services/request/request'
import { beginTransfer } from '@/services/transfer/transferManager'
import { useRequestScope } from '@/components/RequestScopeProvider/RequestScopeContext'
import { uploadSystemVersion } from '@/services/system/system-version/system-version.service'
import { useTransferSpeed } from '../hooks/useTransferSpeed'
import TransferProgressModal from './TransferProgressModal'

/** 上传阶段（对齐进度弹窗契约）：transferring 传字节 / processing 等服务端 / done 成功 */
type UploadPhase = 'transferring' | 'processing' | 'done'

/** 组件属性：成功回调（父级刷新版本列表用）与可见性由页面控制 */
interface VersionUploadButtonProps {
  /** 上传成功（后端 code=200）后的回调；父级借此刷新版本列表 */
  onSucceeded: () => void
}

export default function VersionUploadButton({ onSucceeded }: VersionUploadButtonProps) {
  const { t } = useTranslation('systemVersion')
  const { message, modal } = App.useApp()
  // 页签作用域：传输登记按本页签 key 归属（切页继续、关页提示）
  const scope = useRequestScope()

  const [uploading, setUploading] = useState(false)
  const [phase, setPhase] = useState<UploadPhase>('transferring')
  // 真实进度字节（来自 onUploadProgress 事件）
  const [loaded, setLoaded] = useState(0)
  const [total, setTotal] = useState<number | null>(null)
  // 速度/剩余时间：3 秒滑动窗口采样（与下载进度弹窗共享 hook）
  const { speedMBps, etaSeconds, sample: sampleSpeed, reset: resetSpeed } = useTransferSpeed()
  // 取消控制器（本次传输的 signal 同时登记到传输管理器）
  const abortRef = useRef<AbortController | null>(null)

  // ETA 秒转可读文案（秒/分），单位随语言切换；无效值显示空串（速度行不显示）
  const etaText = (() => {
    if (!Number.isFinite(etaSeconds) || etaSeconds <= 0) return ''
    if (etaSeconds < 60) return `${t('剩余')} ${t('{{n}} 秒', { n: Math.ceil(etaSeconds) })}`
    return `${t('剩余')} ${t('{{n}} 分', { n: Math.ceil(etaSeconds / 60) })}`
  })()

  // beforeunload：仅上传中拦截关闭/刷新；响应回来 setUploading(false) 即解除
  useEffect(() => {
    if (!uploading) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      // 触发浏览器原生离开确认（Chromium 需要 returnValue）
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [uploading])

  /** 重置本次上传的进度状态（每次开始上传前调用） */
  const resetProgress = useCallback(() => {
    setPhase('transferring')
    setLoaded(0)
    setTotal(null)
    resetSpeed()
  }, [resetSpeed])

  /**
   * 执行上传：经传输管理器登记（切页继续、关页提示、真实字节进度）；
   * 成功后短暂展示完成绿条再关闭弹窗（旧实现 800ms 同语义），并回调父级刷新。
   */
  const doUpload = useCallback(
    (file: File) => {
      resetProgress()
      setUploading(true)
      const transfer = beginTransfer({
        tabKey: scope?.scopeKey ?? null,
        kind: 'upload',
        name: file.name,
      })
      const controller = new AbortController()
      abortRef.current = controller
      uploadSystemVersion(
        file,
        (event) => {
          // 真实字节进度上报：total 缺失即不确定进度（走马灯，不伪造百分比）
          const nextTotal = event.total ?? null
          setLoaded(event.loaded)
          setTotal(nextTotal)
          transfer.setProgress(event.loaded, nextTotal)
          sampleSpeed(event.loaded, nextTotal)
          // 字节发完即切「等待服务器处理」阶段（服务端落盘/校验耗时不受限制）；
          // total 未知时 loaded 到不了 total，走马灯保持到 done——可接受
          if (nextTotal !== null && nextTotal > 0 && event.loaded >= nextTotal) {
            setPhase('processing')
            // 传输管理器同步进入「服务端处理中」（100% 后仍可显示处理状态）
            transfer.markProcessing()
          }
        },
        { signal: transfer.signal },
      )
        .then(() => {
          setPhase('done')
          transfer.succeed()
          message.success(t('更新版本包成功'))
          onSucceeded()
          // 短暂展示「上传完成」绿条后关闭弹窗（旧实现同语义）
          setTimeout(() => setUploading(false), 800)
        })
        .catch((error: unknown) => {
          setUploading(false)
          if (isCancelledError(error)) {
            // 主动取消：info 级提示（非错误），传输登记按取消语义收尾
            transfer.fail(t('已取消上传'))
            message.info(t('已取消上传'))
            return
          }
          const reason = t('更新版本包出错：{{msg}}', { msg: apiErrorMessage(error) })
          transfer.fail(reason)
          message.error(reason)
        })
        .finally(() => {
          abortRef.current = null
        })
    },
    [message, onSucceeded, resetProgress, sampleSpeed, scope, t],
  )

  /** 选择文件即开始上传：仅允许 .zip（accept 仅过滤选择器，此处再校验扩展名） */
  const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      message.warning(t('仅支持上传 .zip 格式的版本包'))
      return Upload.LIST_IGNORE
    }
    doUpload(file)
    // 返回 false 阻止 antd 自动上传（传输已由 doUpload 手动发起）
    return false
  }

  /** 取消上传：二次确认后中止（已传部分被丢弃，需重新选择文件上传） */
  const handleCancel = useCallback(() => {
    modal.confirm({
      title: t('确认取消上传？'),
      content: t('已上传的部分将被丢弃，需要重新选择文件上传。'),
      okText: t('取消上传'),
      okButtonProps: { danger: true },
      cancelText: t('继续上传'),
      onOk: () => {
        abortRef.current?.abort()
      },
    })
  }, [modal, t])

  return (
    <>
      {/* 上传入口：选择 .zip 即开始（上传中按钮 loading 防重复选择） */}
      <Upload accept=".zip" name="file" showUploadList={false} beforeUpload={beforeUpload}>
        <Button type="primary" icon={<UploadCloud size={14} />} loading={uploading}>
          {t('更新版本包')}
        </Button>
      </Upload>
      {/* 上传进度弹窗：真实进度 + 阶段文案；done 阶段不渲染取消按钮 */}
      <TransferProgressModal
        open={uploading}
        title={t('正在上传版本包')}
        phase={phase}
        loaded={loaded}
        total={total}
        speedMBps={speedMBps}
        etaText={etaText}
        statusText={
          phase === 'done'
            ? t('上传完成')
            : phase === 'processing'
              ? t('上传完成，等待服务器处理版本包，请勿关闭页面...')
              : t('版本包上传中，请勿关闭页面...')
        }
        cancelLabel={phase === 'done' ? null : t('取消上传')}
        onCancel={handleCancel}
      />
    </>
  )
}
