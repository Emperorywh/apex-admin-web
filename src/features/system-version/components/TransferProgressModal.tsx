/**
 * 版本包传输进度弹窗（P25；上传/下载共用的真实进度呈现，替代旧实现下载侧的
 * FakeProgressModal 伪进度条——任务卡明确移除伪进度，仅呈现真实字节进度）。
 *
 * 呈现纪律（规格 10.5 / G11）：
 * - 已知总字节（total 非空且 >0）才显示百分比与剩余时间；未知总字节降级为
 *   走马灯不确定进度，仅显示已传输字节，不伪造百分比；
 * - 「传输完成 ≠ 处理完成」：上传侧 100% 后进入 processing 阶段（等待服务端
 *   落盘/校验），由调用方切换 phase，本组件按阶段呈现文案，不提前宣布成功；
 * - 组件为纯展示：进度数值、速度、阶段文案全部来自调用方真实回调，本组件
 *   不推进任何模拟进度。
 */

import { Button, Modal, Progress } from 'antd'

/** 字节转 MB 字符串（保留两位；无效值按 0 MB 呈现）——模块内私有，避免混出导出破坏 fast-refresh */
function formatMB(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB'
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export interface TransferProgressModalProps {
  /** 弹窗可见性（传输中/等待处理为 true，结束由调用方关闭） */
  open: boolean
  /** 弹窗标题（调用方传入已翻译文案） */
  title: string
  /** 传输阶段：transferring 传输中 / processing 已传完等待服务端处理 / done 成功 */
  phase: 'transferring' | 'processing' | 'done'
  /** 已传输字节数（真实进度回调） */
  loaded: number
  /** 总字节数；null/0 表示未知（走马灯不确定进度，不显示百分比） */
  total: number | null
  /** 当前速度 MB/s（>0 才显示；由调用方按滑动窗口计算） */
  speedMBps?: number
  /** 已格式化的剩余时间文案（空串不显示；格式化随语言切换由调用方负责） */
  etaText?: string
  /** 底部阶段说明文案（已翻译） */
  statusText: string
  /** 取消按钮文案；不传或为 null 则不渲染取消入口（done 阶段由调用方传 null） */
  cancelLabel?: string | null
  /** 取消回调（调用方负责中止请求与二次确认） */
  onCancel?: () => void
}

export default function TransferProgressModal({
  open,
  title,
  phase,
  loaded,
  total,
  speedMBps = 0,
  etaText = '',
  statusText,
  cancelLabel,
  onCancel,
}: TransferProgressModalProps) {
  // 已知总字节：百分比由真实字节派生（封顶 100，避免进度事件浮点越界）
  const computable = total !== null && total > 0
  const percent = computable ? Math.min(100, Math.floor((loaded / total) * 100)) : 0

  return (
    <Modal
      title={title}
      open={open}
      /* done 阶段请求已完成：不渲染取消按钮；processing 阶段保留取消入口
         （用户可主动放弃等待服务端响应，旧实现同语义） */
      footer={
        cancelLabel ? (
          <Button danger onClick={onCancel}>
            {cancelLabel}
          </Button>
        ) : null
      }
      closable={false}
      maskClosable={false}
      centered
    >
      <div style={{ padding: '20px 0' }}>
        {computable ? (
          // 真实百分比：成功绿色、传输中活跃蓝
          <Progress
            percent={percent}
            status={phase === 'done' ? 'success' : 'active'}
            strokeColor={{ from: '#108ee9', to: '#87d068' }}
          />
        ) : (
          // 未知总字节：走马灯不确定进度（antd 以 percent=99 + active 模拟），
          // 不显示百分比与剩余时间，仅呈现已传输字节（不造假）
          <Progress percent={99} status="active" strokeColor={{ from: '#108ee9', to: '#87d068' }} />
        )}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 8,
            color: '#666',
            fontSize: 12,
          }}
        >
          <span>
            {computable
              ? `${formatMB(loaded)} / ${formatMB(total ?? 0)}`
              : `${formatMB(loaded)}`}
          </span>
          <span>
            {computable && speedMBps > 0 && etaText
              ? `${speedMBps.toFixed(2)} MB/s · ${etaText}`
              : ''}
          </span>
        </div>
        <p style={{ textAlign: 'center', marginTop: 12, color: '#999' }}>{statusText}</p>
      </div>
    </Modal>
  )
}
