import { useState, useRef, useEffect } from 'react';
import { useChatStore, type Message } from '../../store/useChatStore';
import { useAppStore } from '../../store/useAppStore';
import { useFlowStore } from '../../store/useFlowStore';
import { Send, Settings, Loader2, Eraser, Paperclip, FileText, Globe, X } from 'lucide-react';
import { streamChat, verifyApiKey, generateSessionTitle, API_CONFIG } from '../../services/api';
import { parseFile } from '../../services/fileParser';
import ReactMarkdown from 'react-markdown';
import { useSessionStore } from '../../store/useSessionStore';
import { toast } from 'sonner';

const SYSTEM_PROMPT = `你是一个名为"语流 (YuLiu)"的智能助手。你的目标是帮助用户处理复杂的思维任务，并将关键信息转化为结构化的思维导图。

** 重要规则 **：每次回答时，只要你提供了分步指导、知识点列举、框架总结等结构化内容，你 ** 必须 ** 使用 \`[NODE: 核心词汇]\` 的格式将它们提取为图谱节点！
我们的系统会自动拦截这些标签并在右侧生成思维导图。请务必大胆、高频地使用 \`[NODE: ...]\` 标签。

**层级规则（极其重要）**：
为了精准确定这些节点的从属关系，我们要求你必须结合 Markdown 的 # 标题嵌套系统来输出结构！
不要再试图仅仅使用空格或者序号来推测，直接打上多级标题！

例如：
用户问：怎么学 Python？
你可以回复：学习Python可以分这几步：
## 1. 基础语法 [NODE: 基础语法]
### 数据类型 [NODE: 数据类型]
### 控制流 [NODE: 控制流]
## 2. 进阶打怪 [NODE: 进阶操作]

当前是一个演示版本，请用简洁、清晰的带有严格多级 Header 结构的 Markdown 回答，绝不要忘记插入 NODE 标签。`;

export function ChatSidebar() {
    const { activeSessionId } = useSessionStore();
    const { getMessages, addMessage, updateMessage } = useChatStore();
    const messages = getMessages(activeSessionId);

    // We already have activeSessionId from useSessionStore above
    const { touchSession } = useSessionStore();

    const { apiList, activeModelConfig, setActiveModelConfig, isSearchEnabled, setSearchEnabled, setIsSettingsOpen } = useAppStore();

    // Resolve the active key based on activeModelConfig
    const activeRecord = activeModelConfig ? apiList.find(record => record.id === activeModelConfig.apiKeyId) : null;
    const apiKey = activeRecord?.key || '';
    const apiProvider = activeModelConfig?.provider || 'siliconflow';
    const activeModel = activeModelConfig?.model || '';
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [fileContext, setFileContext] = useState<{ name: string, content: string } | null>(null);
    const [isParsing, setIsParsing] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const processedNodes = useRef<Set<string>>(new Set());
    const isMounted = useRef(true);

    useEffect(() => {
        return () => {
            isMounted.current = false;
        };
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    // Helper to extract structural depth level based on Markdown Headings (#)

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsParsing(true);
        try {
            const content = await parseFile(file);
            setFileContext({ name: file.name, content });
        } catch (err) {
            alert(`Error parsing file: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setIsParsing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Helper to extract indentation level (number of leading spaces/tabs)
    // Helper to extract structural depth level based on Markdown Headings (#)
    // Fallback to indentation/bullet heuristics if it's not a heading
    const getDepthLevel = (text: string, matchIndex: number): number => {
        let lineStart = matchIndex;
        while (lineStart > 0 && text[lineStart - 1] !== '\n') {
            lineStart--;
        }

        const lineText = text.substring(lineStart, matchIndex).trim();

        // 1. Primary Strategy: Markdown Headings (e.g., '### Title')
        const headingMatch = lineText.match(/^(#{1,6})\s/);
        if (headingMatch) {
            // # -> depth 1, ## -> depth 2...
            // Multiple by 4 to simulate the visual indent width in our layout engine
            return (headingMatch[1].length - 1) * 4;
        }

        // 2. Secondary Strategy: Real Indentation (spaces/tabs)
        let indent = 0;
        let hasRealIndent = false;

        for (let i = lineStart; i < matchIndex; i++) {
            if (text[i] === ' ') {
                indent++;
                hasRealIndent = true;
            } else if (text[i] === '\t') {
                indent += 4;
                hasRealIndent = true;
            } else break;
        }

        // 3. Fallback Strategy: Structural text markers (e.g., 1. / - / (一))
        if (!hasRealIndent || indent === 0) {
            if (/^[一二三四五六七八九十]+[、.]/.test(lineText)) {
                return 0; // L1: 一、 二、
            }
            if (/^\([一二三四五六七八九十]+\)/.test(lineText) || /^（[一二三四五六七八九十]+）/.test(lineText)) {
                return 4; // L2: (一) （一）
            }
            if (/^\d+[.、]/.test(lineText)) {
                return 8; // L3: 1. 2.
            }
            if (/^\(\d+\)/.test(lineText) || /^（\d+）/.test(lineText) || /^[-•*]/.test(lineText)) {
                return 12; // L4: (1) - *
            }
        }

        return indent;
    };

    const handleSend = async () => {
        const currentInput = input;
        if (!activeSessionId || (!currentInput.trim() && !fileContext) || isLoading) return;

        // 1. 本地判空校验
        if (!apiKey) {
            toast.error('发送错误：未找到有效 API Key，请先点击设置进行配置！');
            setIsSettingsOpen(true);
            return;
        }

        // 2. 发送前置探测 (预检保护) 
        // 暂时呈现加载中以防止用户乱点
        setIsLoading(true);
        try {
            const isValid = await verifyApiKey(apiKey, apiProvider);
            if (!isValid) {
                toast.error(`发送阻断：[${apiProvider}] 拒绝了请求，大概率是 Key 不存在、受限或扣费配额耗尽。`);
                setIsLoading(false);
                setIsSettingsOpen(true);
                return;
            }
        } catch (error: any) {
            toast.error(`发送阻断：服务器连接故障或网络异常，详情: ${error.message || '未知异常'}`);
            setIsLoading(false);
            return;
        }

        const userMsgId = Date.now().toString();

        let contentToSend = input;
        if (fileContext) {
            contentToSend = `[Context from file: ${fileContext.name}]\n\n${fileContext.content}\n\n[End Context]\n\n${input}`;
        }

        const userMsg: Message = {
            id: userMsgId,
            role: 'user',
            content: input + (fileContext ? `\n(Attached: ${fileContext.name})` : ''),
            timestamp: Date.now(),
        };
        addMessage(activeSessionId, userMsg);

        // Clear input and file context
        setInput('');
        setFileContext(null);
        setIsLoading(true);

        const assistantMsgId = (Date.now() + 1).toString();
        addMessage(activeSessionId, {
            id: assistantMsgId,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
        });

        let fullAssistantResponse = '';

        // Stack to track hierarchy: { id, indent }
        let nodeStack: { id: string, indent: number }[] = [];

        try {
            const realUserMsg: Message = {
                ...userMsg,
                content: contentToSend
            };

            // Update history for API context
            updateMessage(activeSessionId, userMsgId, contentToSend);

            // Touch the session so it pops to the top in the list
            touchSession(activeSessionId);

            const chatMessages = [
                { role: 'system', content: SYSTEM_PROMPT, id: 'system', timestamp: 0 } as Message,
                ...messages,
                realUserMsg
            ];
            processedNodes.current.clear();

            await streamChat({
                messages: chatMessages,
                apiKey,
                provider: apiProvider,
                model: activeModel,
                isSearchEnabled,
                onChunk: (content) => {
                    fullAssistantResponse = content;
                    // 1. Text to display: hide [NODE:... ] instructions from user view
                    const displayContent = content.replace(/\[NODE:.*?\]/g, '').trim();
                    updateMessage(activeSessionId, assistantMsgId, displayContent);

                    // 2. Node extraction: find all [NODE: xxxx] formats
                    const nodeRegex = /\[NODE:\s*([^|\]]+)(?:\|([^\]]+))?\]/g;
                    let match;

                    // Iterate over all matches in the current content chunk
                    // We re-parse the whole content each time, but only process new matches
                    while ((match = nodeRegex.exec(content)) !== null) {
                        const fullMatch = match[0];
                        const matchIndex = match.index;

                        // Prevent re-processing same nodes during stream
                        if (!processedNodes.current.has(fullMatch)) {
                            processedNodes.current.add(fullMatch);
                            const label = match[1].trim();
                            const subLabel = match[2]?.trim(); // Optional sub-label

                            // Calculate structural depth for hierarchy
                            const indent = getDepthLevel(content, matchIndex);

                            // Find parent based on depth level
                            let parentId: string | undefined = undefined;
                            while (nodeStack.length > 0 && nodeStack[nodeStack.length - 1].indent >= indent) {
                                nodeStack.pop(); // Pop nodes with equal or greater depth
                            }

                            if (nodeStack.length > 0) {
                                parentId = nodeStack[nodeStack.length - 1].id;
                            }

                            // Generate a unique ID for the new node
                            const nodeId = `node-${activeSessionId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

                            // Add node to flow store, passing parentId and the generated nodeId
                            useFlowStore.getState().addNodeFromChat(activeSessionId, label, subLabel, parentId, nodeId);

                            // Push the new node's ID and indent to the stack
                            nodeStack.push({ id: nodeId, indent });
                        }
                    }
                },
                onFinish: () => {
                    if (!isMounted.current) return;
                    setIsLoading(false);
                },
                onError: (error) => {
                    if (!isMounted.current) return;
                    setIsLoading(false);
                    updateMessage(activeSessionId, assistantMsgId, `**Error:** ${error.message}`);
                }
            });

            // 流式对话结束后，根据上下文生成/更新标题
            if (fullAssistantResponse) {
                const recentContext = [
                    ...messages.slice(-6),
                    realUserMsg,
                    { role: 'assistant', content: fullAssistantResponse }
                ];
                try {
                    const title = await generateSessionTitle(apiKey, apiProvider, recentContext);
                    if (title) {
                        useSessionStore.getState().updateSessionTitle(activeSessionId, title);
                    }
                } catch (e) {
                    console.error('标题生成失败:', e);
                }
            }
        } catch (error) {
            console.error('Error in chat:', error);
            if (isMounted.current) {
                setIsLoading(false);
                updateMessage(activeSessionId, assistantMsgId, '**Error:** Failed to connect to AI service.');
            }
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const file = e.dataTransfer.files?.[0];
        if (!file || isLoading || isParsing || fileContext) return;

        setIsParsing(true);
        try {
            const content = await parseFile(file);
            setFileContext({ name: file.name, content });
        } catch (err) {
            alert(`Error parsing file: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setIsParsing(false);
        }
    };

    return (
        <div
            className="h-full bg-background border-r flex flex-col relative w-full overflow-hidden"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            <div className="p-4 border-b flex justify-between items-center bg-card shrink-0">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    对话列表
                    <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full">Beta</span>
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => { if (confirm('清空对话?')) { window.location.reload(); } }}
                        className="p-2 hover:bg-muted rounded-full transition-colors hidden"
                        title="清空"
                    >
                        <Eraser className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="p-2 hover:bg-muted rounded-full transition-colors"
                        title="设置"
                    >
                        <Settings className="h-4 w-4 text-muted-foreground" />
                    </button>
                </div>
            </div>

            <div className={`flex-1 overflow-y-auto flex flex-col scroll-smooth ${messages.length === 0 ? 'justify-center p-8' : 'p-4 space-y-4'}`}>
                {messages.length === 0 ? (
                    <div className="text-center animate-in fade-in zoom-in-95 duration-500 mb-10">
                        <h1 className="text-3xl font-semibold text-foreground/80">有什么可以帮忙的？</h1>
                        {!apiKey && (
                            <div className="text-muted-foreground mt-6 text-sm">
                                <Settings className="h-6 w-6 mx-auto mb-2 opacity-30" />
                                <p>请先配置 API Key</p>
                                <button onClick={() => setIsSettingsOpen(true)} className="mt-1 text-primary hover:underline">去设置</button>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[85%] rounded-lg p-3 text-sm shadow-sm overflow-hidden ${msg.role === 'user'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted/50 text-foreground border'
                                        }`}
                                >
                                    {msg.role === 'user' ? (
                                        <div className="whitespace-pre-wrap max-h-[500px] overflow-y-auto">
                                            {msg.content.startsWith('[Context from file:') ? (
                                                <>
                                                    <div className="flex items-center gap-1 text-xs opacity-70 mb-2 p-1 bg-black/10 rounded">
                                                        <FileText className="h-3 w-3" />
                                                        {msg.content.substring(0, msg.content.indexOf(']'))}
                                                    </div>
                                                    {msg.content.split('[End Context]\n\n')[1] || msg.content}
                                                </>
                                            ) : msg.content}
                                        </div>
                                    ) : (
                                        <div className="markdown-body">
                                            {msg.content ? (
                                                <ReactMarkdown
                                                    components={{
                                                        // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
                                                        code({ node, inline, className, children, ...props }: any) {
                                                            return !inline ? (
                                                                <div className="bg-slate-950 text-slate-50 p-2 rounded-md my-2 overflow-x-auto text-xs whitespace-pre-wrap">
                                                                    <code {...props}>{children}</code>
                                                                </div>
                                                            ) : (
                                                                <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded text-xs" {...props}>{children}</code>
                                                            )
                                                        }
                                                    }}
                                                >
                                                    {msg.content}
                                                </ReactMarkdown>
                                            ) : (isLoading && <Loader2 className="h-3 w-3 animate-spin" />)}
                                        </div>
                                    )}
                                    <span className="text-[10px] opacity-50 block mt-1 text-right">
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* File Upload Context Indicator */}
            {fileContext && (
                <div className="px-4 py-2 bg-muted/30 border-t flex justify-between items-center animate-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
                        <FileText className="h-3 w-3" />
                        <span className="truncate max-w-[150px]">{fileContext.name}</span>
                        <span className="opacity-50">({Math.round(fileContext.content.length / 1024)}KB text)</span>
                    </div>
                    <button onClick={() => setFileContext(null)}><X className="h-3 w-3" /></button>
                </div>
            )}

            {/* Input Area */}
            <div className={`w-full max-w-4xl mx-auto shrink-0 transition-all duration-300 ${messages.length === 0 ? 'mb-20 px-8' : 'p-4 border-t bg-card'}`}>
                {/* 快捷引擎底座面板 */}
                <div className="flex items-center gap-2 mb-2 pl-2">
                    <select
                        value={activeModelConfig ? `${activeModelConfig.apiKeyId}::${activeModelConfig.model}` : ''}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (!val) return;
                            const [keyId, modelName] = val.split('::');
                            const targetRecord = apiList.find(r => r.id === keyId);
                            if (targetRecord) {
                                setActiveModelConfig({
                                    apiKeyId: targetRecord.id,
                                    provider: targetRecord.provider,
                                    model: modelName
                                });
                            }
                        }}
                        className="text-xs p-1 px-2 border rounded-full bg-muted/50 text-muted-foreground outline-none focus:ring-1 focus:ring-primary appearance-none max-w-[200px] truncate cursor-pointer"
                    >
                        {apiList.length > 0 ? (
                            apiList.flatMap(record => {
                                const config = API_CONFIG[record.provider];
                                return record.models.map(model => (
                                    <option key={`${record.id}::${model}`} value={`${record.id}::${model}`}>
                                        {config?.name || record.provider} - {model}
                                    </option>
                                ));
                            })
                        ) : (
                            <option value="" disabled>请先去设置配置 API</option>
                        )}
                    </select>

                    <div className="relative group flex items-center">
                        <button
                            onClick={() => API_CONFIG[apiProvider].supportsSearch && setSearchEnabled(!isSearchEnabled)}
                            className={`p-1.5 rounded-full flex items-center gap-1 text-xs transition-colors ${!API_CONFIG[apiProvider].supportsSearch ? 'opacity-40 cursor-not-allowed' : isSearchEnabled ? 'bg-blue-500/10 text-blue-500' : 'text-muted-foreground hover:bg-muted'}`}
                        >
                            <Globe className="h-3 w-3" />
                            {isSearchEnabled && API_CONFIG[apiProvider].supportsSearch && <span>当前已联网</span>}
                        </button>

                        {/* 强制覆盖展示的自定义 Tooltip */}
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                            {!API_CONFIG[apiProvider].supportsSearch ? "该 API 不支持原生联网" : isSearchEnabled ? "原生联网开启" : "原生联网关闭"}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-2 border-transparent border-t-black/80 w-0 h-0"></div>
                        </div>
                    </div>
                    {!apiKey && <span className="text-[10px] text-red-500 ml-auto mr-2">暂未配置该引擎 Key，可能会发送失败</span>}
                </div>

                <div className={`flex items-center gap-2 bg-background border focus-within:ring-1 focus-within:ring-primary ${messages.length === 0 ? 'rounded-2xl shadow-sm p-2 py-3' : 'rounded-md p-1'}`}>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".pdf,.txt,.md,.json,.js,.ts,.tsx,.csv,.xml,.yaml,.yml,.html,.css,.py,.java,.go,.c,.cpp,.rb,.php,.swift,.kt,.sql,.docx,.pptx"
                        onChange={handleFileSelect}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isLoading || isParsing || !!fileContext}
                        className="p-3 hover:bg-muted rounded-xl text-muted-foreground transition-colors disabled:opacity-50 ml-1"
                        title="上传文件 (PDF/Text)"
                    >
                        {isParsing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
                    </button>

                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !isLoading && !isParsing && handleSend()}
                        placeholder={apiKey ? "输入消息..." : "请先配置 API Key"}
                        disabled={isLoading || !apiKey || isParsing || !activeSessionId}
                        className="flex-1 py-3 px-2 bg-transparent focus:outline-none text-md disabled:opacity-50"
                    />
                    <button
                        onClick={handleSend}
                        disabled={(!input.trim() && !fileContext) || isLoading || !apiKey || isParsing || !activeSessionId}
                        className="p-3 bg-primary text-primary-foreground rounded-xl disabled:opacity-50 hover:bg-primary/90 transition-colors mr-1"
                    >
                        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    </button>
                </div>
            </div>
        </div>
    );
}
