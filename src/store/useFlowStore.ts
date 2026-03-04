import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
    type Connection,
    type Edge,
    type EdgeChange,
    type Node,
    type NodeChange,
    addEdge as xyAddEdge,
    applyNodeChanges,
    applyEdgeChanges,
} from '@xyflow/react';
import { demoSets } from './demoData';
import { getLayoutedElements } from '../lib/layout';

const initialNodes: Node[] = [
    { id: '1', position: { x: 100, y: 100 }, data: { label: '开始' }, type: 'input' },
];
const initialEdges: Edge[] = [];

interface FlowSessionData {
    nodes: Node[];
    edges: Edge[];
}

interface FlowState {
    sessionsData: Record<string, FlowSessionData>;

    selectedNodeId: string | null;
    setSelectedNodeId: (id: string | null) => void;

    // Helpers
    getFlowData: (sessionId: string | null) => FlowSessionData;

    // Handlers (Need sessionId now)
    onNodesChange: (sessionId: string, changes: NodeChange[]) => void;
    onEdgesChange: (sessionId: string, changes: EdgeChange[]) => void;
    onConnect: (sessionId: string, connection: Connection) => void;

    addNode: (sessionId: string, node: Node) => void;
    setNodes: (sessionId: string, nodes: Node[]) => void;
    addEdge: (sessionId: string, edge: Edge) => void;
    setEdges: (sessionId: string, edges: Edge[]) => void;

    // Actions
    loadDemoFlow: (sessionId: string, demoIndex: number) => void;
    resetFlow: (sessionId: string) => void;
    addNodeFromChat: (sessionId: string, label: string, subLabel?: string, parentId?: string, forceNodeId?: string) => void;
    toggleCollapse: (sessionId: string, nodeId: string) => void;
}

export const useFlowStore = create<FlowState>()(
    persist(
        (set, get) => ({
            sessionsData: {},
            selectedNodeId: null,
            setSelectedNodeId: (id: string | null) => set({ selectedNodeId: id }),

            getFlowData: (sessionId) => {
                if (!sessionId) return { nodes: [], edges: [] };
                return get().sessionsData[sessionId] || { nodes: initialNodes, edges: initialEdges };
            },

            onNodesChange: (sessionId, changes) => set((state) => {
                const current = get().getFlowData(sessionId);
                return {
                    sessionsData: {
                        ...state.sessionsData,
                        [sessionId]: {
                            ...current,
                            nodes: applyNodeChanges(changes, current.nodes)
                        }
                    }
                };
            }),

            onEdgesChange: (sessionId, changes) => set((state) => {
                const current = get().getFlowData(sessionId);
                return {
                    sessionsData: {
                        ...state.sessionsData,
                        [sessionId]: {
                            ...current,
                            edges: applyEdgeChanges(changes, current.edges)
                        }
                    }
                };
            }),

            onConnect: (sessionId, connection) => set((state) => {
                const current = get().getFlowData(sessionId);
                return {
                    sessionsData: {
                        ...state.sessionsData,
                        [sessionId]: {
                            ...current,
                            edges: xyAddEdge(connection, current.edges)
                        }
                    }
                };
            }),

            addNode: (sessionId, node) => set((state) => {
                const current = get().getFlowData(sessionId);
                return {
                    sessionsData: {
                        ...state.sessionsData,
                        [sessionId]: { ...current, nodes: [...current.nodes, node] }
                    }
                };
            }),

            setNodes: (sessionId, nodes) => set((state) => {
                const current = get().getFlowData(sessionId);
                return {
                    sessionsData: {
                        ...state.sessionsData,
                        [sessionId]: { ...current, nodes }
                    }
                };
            }),

            addEdge: (sessionId, edge) => set((state) => {
                const current = get().getFlowData(sessionId);
                return {
                    sessionsData: {
                        ...state.sessionsData,
                        [sessionId]: { ...current, edges: [...current.edges, edge] }
                    }
                };
            }),

            setEdges: (sessionId, edges) => set((state) => {
                const current = get().getFlowData(sessionId);
                return {
                    sessionsData: {
                        ...state.sessionsData,
                        [sessionId]: { ...current, edges }
                    }
                };
            }),

            loadDemoFlow: (sessionId, demoIndex) => set((state) => ({
                sessionsData: {
                    ...state.sessionsData,
                    [sessionId]: { nodes: demoSets[demoIndex].nodes, edges: demoSets[demoIndex].edges }
                }
            })),

            resetFlow: (sessionId) => set((state) => {
                const newData = { ...state.sessionsData };
                delete newData[sessionId];
                return { sessionsData: newData };
            }),

            toggleCollapse: (sessionId, nodeId) => set((state) => {
                const current = get().getFlowData(sessionId);
                let newNodes = [...current.nodes];

                // Toggle collapsed state for the target node
                newNodes = newNodes.map(n =>
                    n.id === nodeId ? { ...n, data: { ...n.data, collapsed: !n.data.collapsed } } : n
                );

                // Re-evaluate 'hidden' for all nodes
                const childrenMap = new Map<string, string[]>();
                const incomingCount = new Map<string, number>();
                newNodes.forEach(n => {
                    childrenMap.set(n.id, []);
                    incomingCount.set(n.id, 0);
                });
                current.edges.forEach(e => {
                    if (childrenMap.has(e.source)) {
                        childrenMap.get(e.source)!.push(e.target);
                    }
                    if (incomingCount.has(e.target)) {
                        incomingCount.set(e.target, incomingCount.get(e.target)! + 1);
                    }
                });

                const roots = newNodes.filter(n => incomingCount.get(n.id) === 0);

                const applyHidden = (id: string, isHidden: boolean) => {
                    const nodeIndex = newNodes.findIndex(n => n.id === id);
                    if (nodeIndex !== -1) {
                        newNodes[nodeIndex] = { ...newNodes[nodeIndex], hidden: isHidden };
                        const nextHidden = isHidden || !!newNodes[nodeIndex].data.collapsed;
                        const children = childrenMap.get(id) || [];
                        children.forEach(childId => applyHidden(childId, nextHidden));
                    }
                };

                roots.forEach(root => applyHidden(root.id, false));

                // Apply layout to snap everything in place
                const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(newNodes, current.edges, 'TB');

                return {
                    sessionsData: {
                        ...state.sessionsData,
                        [sessionId]: { ...current, nodes: layoutedNodes, edges: layoutedEdges }
                    }
                };
            }),

            addNodeFromChat: (sessionId, label: string, subLabel?: string, parentId?: string, forceNodeId?: string) => {
                const current = get().getFlowData(sessionId);
                const nodes = current.nodes;
                const edges = current.edges;

                // If parentId provided, connect to it. Otherwise fallback to the previous node (linear) or '0' if empty
                const parentNode = parentId
                    ? nodes.find(n => n.id === parentId)
                    : (nodes[nodes.length - 1] || { id: '0', position: { x: 100, y: 0 } });

                // For position estimation before layout snaps
                const lastNode = nodes[nodes.length - 1] || { id: '0', position: { x: 100, y: 0 } };

                const newNodeId = forceNodeId || `node-${Date.now()}`;
                const newNode: Node = {
                    id: newNodeId,
                    position: {
                        x: lastNode.position.x,
                        y: lastNode.position.y + 70
                    },
                    data: {
                        label,
                        subLabel,
                        status: 'pending',
                        branchType: 'main'
                    },
                    type: 'process'
                };

                const newEdge: Edge = {
                    id: `e${parentNode!.id}-${newNodeId}`,
                    source: parentNode!.id,
                    target: newNodeId,
                    type: 'step'
                };

                const rawNodes = [...nodes, newNode];
                const rawEdges = parentNode!.id !== '0' ? [...edges, newEdge] : edges;

                const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(rawNodes, rawEdges, 'TB');

                set((state) => ({
                    sessionsData: {
                        ...state.sessionsData,
                        [sessionId]: {
                            nodes: layoutedNodes,
                            edges: layoutedEdges
                        }
                    },
                    selectedNodeId: newNodeId
                }));
            },
        }),
        {
            name: 'yuliu-flow-sessions-storage',
            partialize: (state) => ({
                sessionsData: state.sessionsData,
            }),
        }
    )
);
