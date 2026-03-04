import { useState, useRef, useEffect } from 'react';
import { useChatStore, type Message } from '../../store/useChatStore';
import { useAppStore } from '../../store/useAppStore';
import { useFlowStore } from '../../store/useFlowStore';
import { Send, Settings, X, Loader2, Eraser, Paperclip, FileText, Moon, Sun, CheckCircle, XCircle } from 'lucide-react';
import { streamChat, verifyApiKey, generateSessionTitle } from '../../services/api';
import { parseFile } from '../../services/fileParser';
import ReactMarkdown from 'react-markdown';
import { useSessionStore } from '../../store/useSessionStore';

const SYSTEM_PROMPT = `你是一个名为"语流 (YuLiu)"的智能助手。你的目标是帮助用户处理复杂的思维任务，并将关键信息转化为结构化的思维导图。

**重要规则**：每次回答时，只要你提供了分步指导、知识点列举、框架总结等结构化内容，你**必须**使用 \`[NODE: 核心词汇]\` 的格式将它们提取为图谱节点！
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

    const { apiKey, setApiKey, apiProvider, setApiProvider, theme, setTheme } = useAppStore();
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [fileContext, setFileContext] = useState<{ name: string, content: string } | null>(null);
    const [isParsing, setIsParsing] = useState(false);

    // API Verification State
    const [isVerifying, setIsVerifying] = useState(false);
    const [verifyStatus, setVerifyStatus] = useState<{ success: boolean; message: string } | null>(null);

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

    // Clear verify status when apiKey or provider changes
    useEffect(() => {
        setVerifyStatus(null);
    }, [apiKey, apiProvider]);

    const handleVerifyApiKey = async () => {
        if (!apiKey.trim()) {
            setVerifyStatus({ success: false, message: '请先输入 API Key' });
            return;
        }
        setIsVerifying(true);
        setVerifyStatus(null);

        const result = await verifyApiKey(apiKey, apiProvider);
        setVerifyStatus(result);
        setIsVerifying(false);
    };

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
        if (!input.trim() || !apiKey) return;

        const currentInput = input;
        if (!activeSessionId || (!currentInput.trim() && !fileContext) || isLoading) return;
        if (!apiKey) {
            setShowSettings(true);
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

        const isFirstMessage = messages.length === 0;
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
                    if (isFirstMessage) {
                        generateSessionTitle(apiKey, apiProvider, contentToSend, fullAssistantResponse)
                            .then(title => {
                                if (title) {
                                    useSessionStore.getState().updateSessionTitle(activeSessionId, title);
                                }
                            });
                    }
                },
                onError: (error) => {
                    if (!isMounted.current) return;
                    setIsLoading(false);
                    updateMessage(activeSessionId, assistantMsgId, `**Error:** ${error.message}`);
                }
            });
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
                        onClick={() => setShowSettings(!showSettings)}
                        className="p-2 hover:bg-muted rounded-full transition-colors"
                        title="设置"
                    >
                        <Settings className="h-4 w-4 text-muted-foreground" />
                    </button>
                </div>
            </div>

            {/* Settings Panel */}
            {showSettings && (
                <div className="absolute top-14 left-0 right-0 bg-card border-b p-4 shadow-lg z-20 animate-in slide-in-from-top-2">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-medium text-sm">设置</h3>
                        <button onClick={() => setShowSettings(false)}><X className="h-4 w-4" /></button>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-xs text-muted-foreground block">主题 (Theme)</label>
                            <button
                                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                                className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md hover:bg-muted/80 transition-colors text-xs"
                            >
                                {theme === 'dark' ? <><Moon className="h-3 w-3" /> Dark</> : <><Sun className="h-3 w-3" /> Light</>}
                            </button>
                        </div>

                        <div>
                            <label className="text-xs text-muted-foreground block mb-1">API Provider</label>
                            <select
                                value={apiProvider}
                                onChange={(e) => setApiProvider(e.target.value as 'deepseek' | 'siliconflow')}
                                className="w-full text-sm p-2 border rounded bg-background"
                            >
                                <option value="deepseek">DeepSeek Official</option>
                                <option value="siliconflow">SiliconFlow (硅基流动)</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground block mb-1">API Key</label>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="sk-..."
                                className="w-full text-sm p-2 border rounded bg-background"
                            />
                        </div>

                        {/* Verify API Button */}
                        <div className="pt-2">
                            <button
                                onClick={handleVerifyApiKey}
                                disabled={isVerifying || !apiKey.trim()}
                                className="w-full py-2 px-3 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isVerifying ? (
                                    <><Loader2 className="h-4 w-4 animate-spin" /> 验证中...</>
                                ) : (
                                    '保存并验证 API'
                                )}
                            </button>

                            {/* Verification Status */}
                            {verifyStatus && (
                                <div className={`mt-2 p-2 rounded-md text-xs flex items-center gap-2 ${verifyStatus.success
                                    ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                                    : 'bg-red-500/10 text-red-600 dark:text-red-400'
                                    }`}>
                                    {verifyStatus.success ? (
                                        <CheckCircle className="h-4 w-4 shrink-0" />
                                    ) : (
                                        <XCircle className="h-4 w-4 shrink-0" />
                                    )}
                                    <span>{verifyStatus.message}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className={`flex-1 overflow-y-auto flex flex-col scroll-smooth ${messages.length === 0 ? 'justify-center p-8' : 'p-4 space-y-4'}`}>
                {messages.length === 0 ? (
                    <div className="text-center animate-in fade-in zoom-in-95 duration-500 mb-10">
                        <h1 className="text-3xl font-semibold text-foreground/80">有什么可以帮忙的？</h1>
                        {!apiKey && (
                            <div className="text-muted-foreground mt-6 text-sm">
                                <Settings className="h-6 w-6 mx-auto mb-2 opacity-30" />
                                <p>请先配置 API Key</p>
                                <button onClick={() => setShowSettings(true)} className="mt-1 text-primary hover:underline">去设置</button>
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
