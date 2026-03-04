import { type Message } from '../store/useChatStore';

export type ApiProviderType = 'deepseek' | 'siliconflow' | 'gemini' | 'claude' | 'gpt' | 'qwen' | 'glm' | 'kimi' | 'minimax';

interface StreamChatParams {
    messages: Message[];
    apiKey: string;
    provider: ApiProviderType;
    model: string;
    isSearchEnabled?: boolean;
    onChunk: (content: string) => void;
    onFinish: () => void;
    onError: (error: Error) => void;
}

export const API_CONFIG: Record<ApiProviderType, { name: string; url: string; models: string[]; supportsSearch: boolean }> = {
    siliconflow: {
        name: 'SiliconFlow (硅基流动)',
        url: 'https://api.siliconflow.cn/v1/chat/completions',
        models: ['deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1', 'Qwen/Qwen2.5-72B-Instruct'],
        supportsSearch: false,
    },
    deepseek: {
        name: 'DeepSeek官方',
        url: 'https://api.deepseek.com/chat/completions',
        models: ['deepseek-chat', 'deepseek-reasoner'],
        supportsSearch: false,
    },
    gpt: {
        name: 'OpenAI GPT',
        url: 'https://api.openai.com/v1/chat/completions',
        models: ['gpt-4o', 'gpt-4o-mini', 'o1-mini'],
        supportsSearch: false,
    },
    claude: {
        name: 'Anthropic Claude',
        url: 'https://api.anthropic.com/v1/messages',
        models: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
        supportsSearch: false,
    },
    gemini: {
        name: 'Google Gemini',
        url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        models: ['gemini-2.5-flash', 'gemini-1.5-pro'],
        supportsSearch: true,
    },
    qwen: {
        name: '阿里云百炼 (Qwen)',
        url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        models: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
        supportsSearch: true,
    },
    glm: {
        name: '智谱清言 (GLM)',
        url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        models: ['glm-4-plus', 'glm-4-air'],
        supportsSearch: true,
    },
    kimi: {
        name: '月之暗面 (Kimi)',
        url: 'https://api.moonshot.cn/v1/chat/completions',
        models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
        supportsSearch: true,
    },
    minimax: {
        name: 'MiniMax',
        url: 'https://api.minimax.chat/v1/text/chatcompletion_v2',
        models: ['abab6.5s-chat', 'abab6.5-chat'],
        supportsSearch: true,
    }
};

export async function streamChat({ messages, apiKey, provider, model, isSearchEnabled, onChunk, onFinish, onError }: StreamChatParams) {
    try {
        const config = API_CONFIG[provider];

        // Prepare messages for API (remove id and timestamp, keep role and content)
        const apiMessages = messages.map(({ role, content }) => ({ role, content }));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload: any = {
            model: model || config.models[0],
            messages: apiMessages,
            stream: true,
        };

        // 注入原生联网参数
        if (isSearchEnabled && config.supportsSearch) {
            if (provider === 'qwen') {
                payload.enable_search = true;
            } else if (provider === 'glm') {
                payload.tools = [{ type: 'web_search', web_search: { enable: true } }];
            } else if (provider === 'kimi') {
                payload.tools = [{ type: 'builtin_function', function: { name: '$web_search' } }];
            } else if (provider === 'minimax') {
                payload.tools = [{ type: 'web_search', web_search: { enable: true } }];
            } else if (provider === 'gemini') {
                // OpenAI 兼容模式下的 Gemini
                payload.tools = [{ type: 'google_search', google_search: {} }];
            }
        }

        const response = await fetch(config.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`API Error: ${response.status} - ${errorData.error?.message || response.statusText}`);
        }

        if (!response.body) throw new Error('Response body is null');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim() !== '');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.replace('data: ', '');
                    if (dataStr === '[DONE]') {
                        onFinish();
                        return;
                    }

                    try {
                        const data = JSON.parse(dataStr);
                        const content = data.choices[0]?.delta?.content || '';
                        if (content) {
                            accumulatedContent += content;
                            onChunk(accumulatedContent);
                        }
                    } catch (e) {
                        console.warn('Error parsing JSON chunk', e);
                    }
                }
            }
        }

        onFinish();

    } catch (error) {
        onError(error instanceof Error ? error : new Error('Unknown error'));
    }
}

// Verify API Key with a lightweight test request
export async function verifyApiKey(apiKey: string, provider: ApiProviderType): Promise<{ success: boolean; message: string }> {
    try {
        const config = API_CONFIG[provider];

        const response = await fetch(config.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: config.models[0],
                messages: [{ role: 'user', content: 'Hi' }],
                max_tokens: 1, // Minimal tokens to reduce cost
            }),
        });

        if (response.ok) {
            return { success: true, message: 'API Key 验证成功！' };
        } else {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData.error?.message || response.statusText || `HTTP ${response.status}`;
            return { success: false, message: `验证失败: ${errorMsg}` };
        }
    } catch (error) {
        return { success: false, message: `网络错误: ${error instanceof Error ? error.message : '未知错误'}` };
    }
}

// Generate a concise title for the session based on first interaction
export async function generateSessionTitle(
    apiKey: string,
    provider: ApiProviderType,
    recentMessages: { role: string, content: string }[]
): Promise<string | null> {
    try {
        const config = API_CONFIG[provider];
        if (!config) return null;

        const historyText = recentMessages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`)
            .join('\n')
            .substring(0, 1000);

        const prompt = `请用十个字以内概括以下对话的主题。直接输出概括文字，不要标点符号，不要引号，不要任何多余格式。

${historyText}`;

        const response = await fetch(config.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: config.models[0],
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 15,
                temperature: 0.5,
            }),
        });

        if (!response.ok) return null;

        const data = await response.json();
        const title = data.choices?.[0]?.message?.content?.trim() || '';
        return title ? title.replace(/['"]/g, '') : null;
    } catch (error) {
        console.error('Error generating session title:', error);
        return null;
    }
}

// 并发嗅探 API 服务商
export async function detectApiProvider(apiKey: string): Promise<ApiProviderType> {
    if (!apiKey.trim()) {
        throw new Error('API Key 不能为空');
    }

    // 排除不支持标准的或者容易出错的服务商在盲测外如果需要，这里我们全量跑
    const providers = Object.keys(API_CONFIG) as ApiProviderType[];

    // 构造对每一个服务商的试探请求
    const probeRequests = providers.map(async (provider) => {
        const config = API_CONFIG[provider];
        try {
            const response = await fetch(config.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: config.models[0],
                    messages: [{ role: 'user', content: 'Hi' }],
                    max_tokens: 1, // 最小化消耗
                }),
            });

            if (response.ok) {
                return provider; // 这个 Promise 成功解析为该 Provider
            } else {
                // 主动抛出错误，让 Promise.any 忽略这个结果
                throw new Error(`Failed on ${provider}: ${response.status}`);
            }
        } catch (error) {
            throw new Error(`Fetch failed on ${provider}`);
        }
    });

    try {
        // Promise.any 会返回"第一个" resolve 的 Promise 的结果
        // 如果全部 reject，则会抛出 AggregateError
        const winningProvider = await Promise.any(probeRequests);
        return winningProvider;
    } catch (error) {
        throw new Error('无法连接到任何受支持的模型服务商，请检查 API Key 或网络环境');
    }
}
