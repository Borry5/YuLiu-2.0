import { type Node, type Edge, Position } from '@xyflow/react';

// Standard metrics for indented tree layout
const INDENT_WIDTH = 40; // horizontal indentation per depth level
const ROW_HEIGHT = 70;   // vertical spacing between rows

export const getLayoutedElements = (nodes: Node[], edges: Edge[], _direction = 'TB') => {
    // 1. Build adjacency list to find children for each node
    const childrenMap = new Map<string, string[]>();
    const incomingCount = new Map<string, number>();

    nodes.forEach(n => {
        childrenMap.set(n.id, []);
        incomingCount.set(n.id, 0);
    });

    edges.forEach(e => {
        if (childrenMap.has(e.source)) {
            childrenMap.get(e.source)!.push(e.target);
        }
        if (incomingCount.has(e.target)) {
            incomingCount.set(e.target, incomingCount.get(e.target)! + 1);
        }
    });

    // 2. Find root nodes (nodes with 0 incoming edges)
    const roots = nodes.filter(n => incomingCount.get(n.id) === 0);

    let currentY = 0;
    const layoutedNodes: Node[] = [];
    const reached = new Set<string>();

    // 3. DFS Traversal to assign coordinates
    const traverse = (nodeId: string, depth: number) => {
        if (reached.has(nodeId)) return; // prevent cycles
        reached.add(nodeId);

        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;

        // If a node is explicitly hidden, we still keep it in array but don't increment Y to avoid blank spaces
        if (!node.hidden) {
            layoutedNodes.push({
                ...node,
                // File tree styling: parent connects from Bottom, child receives at Left
                targetPosition: Position.Left,
                sourcePosition: Position.Bottom,
                position: {
                    x: depth * INDENT_WIDTH,
                    y: currentY
                },
            });
            currentY += ROW_HEIGHT;
        } else {
            // Keep hidden node properties intact
            layoutedNodes.push({
                ...node,
                targetPosition: Position.Left,
                sourcePosition: Position.Bottom,
            });
        }

        const children = childrenMap.get(nodeId) || [];
        children.forEach(childId => {
            traverse(childId, depth + 1);
        });
    };

    // Traverse starting from roots
    roots.forEach(root => traverse(root.id, 0));

    // Fallback for detached cycles
    nodes.forEach(n => {
        if (!reached.has(n.id)) {
            traverse(n.id, 0);
        }
    });

    return { nodes: layoutedNodes, edges };
};
