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
      contents: `Você é um consultor financeiro especialista para um público adulto (25-50 anos). Analise os seguintes dados (JSON) e forneça 3 dicas acionáveis, curtas e personalizadas em português para reduzir custos, aumentar a segurança financeira e atingir metas de médio/longo prazo.
      
      Leve em conta a 'lifeContext' (contexto de vida) do usuário se disponível (ex: dependentes, moradia, estabilidade profissional) para que as dicas sejam maduras e realistas.
      
      Evite gírias. Seja profissional, direto e prático.
      
      Dados Financeiros: ${JSON.stringify(context)}
      
      Formato esperado: Apenas as 3 dicas em formato de lista (• Dica 1 \n • Dica 2 \n • Dica 3).`,
    });

    return response.text || "Não foi possível gerar dicas no momento.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Erro ao gerar dicas financeiras.";
  }
}

export async function generateMonthlyReport(
  month: string,
  transactions: Transaction[],
  budgets: Budget[],
  goals: Goal[],
  reality?: RealityProfile
) {
  if (!process.env.GEMINI_API_KEY) {
    return "AI configuration missing.";
  }

  const expenses = transactions.filter(t => t.type === 'expense');
  const context = {
    month,
    summary: {
      totalIncome: transactions.filter(t => t.type === 'income').reduce((ss, t) => ss + t.amount, 0),
      totalExpenses: expenses.reduce((ss, t) => ss + t.amount, 0),
      balance: transactions.reduce((ss, t) => ss + (t.type === 'income' ? t.amount : -t.amount), 0),
      categories: expenses.reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>),
    },
    budgets,
    goals,
    lifeContext: reality ? {
      filhos: reality.childrenCount,
      moradia: reality.housingType,
      trabalho: reality.employmentStatus,
    } : null
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Você é um CFO (Diretor Financeiro) pessoal para um público maduro entre 25 e 50 anos. Gere um relatório mensal de fechamento em Markdown para o mês ${month}.
      
      O relatório deve ser analítico, profissional e focado em estabilidade e crescimento financeiro.
      Inclua:
      1. Visão Geral (Resumo executivo de ganhos, gastos e saldo).
      2. Análise por Categoria (Comparativo com orçamentos e tendências).
      3. Metas e Patrimônio (Progresso em metas de vida e investimentos).
      4. Diagnóstico e Estratégia (3 passos práticos para otimização no mês seguinte).
      
      Use tabelas markdown para clareza. 
      Linguagem: Português do Brasil, sem gírias, focada em resultados.
      
      Dados Financeiros: ${JSON.stringify(context)}
      
      Retorne apenas o Markdown do relatório.`,
    });

    return response.text || "Não foi possível gerar o relatório.";
  } catch (error) {
    console.error("Gemini Monthly Report Error:", error);
    return "Erro ao gerar relatório mensal.";
  }
}
