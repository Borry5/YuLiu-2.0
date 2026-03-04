import { Handle, Position, type NodeProps, useEdges } from '@xyflow/react';
import { CheckCircle2, CircleDashed, PlayCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { useFlowStore } from '../../../store/useFlowStore';
import { useSessionStore } from '../../../store/useSessionStore';

export type ProcessNodeData = {
    label: string;
    subLabel?: string;
    status?: 'pending' | 'active' | 'completed';
    branchType?: 'main' | 'sub';
    collapsed?: boolean;
};

export function ProcessNode({ id, data }: NodeProps) {
    const nodeData = data as ProcessNodeData;
    const { label, subLabel, status = 'pending', branchType = 'main', collapsed = false } = nodeData;

    const edges = useEdges();
    const hasChildren = edges.some(e => e.source === id);

    const toggleCollapse = useFlowStore(state => state.toggleCollapse);
    const activeSessionId = useSessionStore(state => state.activeSessionId);

    const onToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (activeSessionId) {
            toggleCollapse(activeSessionId, id);
        }
    };

    // Determine visual styles based on status
    let statusConfig = {
        bg: 'bg-card',
        border: 'border-border',
        icon: <CircleDashed className="w-4 h-4 text-muted-foreground hidden" />,
        text: 'text-foreground'
    };

    if (status === 'completed') {
        statusConfig = {
            bg: 'bg-green-50 dark:bg-green-950/30',
            border: 'border-green-500/50',
            icon: <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-500" />,
            text: 'text-foreground'
        };
    } else if (status === 'active') {
        statusConfig = {
            bg: 'bg-blue-50 dark:bg-blue-950/30',
            border: 'border-blue-500 ring-2 ring-blue-500/20',
            icon: <PlayCircle className="w-4 h-4 text-blue-600 dark:text-blue-500" />,
            text: 'text-foreground font-bold'
        };
    }

    // Branch type variations
    const isSub = branchType === 'sub';
    const padding = isSub ? 'px-3 py-1.5' : 'px-4 py-2.5';
    const textBase = isSub ? 'text-xs' : 'text-sm font-semibold';
    const minW = isSub ? 'min-w-[120px]' : 'min-w-[150px]';

    return (
        <div className={`${padding} ${minW} shadow-sm hover:shadow-md transition-shadow rounded-lg ${statusConfig.bg} border-2 ${statusConfig.border} relative group`}>
            {hasChildren && (
                <button
                    onClick={onToggle}
                    className="absolute -right-3 -bottom-3 w-6 h-6 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-full flex items-center justify-center text-slate-500 hover:text-primary hover:border-primary transition-colors z-10 shadow-sm"
                >
                    {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
            )}

            <div className="flex items-center gap-2">
                {statusConfig.icon}
                <div className="flex flex-col flex-1">
                    <div className={`${textBase} ${statusConfig.text}`}>{label}</div>
                    {subLabel && <div className="text-[10px] text-muted-foreground mt-0.5">{subLabel}</div>}
                </div>
            </div>

            {/* 隐藏的挂载点，调整 Source 至底部中心偏左的位置对齐图标 (24px) */}
            <Handle type="target" position={Position.Left} className="w-1 h-1 opacity-0 pointer-events-none" style={{ top: '22px' }} />
            <Handle type="source" position={Position.Bottom} className="w-1 h-1 opacity-0 pointer-events-none" style={{ left: '24px' }} />
        </div>
    );
}
