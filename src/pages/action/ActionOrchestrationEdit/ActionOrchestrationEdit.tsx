import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useBlocker, useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { App, Badge, Button, ConfigProvider, Input, Modal, Tag, Tooltip } from 'antd'
import { Background, BackgroundVariant, MiniMap, ReactFlow, ReactFlowProvider, SelectionMode, addEdge, applyEdgeChanges, applyNodeChanges, useNodesInitialized, useReactFlow, type Connection, type XYPosition } from '@xyflow/react'
import { ArrowLeft, Braces, Check, CheckCheck, CircleHelp, Download, GitBranch, Hand, LayoutGrid, Maximize, Minus, MousePointer2, PanelRightClose, Play, Plus, Redo2, Save, Undo2, Workflow, X } from 'lucide-react'
import { ROUTE_PATHS } from '@/router/definitions'
import { initialCombinations } from '@/features/action/action.model'
import { useAxisMotors } from '@/features/axis-motor/hooks/useAxisMotors'
import { canConnect, createWorkflowDocument, createWorkflowNode, layoutWorkflow, validateWorkflow, type ActionPreset, type WorkflowDocument, type WorkflowNode, type WorkflowNodeData, type WorkflowEdge } from '@/features/action/workflow.model'
import { useWorkflowHistory } from '@/features/action/useWorkflowHistory'
import { WorkflowIcon } from '@/features/action/components/WorkflowIcon/WorkflowIcon'
import { WorkflowNodeCard } from '@/features/action/components/WorkflowNodeCard/WorkflowNodeCard'
import { WorkflowNodeActions } from '@/features/action/workflow.context'
import { WorkflowInspector } from '@/features/action/components/WorkflowInspector/WorkflowInspector'
import { WorkflowPicker } from '@/features/action/components/WorkflowPicker/WorkflowPicker'
import { WorkflowEdge as WorkflowEdgeView } from '@/features/action/components/WorkflowEdge/WorkflowEdge'
import { buildWorkflowEditorTheme, workflowEditorVariables } from './actionOrchestrationEdit.theme'
import '@xyflow/react/dist/style.css'
import styles from './ActionOrchestrationEdit.module.css'

/** 固定节点映射避免每次编辑重建画布节点组件。 */
const nodeTypes = { workflow: WorkflowNodeCard }
const edgeTypes = { smoothstep: WorkflowEdgeView }
interface PickerState { position: XYPosition; flowPosition: XYPosition; source?: string; handle?: string }

/** 导出和变更比较使用业务快照；选择、拖动标记和尺寸测量不属于用户修改。 */
function cleanDocument(document: WorkflowDocument): WorkflowDocument {
  return { ...document, nodes: document.nodes.map(({ selected: _selected, dragging: _dragging, measured: _measured, ...node }) => node), edges: document.edges.map(({ selected: _selected, ...edge }) => edge) }
}

/** 按实际内容判断是否有修改，撤销回初始状态后不再触发离开提醒。 */
function documentFingerprint(document: WorkflowDocument) {
  return JSON.stringify(cleanDocument(document))
}

/** 标识只用于选择预制组合；新建文档不写入地址或缓存，避免初始导航触发离开拦截。 */
export default function ActionOrchestrationEdit() {
  const [params] = useSearchParams()
  const [newId] = useState(() => `workflow-${crypto.randomUUID()}`)
  const id = params.get('id') || newId
  return <WorkflowSession key={id} id={id} />
}

/** 每次进入编辑器从当前预制数据建立会话，卸载后全部编辑状态自然释放。 */
function WorkflowSession({ id }: { id: string }) {
  const [initial] = useState(() => createWorkflowDocument(id, initialCombinations.find((item) => item.id === id)))
  return <ReactFlowProvider><WorkflowEditor initial={initial} /></ReactFlowProvider>
}

/** 顶部操作、画布和配置面板共享单一文档；视口及面板开关独立于可撤销的业务状态。 */
function WorkflowEditor({ initial }: { initial: WorkflowDocument }) {
  const { t } = useTranslation('action')
  // 页面专用色板只创建一次；挂载到 body 的对话框也接收局部变量，保持正文与表单的配色一致。
  const editorTheme = useMemo(buildWorkflowEditorTheme, [])
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { document: workflow, change, undo, redo, checkpoint, canUndo, canRedo } = useWorkflowHistory(initial)
  // 轴配置与电机页面读取同一份当前数据；读取异常时不允许用默认值验证实际绑定。
  const { motors: configuredMotors, storageWarning: motorStorageWarning } = useAxisMotors()
  const motors = useMemo(() => motorStorageWarning ? [] : configuredMotors, [configuredMotors, motorStorageWarning])
  const flow = useReactFlow<WorkflowNode, WorkflowEdge>()
  const initialized = useNodesInitialized()
  const fitted = useRef(false)
  const canvasRef = useRef<HTMLDivElement>(null)
  const latest = useRef(workflow)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [picker, setPicker] = useState<PickerState | null>(null)
  // 默认启用拖动画布，进入编辑器后即可拖拽浏览流程；框选时再切换选择工具。
  const [tool, setTool] = useState<'select' | 'hand'>('hand')
  const [zoom, setZoom] = useState(1)
  const [showMap, setShowMap] = useState(true)
  const [preview, setPreview] = useState(false)
  const [variables, setVariables] = useState(false)
  const [help, setHelp] = useState(false)
  const [pendingNodeChanges, setPendingNodeChanges] = useState(false)
  const initialFingerprint = useMemo(() => documentFingerprint(initial), [initial])
  const fingerprint = useMemo(() => documentFingerprint(workflow), [workflow])
  const dirty = pendingNodeChanges || fingerprint !== initialFingerprint
  // 统一拦截返回按钮、浏览器后退及站内地址切换；继续编辑保持同一份会话。
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search))
  const selected = workflow.nodes.find((node) => node.id === selectedId)
  const issues = useMemo(() => validateWorkflow(workflow, motors), [workflow, motors])
  const start = workflow.nodes.find((node) => node.data.kind === 'start')

  /** 程序化定位同步画布选择态，防止从“下一步”跳转后两个节点同时保持选中。 */
  const selectNode = useCallback((nodeId: string | null) => {
    setSelectedId(nodeId)
    change((current) => ({ ...current, nodes: current.nodes.map((node) => ({ ...node, selected: node.id === nodeId })) }), false)
  }, [change])

  // 最新引用仅供当前画布事件使用，不写入浏览器存储，卸载后不会保留。
  useEffect(() => { latest.current = workflow }, [workflow])
  // 刷新和关闭标签无法显示应用弹窗，交由浏览器提供原生离开确认；无修改时不注册监听。
  useEffect(() => {
    if (!dirty) return
    const warnBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [dirty])

  /** 分支删除时同时移除无效端口连线，所有修改仅维护当前会话。 */
  const updateData = (data: Partial<WorkflowNodeData>) => change((current) => {
    const nodes = current.nodes.map((node) => node.id === selectedId ? { ...node, data: { ...node.data, ...data } } : node)
    const edges = data.branches ? current.edges.filter((edge) => edge.source !== selectedId || edge.sourceHandle === 'else' || data.branches!.some((branch) => branch.id === edge.sourceHandle)) : current.edges
    return { ...current, nodes, edges }
  })

  /** 轴参数应用到当前节点并进入撤销历史，不执行本地或服务端保存。 */
  const applyNodeData = (data: Partial<WorkflowNodeData>): boolean => {
    if (!selectedId) return false
    const next = { ...workflow, nodes: workflow.nodes.map((node) => node.id === selectedId ? { ...node, data: { ...node.data, ...data } } : node) }
    latest.current = next
    change(() => next)
    return true
  }

  /** 开始节点不可删除；删除其他节点时同步清除入边和出边。 */
  const deleteNode = useCallback((nodeId: string) => {
    change((current) => {
      if (current.nodes.find((node) => node.id === nodeId)?.data.kind === 'start') return current
      return { ...current, nodes: current.nodes.filter((node) => node.id !== nodeId), edges: current.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId) }
    })
    setSelectedId((current) => current === nodeId ? null : current)
  }, [change])

  /** 复制节点复用参数但分配新标识；不复制连线，避免改变已有执行路径。 */
  const duplicateNode = useCallback((nodeId: string) => {
    const source = latest.current.nodes.find((node) => node.id === nodeId)
    if (!source || source.data.kind === 'start') return
    const copy = { ...structuredClone(source), id: crypto.randomUUID(), position: { x: source.position.x + 50, y: source.position.y + 170 }, selected: true }
    change((current) => ({ ...current, nodes: [...current.nodes.map((node) => ({ ...node, selected: false })), copy] }))
    setSelectedId(copy.id)
  }, [change])

  /** 浮层采用画布内坐标，节点采用流程坐标，保证不同缩放下都落在指定位置。 */
  const openPicker = useCallback((position?: XYPosition, source?: string, handle = 'output') => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const point = position ?? { x: Math.min(rect.width / 2, 520), y: 90 }
    const node = latest.current.nodes.find((item) => item.id === source)
    setPicker({ position: point, source, handle, flowPosition: node && !position ? { x: node.position.x + 330, y: node.position.y + (handle === 'else' ? 200 : 0) } : flow.screenToFlowPosition({ x: rect.left + point.x, y: rect.top + point.y }) })
  }, [flow])
  const addNext = useCallback((nodeId: string, handle: string) => openPicker(undefined, nodeId, handle), [openPicker])

  /** 从已有出口追加时插入当前路径；结束节点只能添加到空闲出口。 */
  const addNode = (preset: ActionPreset) => {
    if (!picker) return
    const previous = workflow.edges.find((edge) => edge.source === picker.source && edge.sourceHandle === picker.handle)
    if (previous && preset.kind === 'end') { void message.warning(t('已连接的路径不能插入结束节点，请从空闲出口添加')); return }
    const node = createWorkflowNode(preset.kind, picker.flowPosition, preset.id)
    node.selected = true
    change((current) => {
      let edges = current.edges
      if (picker.source) {
        edges = edges.filter((edge) => edge.id !== previous?.id)
        edges = addEdge({ id: crypto.randomUUID(), source: picker.source, sourceHandle: picker.handle, target: node.id, targetHandle: 'input' }, edges)
        if (previous) edges = addEdge({ ...previous, id: crypto.randomUUID(), source: node.id, sourceHandle: node.data.kind === 'condition' ? node.data.branches[0].id : 'output' }, edges)
      }
      return { ...current, nodes: [...current.nodes.map((item) => ({ ...item, selected: false, position: previous && item.position.x >= node.position.x ? { ...item.position, x: item.position.x + 330 } : item.position })), node], edges }
    })
    setSelectedId(node.id); setPicker(null)
  }

  /** 拒绝环、自连和重复占用输出端口的连线，确保图可用于顺序执行。 */
  const connect = (connection: Connection) => {
    if (!canConnect(workflow.nodes, workflow.edges, connection)) return
    change((current) => ({ ...current, edges: addEdge({ ...connection, id: crypto.randomUUID() }, current.edges) }))
  }
  const fit = useCallback(() => { void flow.fitView({ padding: .22, maxZoom: 1, duration: 260 }) }, [flow])
  // 等待所有自定义节点完成测量后适配视口，避免首次加载只显示开始节点。
  useEffect(() => {
    if (initialized && !fitted.current) { fitted.current = true; fit() }
  }, [initialized, fit])
  // 配置面板打开后若遮挡选中节点，将该节点平移至剩余画布中，不改变用户缩放比例。
  useEffect(() => {
    const node = latest.current.nodes.find((item) => item.id === selectedId)
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!node || !rect) return
    const point = flow.flowToScreenPosition(node.position)
    const nodeHeight = node.measured?.height ?? 130
    const currentZoom = flow.getZoom()
    if (point.x < rect.left + 70 || point.x + 236 * currentZoom > rect.right - 30 || point.y < rect.top + 50 || point.y + nodeHeight * currentZoom > rect.bottom - 80) {
      void flow.setCenter(node.position.x + 118, node.position.y + nodeHeight / 2, { zoom: currentZoom, duration: 240 })
    }
  }, [selectedId, flow])

  /** 导出当前完整图结构，并在浏览器开始下载后释放临时对象 URL。 */
  const exportDocument = () => {
    const document = cleanDocument(workflow)
    const url = URL.createObjectURL(new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' }))
    const anchor = window.document.createElement('a')
    anchor.href = url; anchor.download = `${workflow.name.replace(/[<>:"/\\|?*]/g, '_') || 'workflow'}.json`; anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  /** 保存入口先检查待应用参数和流程；接口尚未接入时如实提示，不修改未保存状态或写入缓存。 */
  const saveDocument = useCallback(() => {
    if (pendingNodeChanges) {
      void message.warning(t('请先应用当前节点的配置，再保存流程'))
      return
    }
    if (issues.length) {
      setPreview(true)
      void message.warning(t('流程检查未通过，请先完善配置后再保存'))
      return
    }
    void message.info(t('流程检查通过，保存接口暂未接入，可先导出流程 JSON 保留文件'))
  }, [issues.length, message, pendingNodeChanges, t])

  // 保存快捷键在输入时也可使用，但弹窗打开时让出操作；其他快捷键继续避开输入区，卸载时清理监听。
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      const typing = target.closest('input, textarea, [contenteditable="true"], [role="combobox"]')
      const command = event.ctrlKey || event.metaKey
      if (command && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (!event.repeat && !variables && !help && blocker.state !== 'blocked') saveDocument()
        return
      }
      if (typing || preview || variables || help || blocker.state === 'blocked') return
      if (command && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo() }
      else if (command && event.key.toLowerCase() === 'y') { event.preventDefault(); redo() }
      else if (command && event.key.toLowerCase() === 'd' && selectedId) { event.preventDefault(); duplicateNode(selectedId) }
      else if (event.key === 'Escape') { setPicker(null); selectNode(null) }
      else if (event.key.toLowerCase() === 'v') setTool('select')
      else if (event.key.toLowerCase() === 'h') setTool('hand')
      else if (event.key === 'Tab' && target.closest('.react-flow')) { event.preventDefault(); openPicker() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [saveDocument, undo, redo, selectedId, duplicateNode, openPicker, preview, variables, help, selectNode, blocker.state])

  const actions = useMemo(() => ({ onAdd: addNext, onDuplicate: duplicateNode, onDelete: deleteNode }), [addNext, duplicateNode, deleteNode])
  // 提示层不拦截鼠标，底部提示向上展开，避免撤销提示遮住相邻重做按钮。
  const toolButton = (label: string, icon: ReactNode, onClick: () => void, active = false, disabled = false, placement: 'top' | 'right' = 'top') => <Tooltip title={t(label)} placement={placement} classNames={{ root: styles.toolTooltip }}><Button type="text" className={active ? styles.activeTool : ''} aria-label={t(label)} icon={icon} onClick={onClick} disabled={disabled} /></Tooltip>

  return <ConfigProvider theme={editorTheme} modal={{ styles: { root: workflowEditorVariables } }}><main className={styles.editor} style={workflowEditorVariables}>
    {/* 保存是顶栏主操作，导出保留文件；当前保存入口只校验并提示，状态仍准确标明离开后不保留。 */}
    <header className={styles.header}>
      <Button type="text" aria-label={t('返回动作编排')} icon={<ArrowLeft size={18} />} onClick={() => void navigate(ROUTE_PATHS['action-orchestration'])} />
      <div className={styles.brandIcon}><Workflow size={21} /></div>
      <div className={styles.documentInfo}>
        {/* 新增名称为空，以占位提示引导填写，不自动写入示例业务名称。 */}
        <Input variant="borderless" maxLength={60} aria-label={t('流程名称')} placeholder={t('请输入流程名称')} value={workflow.name} onChange={(event) => { const name = event.target.value; change((current) => ({ ...current, name })) }} />
        <div className={styles.editState}><span className={dirty ? styles.warningDot : styles.idleDot} />{dirty ? t('有未保存的修改') : t('尚未修改')}<span>·</span>{t('离开后不保留')}</div>
      </div>
      <div className={styles.headerCenter}><span className={styles.headerTab}>{t('编排')}</span></div>
      <div className={styles.headerActions}>
        <Button icon={<Play size={14} />} onClick={() => setPreview(true)}>{t('预览')}</Button>
        <Tooltip title={t('检查流程')}><Button aria-label={t('检查流程')} icon={<CheckCheck size={16} />} onClick={() => setPreview(true)}><Badge count={issues.length} size="small" /></Button></Tooltip>
        <div className={styles.headerDivider} />
        <Tooltip title={t('导出流程 JSON')}><Button className={styles.exportButton} aria-label={t('导出流程 JSON')} icon={<Download size={14} />} onClick={exportDocument}><span className={styles.exportLabel}>{t('导出流程 JSON')}</span></Button></Tooltip>
        <Tooltip title={t('保存 (Ctrl+S)')}><Button type="primary" icon={<Save size={14} />} aria-keyshortcuts="Control+s Meta+s" onClick={saveDocument}>{t('保存')}</Button></Tooltip>
      </div>
    </header>
    <div className={styles.workspace}>
      <section ref={canvasRef} className={styles.canvas} aria-label={t('动作编排画布')} onKeyDownCapture={(event) => {
        // 原生方向键移动不触发拖拽事件，在选中节点接收该按键前建立独立历史快照。
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key) && (event.target as HTMLElement).matches('.react-flow__node, .react-flow__nodesselection-rect') && workflow.nodes.some((node) => node.selected)) checkpoint()
      }}>
        <WorkflowNodeActions.Provider value={actions}>
          <ReactFlow<WorkflowNode, WorkflowEdge>
            nodes={workflow.nodes.map((node) => ({ ...node, deletable: node.data.kind !== 'start' }))}
            edges={workflow.edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} colorMode="dark" fitView fitViewOptions={{ padding: .22, maxZoom: 1 }} minZoom={.25} maxZoom={1.5}
            defaultEdgeOptions={{ type: 'smoothstep', style: { stroke: 'var(--app-blue)', strokeWidth: 1.5 }, interactionWidth: 22 }}
            onNodesChange={(changes) => {
              const relevant = changes.filter((item) => !(item.type === 'remove' && workflow.nodes.find((node) => node.id === item.id)?.data.kind === 'start'))
              if (!relevant.length) return
              change((current) => ({ ...current, nodes: applyNodeChanges(relevant, current.nodes), edges: current.edges.filter((edge) => !relevant.some((item) => item.type === 'remove' && (edge.source === item.id || edge.target === item.id))) }), false)
            }}
            onEdgesChange={(changes) => change((current) => ({ ...current, edges: applyEdgeChanges(changes, current.edges) }), false)}
            onBeforeDelete={({ nodes, edges }) => { if (nodes.length || edges.length) checkpoint(); return Promise.resolve(true) }}
            onNodeDragStart={checkpoint} onNodeClick={(_, node) => { setSelectedId(node.id); setPicker(null) }}
            onPaneClick={() => { setSelectedId(null); setPicker(null) }}
            onPaneContextMenu={(event) => { event.preventDefault(); const rect = canvasRef.current!.getBoundingClientRect(); openPicker({ x: event.clientX - rect.left, y: event.clientY - rect.top }) }}
            onConnect={connect} isValidConnection={(connection) => canConnect(workflow.nodes, workflow.edges, { ...connection, sourceHandle: connection.sourceHandle ?? null, targetHandle: connection.targetHandle ?? null })}
            onConnectEnd={(event, state) => {
              if (state.isValid || !state.fromNode || state.fromHandle?.type !== 'source') return
              const target = event.target as HTMLElement
              if (!target.closest('.react-flow__pane')) return
              const point = 'changedTouches' in event ? event.changedTouches[0] : event
              const rect = canvasRef.current!.getBoundingClientRect()
              openPicker({ x: point.clientX - rect.left, y: point.clientY - rect.top }, state.fromNode.id, state.fromHandle.id ?? 'output')
            }}
            onMove={(_, viewport) => setZoom(viewport.zoom)} panOnDrag={tool === 'hand' ? true : [1, 2]} selectionOnDrag={tool === 'select'} selectionMode={SelectionMode.Partial}
            // 滚轮以鼠标位置为中心缩放画布，平移继续由拖拽操作完成。
            panOnScroll={false} zoomOnScroll
            deleteKeyCode={picker || preview || variables || help || blocker.state === 'blocked' ? null : ['Backspace', 'Delete']}
            attributionPosition="top-right"
            ariaLabelConfig={{ 'node.a11yDescription.default': t('按方向键移动节点，Delete 删除节点，Escape 取消选择'), 'node.a11yDescription.keyboardDisabled': t('点击节点编辑配置'), 'edge.a11yDescription.default': t('选中连线后按 Delete 删除'), 'controls.ariaLabel': t('画布控制'), 'minimap.ariaLabel': t('流程缩略图') }}
          >
            {/* 点阵沿用原有暗色背景的对比度；缩略图单独使用较轻遮罩，让流程位置保持清楚。 */}
            <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="var(--app-canvas-dot)" />
            {showMap && <MiniMap className={styles.minimap} pannable zoomable nodeColor="var(--app-track)" nodeStrokeColor="var(--app-blue)" maskColor="var(--app-minimap-mask)" />}
          </ReactFlow>
        </WorkflowNodeActions.Provider>
        <div className={styles.canvasCaption}><GitBranch size={13} /><span>{t('工作流')}</span><span className={styles.captionDivider}>/</span>{t('{{count}} 个节点', { count: workflow.nodes.length })}</div>
        <div className={styles.toolbar}>
          {toolButton('添加节点', <Plus size={18} />, () => openPicker({ x: 70, y: 110 }), false, false, 'right')}
          <span className={styles.toolDivider} />
          {toolButton('选择工具 (V)', <MousePointer2 size={17} />, () => setTool('select'), tool === 'select', false, 'right')}
          {toolButton('拖动画布 (H)', <Hand size={17} />, () => setTool('hand'), tool === 'hand', false, 'right')}
          <span className={styles.toolDivider} />
          {toolButton('自动整理', <LayoutGrid size={17} />, () => { change((current) => ({ ...current, nodes: layoutWorkflow(current.nodes, current.edges) })); window.requestAnimationFrame(fit) }, false, false, 'right')}
          {toolButton('快捷键', <CircleHelp size={17} />, () => setHelp(true), false, false, 'right')}
        </div>
        <div className={styles.historyControls}>{toolButton('撤销 (Ctrl+Z)', <Undo2 size={15} />, undo, false, !canUndo)}{toolButton('重做 (Ctrl+Shift+Z)', <Redo2 size={15} />, redo, false, !canRedo)}<span className={styles.verticalDivider} />{toolButton('显示缩略图', <PanelRightClose size={15} />, () => setShowMap((current) => !current), showMap)}</div>
        <button className={styles.variablesButton} onClick={() => setVariables(true)}><Braces size={14} />{t('变量检查')}</button>
        <div className={styles.zoomControls}>{toolButton('缩小', <Minus size={15} />, () => { void flow.zoomOut({ duration: 160 }) })}<button className={styles.zoomValue} title={t('重置为 100%')} onClick={() => { void flow.zoomTo(1, { duration: 160 }) }}>{Math.round(zoom * 100)}%</button>{toolButton('放大', <Plus size={15} />, () => { void flow.zoomIn({ duration: 160 }) })}<span className={styles.verticalDivider} />{toolButton('适应画布', <Maximize size={15} />, fit)}</div>
        {!selected && <span className={styles.canvasHint}>{t('拖拽连接节点 · 点击节点配置 · 右键添加节点')}</span>}
        {picker && <WorkflowPicker position={picker.position} onClose={() => setPicker(null)} onSelect={addNode} />}
      </section>
      {selected && <WorkflowInspector key={selected.id} node={selected} nodes={workflow.nodes} edges={workflow.edges} motors={motors} motorStorageWarning={!!motorStorageWarning} onApply={applyNodeData} onPendingChange={setPendingNodeChanges} onChange={updateData} onClose={() => selectNode(null)} onDelete={() => deleteNode(selected.id)} onDuplicate={() => duplicateNode(selected.id)} onAddNext={(handle) => addNext(selected.id, handle)} onSelectNode={selectNode} onDisconnect={(edgeId) => change((current) => ({ ...current, edges: current.edges.filter((edge) => edge.id !== edgeId) }))} />}
      {/* 预览展示真实结构与校验结果，未接入执行引擎时不生成模拟成功日志。 */}
      {preview && <aside className={styles.preview} aria-label={t('流程预览')}><div className={styles.panelTitle}><Play size={17} /><strong>{t('流程预览')}</strong><Button type="text" aria-label={t('关闭预览')} icon={<X size={17} />} onClick={() => setPreview(false)} /></div><div className={styles.previewContent}><Tag color={issues.length ? 'warning' : 'success'}>{issues.length ? t('{{count}} 项待完善', { count: issues.length }) : t('流程检查通过')}</Tag><p className={styles.panelNote}>{t('检查节点配置与执行路径，不触发机器人动作。')}</p>{issues.length > 0 && <div className={styles.issues}>{issues.map((issue, index) => <button key={index} onClick={() => { if (issue.nodeId) selectNode(issue.nodeId); setPreview(false) }}>{t(issue.message)}</button>)}</div>}<h3>{t('节点概览')}</h3><div className={styles.previewNodes}>{workflow.nodes.map((node, index) => <button key={node.id} onClick={() => { selectNode(node.id); setPreview(false) }}><span className={styles.nodeIndex}>{String(index + 1).padStart(2, '0')}</span><WorkflowIcon kind={node.data.kind} /><span>{t(node.data.label)}</span>{issues.some((issue) => issue.nodeId === node.id) ? <span className={styles.warningDot} /> : <Check size={13} />}</button>)}</div><div className={styles.previewFoot}><span>{t('编辑状态')}</span><strong>{t('仅当前页面有效')}</strong></div></div></aside>}
    </div>
    <Modal open={variables} title={t('变量检查')} onCancel={() => setVariables(false)} footer={null} width={560}><p className={styles.panelNote}>{t('开始节点定义流程输入；其他节点按类型提供输出变量。')}</p><div className={styles.variableList}>{start?.data.inputs.map((input) => <div key={input.id}><code>{input.name}</code><Tag>{input.type}</Tag><span>{input.required ? t('必填') : t('可选')}</span></div>)}{!start?.data.inputs.length && <p>{t('暂无输入变量，可在开始节点中添加')}</p>}{workflow.nodes.filter((node) => node.data.kind === 'action' || node.data.kind === 'http').map((node) => <div key={node.id}><code>{t(node.data.label)} / {node.data.kind === 'http' ? 'status_code' : 'success'}</code><Tag>{node.data.kind === 'http' ? 'number' : 'boolean'}</Tag></div>)}</div></Modal>
    {/* 帮助与实际键盘处理保持一致，保存按钮和快捷键共用同一套校验与提示。 */}
    <Modal open={help} title={t('快捷键')} onCancel={() => setHelp(false)} footer={null} width={440}><div className={styles.shortcuts}>{[['保存', 'Ctrl / ⌘ + S'], ['选择工具', 'V'], ['拖动画布', 'H'], ['撤销', 'Ctrl / ⌘ + Z'], ['重做', 'Ctrl / ⌘ + Shift + Z'], ['复制节点', 'Ctrl / ⌘ + D'], ['删除选中节点或连线', 'Delete'], ['取消选择', 'Esc']].map(([label, key]) => <div key={key}><span>{t(label)}</span><kbd>{key}</kbd></div>)}</div></Modal>
    {/* 站内离开由路由拦截统一确认；取消保留全部表单和画布状态，确认后才执行原导航。 */}
    <Modal open={blocker.state === 'blocked'} title={t('离开动作编辑？')} okText={t('放弃修改并离开')} cancelText={t('继续编辑')} okButtonProps={{ danger: true }} onOk={() => { if (blocker.state === 'blocked') blocker.proceed() }} onCancel={() => { if (blocker.state === 'blocked') blocker.reset() }}>
      <p>{t('当前有未保存的修改，离开后将丢失。确定要离开吗？')}</p>
    </Modal>
  </main></ConfigProvider>
}
