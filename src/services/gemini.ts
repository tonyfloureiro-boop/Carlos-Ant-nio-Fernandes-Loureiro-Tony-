import { GoogleGenAI } from "@google/genai";
import { Transaction, Budget, Goal, RealityProfile } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getFinancialTips(
  transactions: Transaction[],
  budgets: Budget[],
  goals: Goal[],
  reality?: RealityProfile
) {
  if (!process.env.GEMINI_API_KEY) {
    return "AI configuration missing. Please add your GEMINI_API_KEY.";
  }

  const expenses = transactions.filter(t => t.type === 'expense');
  const context = {
    summary: {
      totalIncome: transactions.filter(t => t.type === 'income').reduce((ss, t) => ss + t.amount, 0),
      totalExpenses: expenses.reduce((ss, t) => ss + t.amount, 0),
      categories: expenses.reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>),
    },
    recurringHighSpending: expenses
      .reduce((acc, t) => {
        const key = `${t.category}-${t.description}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    budgets,
    goals,
    lifeContext: reality ? {
      filhos: reality.childrenCount,
      moradia: reality.housingType === 'rented' ? 'alugada' : reality.housingType === 'owned' ? 'própria' : reality.housingType === 'financed' ? 'financiada' : 'familiar',
      estadoCivil: reality.maritalStatus,
      trabalho: reality.employmentStatus,
      planoSaude: reality.hasHealthInsurance ? 'sim' : 'não',
      veiculo: reality.hasVehicle ? 'sim' : 'não'
    } : null
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Você é um consultor financeiro especialista. Analise os seguintes dados (JSON) e forneça 3 dicas acionáveis, curtas e personalizadas em português para reduzir custos e atingir as metas.
      
      Leve em conta a 'lifeContext' (contexto de vida) do usuário se disponível para que as dicas sejam realistas (ex: quem tem filhos tem gastos diferentes de solteiros).
      
      Identifique padrões de gastos recorrentes ou categorias elevadas.
      
      Dados Financeiros: ${JSON.stringify(context)}
      
      Formato esperado: Apenas as 3 dicas em formato de lista (• Dica 1 \n • Dica 2 \n • Dica 3). Seja direto e prático.`,
    });

    return response.text || "Não foi possível gerar dicas no momento.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Erro ao gerar dicas financeiras.";
  }
}
