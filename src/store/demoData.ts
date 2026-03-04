import type { Edge, Node } from '@xyflow/react';
import type { Message } from './useChatStore';

// Demo 1: 企业旧代码逻辑梳理
export const demoNodes1: Node[] = [
    { id: 'd1-1', position: { x: 250, y: 0 }, data: { label: '📦 OldSystem 支付回调', status: 'completed' }, type: 'process' },
    { id: 'd1-2', position: { x: 100, y: 100 }, data: { label: '🛡️ 风控校验 (AuthService)', status: 'active' }, type: 'process' },
    { id: 'd1-3', position: { x: 400, y: 100 }, data: { label: '💾 订单更新 (OrderDB)', status: 'pending' }, type: 'process' },
    { id: 'd1-4', position: { x: 50, y: 200 }, data: { label: 'IP 频控限制', status: 'completed', branchType: 'sub' }, type: 'process' },
    { id: 'd1-5', position: { x: 150, y: 200 }, data: { label: '高危用户判定', status: 'active', branchType: 'sub' }, type: 'process' },
    { id: 'd1-6', position: { x: 300, y: 200 }, data: { label: '状态变更为 PAID', status: 'pending', branchType: 'sub' }, type: 'process' },
    { id: 'd1-7', position: { x: 500, y: 200 }, data: { label: '触发消息队列(Kafka)', status: 'pending', branchType: 'sub' }, type: 'process' },
];

export const demoEdges1: Edge[] = [
    { id: 'e1-2', source: 'd1-1', target: 'd1-2', type: 'step' },
    { id: 'e1-3', source: 'd1-1', target: 'd1-3', type: 'step' },
    { id: 'e2-4', source: 'd1-2', target: 'd1-4', type: 'step' },
    { id: 'e2-5', source: 'd1-2', target: 'd1-5', type: 'step' },
    { id: 'e3-6', source: 'd1-3', target: 'd1-6', type: 'step' },
    { id: 'e3-7', source: 'd1-3', target: 'd1-7', type: 'step' },
];

export const demoMessages1: Message[] = [
    { id: 'demo1-1', role: 'user', content: '[Context from file: legacy_payment_core.ts]\n... (一万行遗留代码) ...\n[End Context]\n\n解释一下这段陈旧代码中关于“支付回调”的整套生命周期。', timestamp: Date.now() - 60000 },
    {
        id: 'demo1-2', role: 'assistant', content: `基于提供的遗留代码文件，我为您梳理出了 \`OldSystem\` 支付回调的工作流：

### 1. 🛡️ 第一层：风控过滤 (AuthService)
在接受到第三方机构的 Webhook 后，首先会进入 \`AuthService.validate()\` 方法进行两步校验：
- **IP 频控限制**：根据 Redis 缓存进行并发访问屏蔽 [NODE: IP 频控限制]
- **高危用户判定**：调用风险模型 API 判断账号涉赌/欺诈风险 [NODE: 高危用户判定]

### 2. 💾 第二层：核心订单更新 (OrderDB)
当风控通过后，进入 \`OrderRepository.updatePaymentStatus()\` [NODE: 💾 订单更新 (OrderDB)]：
- 会开启一个 ACID 事务，将订单主表的状态字段更新为 \`PAID\`。 [NODE: 状态变更为 PAID]
- 如果上述库表操作成功，立刻向 \`payment_success\` 这根 Kafka 主题打出一则消息，以便让下游通知服务发送短信。[NODE: 触发消息队列(Kafka)]

您可以通过点击右侧提取的框架节点，快速高亮上述代码对应的梳理步骤。`, timestamp: Date.now() - 30000
    }
];

// Demo 2: 多步骤法务合规审批
export const demoNodes2: Node[] = [
    { id: 'd2-1', position: { x: 250, y: 0 }, data: { label: '⚖️ 跨境电商退回免赔案', status: 'active' }, type: 'process' },
    { id: 'd2-2', position: { x: 100, y: 100 }, data: { label: '搜集海关凭证', status: 'completed' }, type: 'process' },
    { id: 'd2-3', position: { x: 400, y: 100 }, data: { label: '发起抗辩起诉', status: 'pending' }, type: 'process' },
    { id: 'd2-4', position: { x: 250, y: 200 }, data: { label: '走和解通道', status: 'pending', branchType: 'sub' }, type: 'process' },
    { id: 'd2-5', position: { x: 550, y: 200 }, data: { label: '递交传票文书', status: 'pending', branchType: 'sub' }, type: 'process' },
];

export const demoEdges2: Edge[] = [
    { id: 'e2-1-2', source: 'd2-1', target: 'd2-2', type: 'step' },
    { id: 'e2-1-3', source: 'd2-1', target: 'd2-3', type: 'step' },
    { id: 'e2-3-4', source: 'd2-3', target: 'd2-4', type: 'step' },
    { id: 'e2-3-5', source: 'd2-3', target: 'd2-5', type: 'step' },
];

export const demoMessages2: Message[] = [
    { id: 'demo2-1', role: 'user', content: '我方有一批货物在欧盟海关被扣留，买家以此为由申请仅退款。我们需要提起抗辩，给我列个处理清单。', timestamp: Date.now() - 60000 },
    {
        id: 'demo2-2', role: 'assistant', content: `针对此次被扣货退款危机，我们首要原则是“止损为上”，具体操作节点如下：

### 1. 证据保全期
必须在平台时效内拿到不可抗力证明 [NODE: 搜集海关凭证]

### 2. 争议处理分流 [NODE: 发起抗辩起诉]
拿到证据后，我们有两条路可以走：
- **方案 A (低成本)**：通过商务磋商给买家补偿，让其撤诉 [NODE: 走和解通道]
- **方案 B (强硬刚到底)**：通过国际律所给当地买家和平台下发公函 [NODE: 递交传票文书]

建议先从右上角节点开启和解尝试。`, timestamp: Date.now() - 30000
    }
];

// Demo 3: 长篇小说剧本创作
export const demoNodes3: Node[] = [
    { id: 'd3-1', position: { x: 250, y: 0 }, data: { label: '📖 赛博飞升序幕', status: 'completed' }, type: 'process' },
    { id: 'd3-2', position: { x: 100, y: 100 }, data: { label: '主角潜入霓虹城', status: 'active' }, type: 'process' },
    { id: 'd3-3', position: { x: 400, y: 100 }, data: { label: '机械兵团暴动', status: 'pending' }, type: 'process' },
    { id: 'd3-4', position: { x: 0, y: 200 }, data: { label: '暗巷遭遇战', status: 'completed', branchType: 'sub' }, type: 'process' },
    { id: 'd3-5', position: { x: 200, y: 200 }, data: { label: '破解终极密码', status: 'pending', branchType: 'sub' }, type: 'process' },
];

export const demoEdges3: Edge[] = [
    { id: 'e3-1-2', source: 'd3-1', target: 'd3-2', type: 'step' },
    { id: 'e3-1-3', source: 'd3-1', target: 'd3-3', type: 'step' },
    { id: 'e3-2-4', source: 'd3-2', target: 'd3-4', type: 'step' },
    { id: 'e3-2-5', source: 'd3-2', target: 'd3-5', type: 'step' },
];

export const demoMessages3: Message[] = [
    { id: 'demo3-1', role: 'user', content: '我的赛博朋克小说进展到第一卷末尾了。主角刚进赛博城市，需要一场高潮戏！', timestamp: Date.now() - 60000 },
    {
        id: 'demo3-2', role: 'assistant', content: `绝佳的故事节点！我们可以这样设计第一卷的高潮编排：

首先进入关键主线：[NODE: 主角潜入霓虹城] 和随之而来的天地异变 [NODE: 机械兵团暴动]。

关于**潜入行动**，我们可以延展两条伏笔：
1. **武戏爆发**：主角身份意外败露，在雨夜上演惊险追车和 [NODE: 暗巷遭遇战]。
2. **文戏悬疑**：他在追杀中躲进废弃机房，并且尝试 [NODE: 破解终极密码] 拿到敌人的核心把柄！

您可以将上述任何一个碎片在思维框中发散扩写。`, timestamp: Date.now() - 30000
    }
];

export const demoSets = [
    { title: '📦 场景一：企业遗留代码风控链路梳理', nodes: demoNodes1, edges: demoEdges1, messages: demoMessages1 },
    { title: '⚖️ 场景二：跨境电商争议多线法务应对', nodes: demoNodes2, edges: demoEdges2, messages: demoMessages2 },
    { title: '📖 场景三：废土长篇连载小说高潮编排', nodes: demoNodes3, edges: demoEdges3, messages: demoMessages3 },
];
