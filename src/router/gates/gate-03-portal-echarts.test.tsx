/**
 * §20 技术闸门 ③：Portal 与 ECharts。
 *
 * 验证 Activity 页面在 jsdom 下的 DOM 型副作用规则（§9.2 / §15）：
 * - antd 下拉层通过 getPopupContainer 挂到页面容器，页面隐藏时随容器隐藏，
 *   重新显示后不产生残留副本；
 * - 挂到 body 的 Modal 由宿主在页面隐藏前显式关闭，隐藏期间 body 无残留，
 *   重新显示后页面状态保留且 Modal 保持关闭；
 * - 图表实例跨隐藏/显示保留，隐藏期间暂停 resize，重新激活后在
 *   下一 animation frame 以当前容器尺寸执行 resize。
 *
 * ECharts 断言按任务约定以 stub resize 契约实现（真实 useECharts 由后续任务实现），
 * antd Portal 使用真实组件验证。
 */
import { Activity, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Modal, Select } from 'antd'
import { describe, expect, it } from 'vitest'

// ── 图表 stub：记录 init 尺寸、resize 次数与当前尺寸 ──

interface ContainerSize {
  width: number
  height: number
}

interface StubChart {
  width: number
  height: number
  resizeCalls: number
  disposed: boolean
  resize(): void
  dispose(): void
}

/** 测试通过修改 size 对象模拟容器尺寸变化（jsdom 无真实布局） */
function stubContainerSize(el: HTMLElement, size: ContainerSize): void {
  Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => size.width })
  Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => size.height })
}

function createStubChart(el: HTMLElement): StubChart {
  const chart: StubChart = {
    width: el.clientWidth,
    height: el.clientHeight,
    resizeCalls: 0,
    disposed: false,
    resize() {
      chart.resizeCalls += 1
      chart.width = el.clientWidth
      chart.height = el.clientHeight
    },
    dispose() {
      chart.disposed = true
    },
  }
  return chart
}

/** 下一 animation frame 调度；jsdom 未提供 rAF 时退化为 16ms 定时器 */
function nextFrame(callback: () => void): () => void {
  if (typeof requestAnimationFrame === 'function') {
    const handle = requestAnimationFrame(callback)
    return () => cancelAnimationFrame(handle)
  }
  const timer = setTimeout(callback, 16)
  return () => clearTimeout(timer)
}

async function flushFrames(count = 1): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    await new Promise<void>((resolve) => {
      nextFrame(resolve)
    })
  }
}

/** 图表页面探针：实例存于 ref 跨隐藏/显示保留（§9.2 隐藏时暂停而非销毁） */
function ChartProbe({
  chartRef,
  size,
}: {
  chartRef: RefObject<StubChart | null>
  size: ContainerSize
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const instanceRef = useRef<StubChart | null>(null)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return undefined
    stubContainerSize(el, size)
    if (!instanceRef.current) {
      instanceRef.current = createStubChart(el)
    }
    chartRef.current = instanceRef.current
    // §15 契约：激活（含重新激活）后在下一 animation frame 执行一次 resize
    const cancel = nextFrame(() => {
      instanceRef.current?.resize()
    })
    return () => {
      cancel()
      chartRef.current = null
    }
  }, [chartRef, size])
  return <div ref={containerRef} data-testid="chart-container" />
}

function ChartCacheHost({
  active,
  chartRef,
  size,
}: {
  active: boolean
  chartRef: RefObject<StubChart | null>
  size: ContainerSize
}) {
  return (
    <Activity mode={active ? 'visible' : 'hidden'}>
      <ChartProbe chartRef={chartRef} size={size} />
    </Activity>
  )
}

// ── Portal：antd 下拉与 Modal ──

/** 下拉页面探针：下拉层通过 getPopupContainer 挂到页面容器（§9.2） */
function DropdownCacheHost({ active, open }: { active: boolean; open: boolean }) {
  const pageRef = useRef<HTMLDivElement | null>(null)
  return (
    <Activity mode={active ? 'visible' : 'hidden'}>
      <div ref={pageRef} data-testid="dropdown-page">
        <Select
          open={open}
          value="alice"
          options={[{ value: 'alice' }, { value: 'bob' }]}
          getPopupContainer={() => pageRef.current ?? document.body}
        />
      </div>
    </Activity>
  )
}

/**
 * Modal 页面宿主：Modal 挂在 body（无法局部挂载），
 * 页面隐藏前必须先关闭（§9.2），由宿主在隐藏前显式执行 close-before-hide。
 */
function ModalCacheHost({ active, modalOpen }: { active: boolean; modalOpen: boolean }) {
  const [text, setText] = useState('')
  return (
    <Activity mode={active ? 'visible' : 'hidden'}>
      <div data-testid="modal-page">
        <input
          aria-label="modal-page-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <Modal open={modalOpen} title="闸门三" footer={null}>
          demo-modal-content
        </Modal>
      </div>
    </Activity>
  )
}

/** Modal 关闭契约：wrap 被移除，或保留为关闭态（display:none 等不可见形式） */
function expectModalClosed(): void {
  const wrap = document.querySelector('.ant-modal-wrap')
  if (wrap !== null) {
    expect(wrap).not.toBeVisible()
  }
}

describe('§20 闸门 ③：Portal 与 ECharts', () => {
  it('隐藏的图表重新激活后在下一 animation frame 以当前容器尺寸 resize', async () => {
    const chartRef: RefObject<StubChart | null> = { current: null }
    const size: ContainerSize = { width: 300, height: 200 }
    const { rerender } = render(<ChartCacheHost active chartRef={chartRef} size={size} />)

    const chart = chartRef.current
    expect(chart).not.toBeNull()
    expect(chart!.width).toBe(300)
    expect(chart!.height).toBe(200)

    // 首次激活：resize 发生在下一 animation frame
    await flushFrames()
    expect(chart!.resizeCalls).toBe(1)

    // 隐藏：监听暂停，挂起的 resize 被取消，隐藏期间的尺寸变化不触发 resize
    rerender(<ChartCacheHost active={false} chartRef={chartRef} size={size} />)
    size.width = 640
    size.height = 480
    await flushFrames(2)
    expect(chart!.resizeCalls).toBe(1)
    expect(chart!.width).toBe(300)
    expect(chart!.disposed).toBe(false)

    // 重新激活：同步阶段不 resize，实例未被重建；下一 frame 读到当前容器尺寸
    rerender(<ChartCacheHost active chartRef={chartRef} size={size} />)
    expect(chartRef.current).toBe(chart)
    expect(chart!.resizeCalls).toBe(1)
    await flushFrames()
    expect(chart!.resizeCalls).toBe(2)
    expect(chart!.width).toBe(640)
    expect(chart!.height).toBe(480)
  })

  it('局部挂载的下拉层随页面隐藏，不残留到 body，重新显示后无重复副本', async () => {
    const { rerender } = render(<DropdownCacheHost active open />)

    const page = screen.getByTestId('dropdown-page')
    const dropdown = page.querySelector('.ant-select-dropdown')
    expect(dropdown).not.toBeNull()
    // 下拉层位于页面容器内，而不是散落在 body 顶层
    expect(document.querySelectorAll('.ant-select-dropdown')).toHaveLength(1)
    expect(dropdown!.closest('[data-testid="dropdown-page"]')).not.toBeNull()

    // 隐藏页面：页面容器隐藏，下拉随之隐藏，body 顶层无残留
    rerender(<DropdownCacheHost active={false} open />)
    expect((screen.getByTestId('dropdown-page') as HTMLElement).style.display).toBe('none')
    expect(document.querySelectorAll('.ant-select-dropdown')).toHaveLength(1)

    // 重新显示：仍只有一个下拉层，没有残留副本
    rerender(<DropdownCacheHost active open />)
    await waitFor(() => {
      expect((screen.getByTestId('dropdown-page') as HTMLElement).style.display).toBe('')
    })
    expect(document.querySelectorAll('.ant-select-dropdown')).toHaveLength(1)
    expect(
      document.querySelector('.ant-select-dropdown')!.closest('[data-testid="dropdown-page"]'),
    ).not.toBeNull()
  })

  it('Modal 在页面隐藏前被宿主关闭，隐藏期间 body 无残留，重新显示后页面状态保留', async () => {
    const { rerender } = render(<ModalCacheHost active modalOpen={false} />)
    fireEvent.change(screen.getByLabelText('modal-page-input'), { target: { value: 'kept' } })

    // 打开 Modal：挂在 body 门户层且可见
    rerender(<ModalCacheHost active modalOpen />)
    await waitFor(() => {
      expect(document.querySelector('.ant-modal-wrap')).toBeVisible()
    })

    // 隐藏前先关闭（close-before-hide，§9.2 由宿主执行），同一提交内完成；
    // 隐藏期间 body 无可见 Modal 残留
    rerender(<ModalCacheHost active={false} modalOpen={false} />)
    await waitFor(() => {
      expectModalClosed()
    })
    expect((screen.getByTestId('modal-page') as HTMLElement).style.display).toBe('none')
    // 页面状态在隐藏期间保留
    expect((screen.getByLabelText('modal-page-input') as HTMLInputElement).value).toBe('kept')

    // 重新显示：Modal 保持关闭（wrap 缺失或不可见），页面输入状态恢复
    rerender(<ModalCacheHost active modalOpen={false} />)
    expect((screen.getByLabelText('modal-page-input') as HTMLInputElement).value).toBe('kept')
    expectModalClosed()
  })
})
