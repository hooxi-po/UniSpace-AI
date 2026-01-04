import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize once and re-use across the whole front-end
// NOTE: 你必须通过 .env 或环境变量注入 API_KEY
const genAI = new GoogleGenerativeAI(process.env.API_KEY || "");
// 使用目前普遍可用的模型名称（如果你的账号已开通其他 preview 模型，可自行替换）
const MODEL_NAME = "gemini-pro";
const model = genAI.getGenerativeModel({ model: MODEL_NAME });

// System instruction for the chat assistant
const CHAT_SYSTEM_INSTRUCTION = `
你是 UniSpace AI，一个大学校园房产管理系统的智能助手。
你的语气应该是专业、高效且乐于助人的（类似企业级 SaaS 软件的助手）。
你可以帮助管理员制定关于房间分配、维保优先级排序和能源效率的决策。
如果被问及具体数据，请扮演界面引导者的角色（因为在当前上下文中你无法直接读取 React 的实时状态，请引导用户如何查看或询问数据）。
请始终用中文回复。
`;

export interface MaintenanceAIResponse {
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  category: string;
  suggestedAction: string;
  summaryTitle: string;
}

export const analyzeMaintenanceRequest = async (
  description: string,
  location: string
): Promise<MaintenanceAIResponse> => {
  try {
    const prompt = `用户报告了位于 ${location} 的维保问题: \"${description}\"。\n请分析此请求并返回严格的 JSON（不要包含任何额外说明），格式示例如下：\n{\n  \"priority\": \"HIGH\",\n  \"category\": \"电气\",\n  \"suggestedAction\": \"立即断电并安排电工检查\",\n  \"summaryTitle\": \"电气故障\"\n}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    // 尝试只提取 JSON
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    const jsonStr = firstBrace !== -1 && lastBrace !== -1 ? text.slice(firstBrace, lastBrace + 1) : "{}";

    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("AI Analysis failed:", error);
    // Fallback values
    return {
      priority: "MEDIUM",
      category: "综合",
      suggestedAction: "请人工调查报告的问题。",
      summaryTitle: "维保请求",
    };
  }
};

export const sendChatMessage = async (
  history: { role: "user" | "model" | "system"; parts: { text: string }[] }[],
  newMessage: string
): Promise<string> => {
  try {
    // 将系统指令放在第一条
    const messages = [
      { role: "system", parts: [{ text: CHAT_SYSTEM_INSTRUCTION }] },
      ...history,
      { role: "user", parts: [{ text: newMessage }] },
    ];

    const chatModel = genAI.getChatModel({ model: MODEL_NAME });
    const chat = chatModel.startChat({ history: messages });
    const result = await chat.sendMessage(newMessage);
    return result.response.text();
  } catch (error) {
    console.error("Chat error:", error);
    return "抱歉，目前连接校园网络出现问题，请稍后再试。";
  }
};