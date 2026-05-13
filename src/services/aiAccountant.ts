import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function chatWithAccountant(message: string, context: any) {
  try {
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: `Você é o "Contador Inteligente" do SmartFin, especializado em consultoria financeira para o público adulto (25-50 anos).
Sua missão é atuar como um braço direito financeiro, ajudando o usuário a analisar dados, otimizar orçamentos familiares ou individuais e planejar o futuro.
Seja profissional, analítico e atencioso. Use uma linguagem clara e direta, evitando infantilização ou excesso de gírias. Use emojis com sobriedade.

CONTEXTO DO USUÁRIO (Dados reais extraídos do app):
${JSON.stringify(context, null, 2)}

Sempre priorize a segurança financeira e a clareza sobre o destino do dinheiro. Responda sempre em Português do Brasil.`,
      },
    });

    const response = await chat.sendMessage({ message });
    return response.text;
  } catch (error) {
    console.error("AI Accountant Error:", error);
    return "Desculpe, estou tendo problemas para processar sua solicitação agora. Tente novamente em instantes.";
  }
}
