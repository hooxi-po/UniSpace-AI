import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// System instruction for the chat assistant
const CHAT_SYSTEM_INSTRUCTION = `
你是 UniSpace AI，一个大学校园房产管理系统的智能助手。
你的语气应该是专业、高效且乐于助人的（类似企业级 SaaS 软件的助手）。
你可以帮助管理员制定关于房间分配、维保优先级排序和能源效率的决策。
如果被问及具体数据，请扮演界面引导者的角色（因为在当前上下文中你无法直接读取 React 的实时状态，请引导用户如何查看或询问数据）。
请始终用中文回复。
`;

export const analyzeMaintenanceRequest = async (description: string, location: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `用户报告了位于 ${location} 的维保问题: "${description}". 
      请分析此请求并提供 JSON 响应，包含优先级、类别和简短的建议措施。
      所有文本字段必须使用中文。`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            priority: {
              type: Type.STRING,
              enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
              description: "基于安全和对校园运营影响的紧迫程度 (CRITICAL, HIGH, MEDIUM, LOW).",
            },
            category: {
              type: Type.STRING,
              description: "行业类别（例如：水管、电气、暖通空调、IT、结构）。",
            },
            suggestedAction: {
              type: Type.STRING,
              description: "给设施团队的一句话初步建议步骤（中文）。",
            },
            summaryTitle: {
                type: Type.STRING,
                description: "工单的简明标题，3-5个字（中文）。"
            }
          },
          required: ["priority", "category", "suggestedAction", "summaryTitle"],
        },
      },
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("AI Analysis failed:", error);
    // Fallback
    return {
      priority: "MEDIUM",
      category: "综合",
      suggestedAction: "请人工调查报告的问题。",
      summaryTitle: "维保请求"
    };
  }
};

export const sendChatMessage = async (history: { role: string; parts: { text: string }[] }[], newMessage: string) => {
  try {
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: CHAT_SYSTEM_INSTRUCTION,
      },
      history: history,
    });

    const result = await chat.sendMessage({ message: newMessage });
    return result.text;
  } catch (error) {
    console.error("Chat error:", error);
    return "抱歉，目前连接校园网络出现问题，请稍后再试。";
  }
};