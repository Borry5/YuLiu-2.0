import { useEffect } from 'react';
import { useSessionStore } from '../../store/useSessionStore';
import { useChatStore } from '../../store/useChatStore';
import { useFlowStore } from '../../store/useFlowStore';
import { MessageSquare, Plus, Trash2 } from 'lucide-react';

export function SessionSidebar() {
    const { sessions, activeSessionId, setActiveSession, createSession, deleteSession } = useSessionStore();
    const { resetChat } = useChatStore();
    const { resetFlow } = useFlowStore();

    // Auto create a session if empty
    useEffect(() => {
        if (sessions.length === 0) {
            createSession();
        }
    }, [sessions.length, createSession]);

    const handleCreate = () => {
        createSession();
    };

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm('确定删除该对话？删除后对应的聊天历史与右侧图谱数据均将被销毁。')) {
            deleteSession(id);
            resetChat(id);
            resetFlow(id);
        }
    };

    return (
        <div className="h-full bg-muted/40 border-r flex flex-col w-full overflow-hidden">
            <div className="p-4 shrink-0 flex items-center justify-between">
                <button
                    onClick={handleCreate}
                    className="flex-1 flex items-center justify-center gap-2 bg-primary/10 text-primary hover:bg-primary/20 transition-colors p-2.5 rounded-xl font-medium text-sm"
                >
                    <Plus className="h-4 w-4" />
                    新建对话
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {sessions.map(session => (
                    <div
                        key={session.id}
                        onClick={() => setActiveSession(session.id)}
                        className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${activeSessionId === session.id
                                ? 'bg-muted text-foreground font-medium'
                                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                            }`}
                    >
                        <div className="flex items-center gap-3 overflow-hidden">
                            <MessageSquare className="h-4 w-4 shrink-0 opacity-70" />
                            <span className="text-sm truncate leading-none pt-0.5">{session.title}</span>
                        </div>
                        <button
                            onClick={(e) => handleDelete(e, session.id)}
                            className={`p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 ${activeSessionId === session.id ? 'opacity-100' : ''
                                }`}
                            title="删除对话"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
