import { useCallback, useState } from 'react';
import { ReactFlow, Background, Controls, MiniMap, type Node, Panel } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useFlowStore } from '../../store/useFlowStore';
import { useChatStore } from '../../store/useChatStore';
import { useSessionStore } from '../../store/useSessionStore';
import { useAppStore } from '../../store/useAppStore';
import { ProcessNode } from './nodes/ProcessNode';
import { getLayoutedElements } from '../../lib/layout';
import { LayoutDashboard, GitBranch, Play, RotateCcw, X } from 'lucide-react';
import { demoSets } from '../../store/demoData';

const nodeTypes = {
    process: ProcessNode,
};

export function FlowArea() {
    return (
        <div className="h-full w-full bg-slate-50 dark:bg-slate-900">
            <FlowAreaInner />
        </div>
    );
}

function FlowAreaInner() {
    const { activeSessionId } = useSessionStore();
    const {
        getFlowData,
        onNodesChange, onEdgesChange, onConnect,
        setSelectedNodeId,
        selectedNodeId,
        setNodes, setEdges,
        addNode, addEdge,
        loadDemoFlow, resetFlow
    } = useFlowStore();

    const { loadDemoChat, resetChat } = useChatStore();
    const { theme } = useAppStore();
    const [showDemoModal, setShowDemoModal] = useState(false);
    const { nodes, edges } = getFlowData(activeSessionId);

    const onNodeClick = (_: React.MouseEvent, node: Node) => {
        setSelectedNodeId(node.id);
        // Try to find the chat message that generated this node (or closest context)
        // A simple approach is searching DOM for the node's label
        const label = (node.data.label as string) || '';
        if (!label) return;

        // Give React a tick to settle, then find first message element contenant the label text roughly
        setTimeout(() => {
            // Find specific block-level elements instead of whole bubbles
            const blockElements = document.querySelectorAll('.markdown-body p, .markdown-body li, .markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4');
            let targetEl: HTMLElement | null = null;

            for (let i = 0; i < blockElements.length; i++) {
                const el = blockElements[i] as HTMLElement;
                // Exact match with node tag preferred
                if (el.textContent?.includes(`[NODE: ${label}]`) || el.textContent?.includes(label)) {
                    targetEl = el;
                    break;
                }
            }

            if (targetEl) {
                targetEl.style.transition = 'all 0.3s ease';
                // Use a soft blue background to highlight the specific paragraph
                targetEl.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
                targetEl.style.borderRadius = '4px';
                targetEl.style.padding = '4px 8px';
                targetEl.style.margin = '-4px -8px'; // Compensate for padding
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

                setTimeout(() => {
                    targetEl!.style.backgroundColor = 'transparent';
                }, 2000);
            }
        }, 50);
    };

    const onPaneClick = () => {
        setSelectedNodeId(null);
    };

    const onLayout = useCallback((direction: string) => {
        if (!activeSessionId) return;
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
            nodes,
            edges,
            direction
        );

        setNodes(activeSessionId, [...layoutedNodes]);
        setEdges(activeSessionId, [...layoutedEdges]);
    }, [nodes, edges, setNodes, setEdges, activeSessionId]);

    const handleAddChild = () => {
        if (!selectedNodeId || !activeSessionId) return;

        const parentNode = nodes.find(n => n.id === selectedNodeId);
        if (!parentNode) return;

        const newNodeId = Date.now().toString();
        const newNode: Node = {
            id: newNodeId,
            position: {
                x: parentNode.position.x,
                y: parentNode.position.y + 100
            },
            data: { label: '新节点', status: 'pending', branchType: 'sub' },
            type: 'process'
        };

        const newEdge = {
            id: `e${selectedNodeId}-${newNodeId}`,
            source: selectedNodeId,
            target: newNodeId,
            type: 'step'
        };

        addNode(activeSessionId, newNode);
        addEdge(activeSessionId, newEdge);
    };

    const handleLoadDemo = (index: number) => {
        if (!activeSessionId) return;
        loadDemoFlow(activeSessionId, index);
        loadDemoChat(activeSessionId, index);
        setShowDemoModal(false);
        // Auto layout after loading demo
        setTimeout(() => {
            const currentFlow = useFlowStore.getState().getFlowData(activeSessionId);
            const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
                currentFlow.nodes,
                currentFlow.edges,
                'TB'
            );
            setNodes(activeSessionId, [...layoutedNodes]);
            setEdges(activeSessionId, [...layoutedEdges]);
        }, 100);
    };

    return (
        <>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={(changes) => activeSessionId && onNodesChange(activeSessionId, changes)}
                onEdgesChange={(changes) => activeSessionId && onEdgesChange(activeSessionId, changes)}
                onConnect={(conn) => activeSessionId && onConnect(activeSessionId, conn)}
                nodeTypes={nodeTypes}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                defaultEdgeOptions={{ type: 'step' }}
                colorMode={theme === 'dark' ? 'dark' : 'light'}
                fitView
                nodesDraggable={false}
                nodesConnectable={false}
                panOnScroll={true}
                zoomOnScroll={false}
                zoomOnPinch={true}
            >
                <Background />
                <Controls showInteractive={false} />
                <MiniMap pannable={false} zoomable={false} />

                <Panel position="top-right" className="flex gap-2">
                    {/* Demo Button */}
                    <button
                        onClick={() => setShowDemoModal(true)}
                        className="p-2 bg-green-600 text-white shadow-md rounded-md hover:bg-green-700 transition-colors flex items-center gap-1 text-xs font-medium"
                        title="一键加载演示"
                    >
                        <Play className="h-4 w-4" />
                        演示
                    </button>

                    {/* Reset Button */}
                    <button
                        onClick={() => { if (activeSessionId) { resetFlow(activeSessionId); resetChat(activeSessionId); } }}
                        className="p-2 bg-white dark:bg-slate-800 shadow-md rounded-md border hover:bg-slate-50 transition-colors flex items-center gap-1 text-xs font-medium"
                        title="重置"
                    >
                        <RotateCcw className="h-4 w-4" />
                        重置
                    </button>

                    <button
                        onClick={() => onLayout('TB')}
                        className="p-2 bg-white dark:bg-slate-800 shadow-md rounded-md border hover:bg-slate-50 transition-colors flex items-center gap-1 text-xs font-medium"
                        title="自动布局"
                    >
                        <LayoutDashboard className="h-4 w-4" />
                        Layout
                    </button>

                    {selectedNodeId && (
                        <button
                            onClick={handleAddChild}
                            className="p-2 bg-primary text-primary-foreground shadow-md rounded-md hover:bg-primary/90 transition-colors flex items-center gap-1 text-xs font-medium animate-in fade-in zoom-in"
                            title="添加子节点"
                        >
                            <GitBranch className="h-4 w-4" />
                            Add Child
                        </button>
                    )}
                </Panel>
            </ReactFlow>

            {/* Demo Selection Modal */}
            {showDemoModal && (
                <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-4 border-b dark:border-slate-700 pb-2">
                            <h3 className="text-lg font-semibold dark:text-white">选择一个演示场景</h3>
                            <button onClick={() => setShowDemoModal(false)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="space-y-3">
                            {demoSets.map((demo, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleLoadDemo(idx)}
                                    className="w-full text-left p-4 rounded-md border border-slate-200 dark:border-slate-700 hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex items-center gap-3"
                                >
                                    <div className="text-2xl">{demo.title.split(' ')[0]}</div>
                                    <div>
                                        <h4 className="font-medium text-slate-900 dark:text-slate-100">{demo.title.split(' ').slice(1).join(' ')}</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                            包含 {demo.nodes.length} 个节点和代码段剖析
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
