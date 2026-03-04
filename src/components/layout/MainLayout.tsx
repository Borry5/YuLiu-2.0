import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { SessionSidebar } from "../chat/SessionSidebar";
import { ChatSidebar } from "../chat/ChatSidebar";
import { FlowArea } from "../flow/FlowArea";
import { GripVertical } from 'lucide-react';

export function MainLayout() {
    return (
        <div className="h-screen w-screen overflow-hidden bg-background text-foreground animate-in fade-in duration-500">
            <PanelGroup direction="horizontal">
                <Panel defaultSize={20} minSize={10} maxSize={30} className="bg-muted/10 border-r">
                    <SessionSidebar />
                </Panel>

                <PanelResizeHandle className="w-1.5 bg-border hover:bg-primary/20 transition-colors flex items-center justify-center group outline-none">
                    <div className="h-8 w-1 rounded-full bg-muted-foreground/20 group-hover:bg-primary transition-colors flex items-center justify-center">
                        <GripVertical className="h-3 w-3 text-muted-foreground/50 group-hover:text-primary-foreground" />
                    </div>
                </PanelResizeHandle>

                <Panel defaultSize={40} minSize={20} maxSize={60} className="bg-background border-r">
                    <ChatSidebar />
                </Panel>

                <PanelResizeHandle className="w-1.5 bg-border hover:bg-primary/20 transition-colors flex items-center justify-center group outline-none">
                    <div className="h-8 w-1 rounded-full bg-muted-foreground/20 group-hover:bg-primary transition-colors flex items-center justify-center">
                        <GripVertical className="h-3 w-3 text-muted-foreground/50 group-hover:text-primary-foreground" />
                    </div>
                </PanelResizeHandle>

                <Panel defaultSize={40} minSize={20}>
                    <FlowArea />
                </Panel>
            </PanelGroup>
        </div>
    );
}
