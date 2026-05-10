import * as React from "react";
import { useEffect, useState, useMemo } from "react";
import { 
  Plus, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Wallet, 
  TrendingUp, 
  Target, 
  Bell, 
  PieChart as PieChartIcon,
  PlusCircle,
  X,
  LogOut,
  Sparkles,
  Calendar,
  LayoutDashboard,
  Coins,
  History,
  TrendingDown
} from "lucide-react";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User, 
  signOut 
} from "firebase/auth";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  Timestamp, 
  orderBy, 
  deleteDoc,
  doc,
  updateDoc
} from "firebase/firestore";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from "recharts";
import { motion, AnimatePresence } from "motion/react";
import { auth, db } from "./lib/firebase";
import { Transaction, Budget, Goal, Bill, UserProfile, Investment } from "./types";
import { cn, formatCurrency } from "./lib/utils";
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from "./components/UI";
import { getFinancialTips } from "./services/gemini";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Constants
const CATEGORIES = [
  "Moradia", "Alimentação", "Transporte", "Lazer", "Saúde", "Educação", "Investimentos", "Outros"
];
const COLORS = ["#10b981", "#f43f5e", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#64748b"];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'investments'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInvestmentModalOpen, setIsInvestmentModalOpen] = useState(false);
  const [aiTips, setAiTips] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Form State
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState("");

  // Investment Form State
  const [invSymbol, setInvSymbol] = useState("");
  const [invAssetType, setInvAssetType] = useState<Investment['assetType']>('stock');
  const [invQuantity, setInvQuantity] = useState("");
  const [invPrice, setInvPrice] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const qTransactions = query(
      collection(db, "transactions"),
      where("userId", "==", user.uid),
      orderBy("date", "desc")
    );
    const unsubT = onSnapshot(qTransactions, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: (doc.data().date as Timestamp).toDate(),
        createdAt: (doc.data().createdAt as Timestamp).toDate()
      })) as Transaction[];
      setTransactions(data);
    });

    const qGoals = query(collection(db, "goals"), where("userId", "==", user.uid));
    const unsubG = onSnapshot(qGoals, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Goal[];
      setGoals(data);
    });

    const qBills = query(collection(db, "bills"), where("userId", "==", user.uid), orderBy("dueDate", "asc"));
    const unsubB = onSnapshot(qBills, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        dueDate: (doc.data().dueDate as Timestamp).toDate(),
        createdAt: (doc.data().createdAt as Timestamp).toDate()
      })) as Bill[];
      setBills(data);
    });

    const qInv = query(collection(db, "investments"), where("userId", "==", user.uid));
    const unsubInv = onSnapshot(qInv, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        purchaseDate: (doc.data().purchaseDate as Timestamp).toDate(),
        createdAt: (doc.data().createdAt as Timestamp).toDate()
      })) as Investment[];
      setInvestments(data);
    });

    return () => {
      unsubT();
      unsubG();
      unsubInv();
      unsubB();
    };
  }, [user]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login Error:", error);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !amount) return;

    try {
      await addDoc(collection(db, "transactions"), {
        userId: user.uid,
        amount: parseFloat(amount),
        type,
        category,
        description,
        date: Timestamp.now(),
        createdAt: Timestamp.now()
      });
      setIsModalOpen(false);
      setAmount("");
      setDescription("");
    } catch (error) {
      console.error("Add Transaction error:", error);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta transação?")) return;
    try {
      await deleteDoc(doc(db, "transactions", id));
    } catch (error) {
      console.error("Delete Error:", error);
    }
  };

  const fetchAiTips = async () => {
    setIsAiLoading(true);
    const tips = await getFinancialTips(transactions, budgets, goals);
    setAiTips(tips);
    setIsAiLoading(false);
  };

  const handleAddInvestment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !invSymbol || !invQuantity || !invPrice) return;

    try {
      await addDoc(collection(db, "investments"), {
        userId: user.uid,
        symbol: invSymbol.toUpperCase(),
        assetType: invAssetType,
        quantity: parseFloat(invQuantity),
        purchasePrice: parseFloat(invPrice),
        purchaseDate: Timestamp.now(),
        createdAt: Timestamp.now()
      });
      setIsInvestmentModalOpen(false);
      setInvSymbol("");
      setInvQuantity("");
      setInvPrice("");
    } catch (error) {
      console.error("Add Investment error:", error);
    }
  };

  const handleDeleteInvestment = async (id: string) => {
    if (!confirm("Excluir este investimento?")) return;
    try {
      await deleteDoc(doc(db, "investments", id));
    } catch (error) {
      console.error("Delete Error:", error);
    }
  };

  const totals = useMemo(() => {
    const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expenses = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    return { income, expenses, balance: income - expenses };
  }, [transactions]);

  const chartData = useMemo(() => {
    const cats = transactions
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>);

    return Object.entries(cats).map(([name, value]) => ({ name, value }));
  }, [transactions]);

  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-slate-50 font-sans text-slate-400">Carregando SmartFin...</div>;

  if (!user) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#F8FAFC] p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-emerald-500 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-emerald-500/30">
              <Wallet size={40} />
            </div>
          </div>
          <div className="space-y-3">
            <h1 className="text-5xl font-bold tracking-tight text-slate-900">SmartFin</h1>
            <p className="text-slate-500 text-lg font-medium">Controle suas finanças com inteligência e elegância.</p>
          </div>
          <Button onClick={handleLogin} className="w-full h-14 text-lg gap-3 bg-slate-900 hover:bg-slate-800 shadow-xl">
            Entrar com Google
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex bg-[#F8FAFC] h-screen overflow-hidden font-sans text-slate-800">
      {/* Sidebar - Desktop */}
      <aside className="w-64 bg-slate-900 flex flex-col p-6 h-full shrink-0 hidden md:flex">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Wallet size={18} className="text-white" />
          </div>
          <span className="text-white font-bold text-xl tracking-tight">SmartFin</span>
        </div>
        
        <nav className="space-y-1 flex-1">
          <SidebarItem 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <SidebarItem 
            icon={<Coins size={20} />} 
            label="Investimentos" 
            active={activeTab === 'investments'} 
            onClick={() => setActiveTab('investments')} 
          />
          <SidebarItem icon={<Calendar size={20} />} label="Contas a Pagar" />
          <SidebarItem icon={<Target size={20} />} label="Objetivos" />
          <SidebarItem icon={<History size={20} />} label="Histórico" />
        </nav>

        <div className="mt-auto space-y-4">
          {goals.length > 0 && (
            <div className="bg-indigo-600 rounded-2xl p-5 shadow-lg shadow-indigo-600/20">
              <p className="text-xs text-indigo-100 font-semibold mb-2 uppercase tracking-wide">Meta em Destaque</p>
              <h4 className="text-white font-bold text-sm mb-3 truncate">{goals[0].title}</h4>
              <div className="h-2 bg-indigo-900/40 rounded-full mb-2 overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (goals[0].currentAmount / goals[0].targetAmount) * 100)}%` }}
                  className="h-full bg-white rounded-full transition-all duration-500"
                />
              </div>
              <p className="text-white font-mono text-xs font-bold">
                {formatCurrency(goals[0].currentAmount)} <span className="opacity-60 text-[10px]">/ {formatCurrency(goals[0].targetAmount)}</span>
              </p>
            </div>
          )}
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-rose-400 transition-colors">
            <LogOut size={20} />
            <span className="font-medium">Sair da conta</span>
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col h-full overflow-hidden pb-20 md:pb-0">
        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between shrink-0">
          <div className="md:hidden flex items-center gap-2">
             <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                <Wallet size={16} className="text-white" />
             </div>
             <span className="text-slate-900 font-bold text-lg tracking-tight">SmartFin</span>
          </div>
          <div className="hidden md:block">
            <h1 className="text-2xl font-bold text-slate-900">Olá, {user.displayName?.split(' ')[0]}!</h1>
            <p className="text-sm text-slate-500 font-medium tracking-tight">Seu controle financeiro está atualizado.</p>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <Button 
               onClick={() => { setType('income'); setIsModalOpen(true); }}
               className="bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 gap-2 h-10 px-3 md:h-12 md:px-5"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Nova Entrada</span>
            </Button>
            <Button 
              onClick={() => { setType('expense'); setIsModalOpen(true); }}
              className="bg-rose-500 text-white hover:bg-rose-600 shadow-lg shadow-rose-500/20 gap-2 h-10 px-3 md:h-12 md:px-5"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Nova Saída</span>
            </Button>
            <img src={user.photoURL || ""} alt="Avatar" className="w-8 h-8 md:w-10 md:h-10 rounded-full border border-slate-100" />
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-10 animate-in fade-in duration-1000">
          <div className="max-w-[1600px] mx-auto space-y-10 pb-12">
            
            {activeTab === 'dashboard' ? (
              <>
                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                  <StatCard 
                    label="Saldo Total" 
                    value={totals.balance} 
                    className="bg-white shadow-sm hover:shadow-md transition-shadow"
                  />
                  <StatCard 
                    label="Entradas" 
                    value={totals.income} 
                    type="income"
                    className="bg-white shadow-sm hover:shadow-md transition-shadow"
                  />
                  <StatCard 
                    label="Saídas" 
                    value={totals.expenses} 
                    type="expense"
                    className="bg-white shadow-sm hover:shadow-md transition-shadow"
                    indicatorColor="bg-rose-100"
                  />
                  <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-500/20 flex flex-col justify-center min-h-[120px]">
                    <p className="text-indigo-100 text-[10px] font-semibold uppercase tracking-wider">Economia IA (Meta)</p>
                    <h3 className="text-2xl md:text-3xl font-bold mt-1 tracking-tight">{formatCurrency(totals.balance * 0.2)}</h3>
                    <p className="text-white/80 text-[10px] mt-2 italic font-medium">20% do seu saldo atual.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Main Chart */}
                  <div className="lg:col-span-8 flex flex-col gap-8">
                    <Card className="rounded-[2.5rem] p-8 border-slate-100 shadow-sm grow flex flex-col min-h-[450px]">
                      <div className="flex justify-between items-center mb-10">
                        <CardTitle className="text-slate-800 flex items-center gap-3 text-lg font-bold">
                          <PieChartIcon size={24} className="text-slate-400" />
                          Concentração de Gastos
                        </CardTitle>
                        <div className="flex gap-2 p-1.5 bg-slate-50 rounded-full">
                          <span className="px-5 py-2 bg-white shadow-sm rounded-full text-[10px] uppercase font-bold tracking-wider">Mês Atual</span>
                        </div>
                      </div>
                      <div className="grow w-full">
                        {chartData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={85}
                                outerRadius={135}
                                paddingAngle={10}
                                dataKey="value"
                                stroke="none"
                              >
                                {chartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip 
                                contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', padding: '20px' }}
                                itemStyle={{ fontWeight: '800' }}
                                formatter={(val: number) => formatCurrency(val)}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-6">
                            <PieChartIcon size={64} className="opacity-10" />
                            <p className="font-semibold text-lg">Comece a registrar seus gastos para ver a análise.</p>
                          </div>
                        )}
                      </div>
                    </Card>

                    {/* AI Tips */}
                    <Card className="bg-emerald-50 border-emerald-100 rounded-[2rem] p-8 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 shrink-0">
                              <Sparkles size={24} />
                            </div>
                            <div>
                                <h4 className="font-bold text-emerald-900 text-xl leading-none">Consultor Smart IA</h4>
                                <p className="text-emerald-700/60 text-xs mt-1 font-medium italic">Análise baseada no seu comportamento financeiro</p>
                            </div>
                        </div>
                        <Button 
                          onClick={fetchAiTips} 
                          disabled={isAiLoading}
                          className="bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/30 h-12 px-8 text-xs font-bold uppercase tracking-widest w-full sm:w-auto rounded-xl"
                        >
                          {isAiLoading ? "Processando..." : "Analisar Gastos"}
                        </Button>
                      </div>
                      <div className="text-emerald-800 text-md leading-relaxed whitespace-pre-wrap font-medium bg-white/40 p-6 rounded-2xl border border-emerald-100/50">
                        {aiTips || "Seu consultor está pronto. Clique no botão acima para analisar seus padrões e identificar onde você pode economizar dinheiro agora."}
                      </div>
                    </Card>
                  </div>

                  {/* Sidebar Widgets */}
                  <div className="lg:col-span-4 space-y-8">
                    {/* Goals List */}
                    <div className="space-y-6">
                        <h4 className="font-bold text-slate-900 text-xl tracking-tight">Metas Ativas</h4>
                        <div className="grid grid-cols-1 gap-5">
                          {goals.length === 0 ? (
                            <div className="p-12 border-2 border-dashed border-slate-200 rounded-[2rem] text-center bg-white/50">
                                <Target size={40} className="mx-auto text-slate-300 mb-4 opacity-50" />
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhuma meta definida</p>
                            </div>
                          ) : (
                            goals.map(goal => (
                              <Card key={goal.id} className="p-6 rounded-3xl border-slate-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
                                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full translate-x-12 -translate-y-12 group-hover:scale-150 transition-transform duration-500" />
                                  <div className="relative z-10">
                                      <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h5 className="font-black text-slate-900 text-lg leading-tight">{goal.title}</h5>
                                            <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mt-1.5 flex items-center gap-1">
                                                <Target size={10} /> Em andamento
                                            </p>
                                        </div>
                                        <span className="text-sm font-black text-indigo-600 bg-indigo-100 px-3 py-1.5 rounded-xl">
                                          {Math.round((goal.currentAmount / goal.targetAmount) * 100)}%
                                        </span>
                                      </div>
                                      <div className="h-2 bg-slate-100 rounded-full mb-4 overflow-hidden">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.min(100, (goal.currentAmount / goal.targetAmount) * 100)}%` }}
                                            className="h-full bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(79,70,229,0.3)]"
                                        />
                                      </div>
                                      <div className="flex justify-between items-center text-xs font-bold font-mono">
                                        <span className="text-slate-900">{formatCurrency(goal.currentAmount)}</span>
                                        <span className="text-slate-400/60">ALVO: {formatCurrency(goal.targetAmount)}</span>
                                      </div>
                                  </div>
                              </Card>
                            ))
                          )}
                        </div>
                    </div>

                    {/* Bill Alerts */}
                    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-8">
                        <h4 className="font-bold text-slate-900 text-lg flex items-center gap-3">
                          <span className="w-3 h-3 bg-amber-500 rounded-full shadow-lg shadow-amber-500/50"></span>
                          Compromissos Financeiros
                        </h4>
                        <div className="space-y-5">
                          {bills.length === 0 ? (
                            <div className="text-center py-6">
                                <Calendar size={32} className="mx-auto text-slate-200 mb-3" />
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sem contas registradas</p>
                            </div>
                          ) : (
                            bills.map(bill => (
                              <div key={bill.id} className="flex items-center justify-between p-5 bg-slate-50/50 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-md transition-all">
                                  <div>
                                    <p className="text-sm font-bold text-slate-900">{bill.title}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-wide">
                                        Vence {format(bill.dueDate, "dd/MM")}
                                    </p>
                                  </div>
                                  <p className="text-md font-black text-slate-900 font-mono">{formatCurrency(bill.amount)}</p>
                              </div>
                            ))
                          )}
                        </div>
                    </div>
                  </div>

                  {/* Spreadsheet Area */}
                  <div className="col-span-1 lg:col-span-12 space-y-6">
                    <div className="flex items-center justify-between">
                        <h4 className="font-bold text-2xl tracking-tight text-slate-900">Histórico de Movimentações</h4>
                        <div className="hidden sm:flex text-xs font-bold text-slate-400 uppercase tracking-widest items-center gap-3 cursor-pointer hover:text-slate-600 transition-colors">
                          <History size={16} />
                          Exportar Dados
                        </div>
                    </div>
                    <Card className="rounded-[2.5rem] border-slate-100 shadow-sm overflow-hidden min-h-0 bg-white">
                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead>
                              <tr className="bg-slate-50/80 border-b border-slate-100">
                                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Data</th>
                                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Descrição</th>
                                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Categoria</th>
                                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Valor</th>
                                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {transactions.length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="px-8 py-20 text-center text-slate-300 font-medium bg-white">
                                    <History size={48} className="mx-auto mb-4 opacity-5" />
                                    <p>Sua lista de transações aparecerá aqui.</p>
                                  </td>
                                </tr>
                              ) : (
                                transactions.map((t) => (
                                  <tr key={t.id} className="hover:bg-slate-50/30 transition-colors group bg-white">
                                    <td className="px-8 py-5 text-slate-500 font-mono text-xs font-semibold">
                                      {format(t.date, "dd MMM", { locale: ptBR })}
                                    </td>
                                    <td className="px-8 py-5">
                                      <div className="font-bold text-slate-900 group-hover:translate-x-1 transition-transform">{t.description || "Transação sem nome"}</div>
                                    </td>
                                    <td className="px-8 py-5">
                                      <span className={cn(
                                        "px-3 py-1 text-[10px] font-black rounded-lg uppercase tracking-wider",
                                        t.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                      )}>
                                        {t.category}
                                      </span>
                                    </td>
                                    <td className={cn(
                                      "px-8 py-5 text-right font-black font-mono leading-none",
                                      t.type === 'income' ? 'text-emerald-500' : 'text-rose-500'
                                    )}>
                                      {t.type === 'income' ? '+ ' : '- '}{formatCurrency(t.amount)}
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                      <button 
                                        onClick={() => t.id && handleDeleteTransaction(t.id)}
                                        className="p-2 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 shadow-sm"
                                      >
                                        <X size={16} />
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile List */}
                        <div className="md:hidden divide-y divide-slate-50 bg-white">
                          {transactions.length === 0 ? (
                            <div className="px-8 py-20 text-center text-slate-300 font-medium">
                              <History size={48} className="mx-auto mb-4 opacity-10" />
                              <p>Nenhuma movimentação.</p>
                            </div>
                          ) : (
                            transactions.map((t) => (
                              <div key={t.id} className="p-4 flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                                    t.type === 'income' ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'
                                  )}>
                                    {t.type === 'income' ? <ArrowUpCircle size={20} /> : <ArrowDownCircle size={20} />}
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-900 text-sm leading-tight">{t.description || "Transação"}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-[10px] font-bold text-slate-400 uppercase">{format(t.date, "dd MMM", { locale: ptBR })}</span>
                                      <span className="w-1 h-1 bg-slate-200 rounded-full" />
                                      <span className="text-[10px] font-bold text-slate-400 capitalize">{t.category}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  <p className={cn(
                                    "font-black font-mono text-sm leading-none",
                                    t.type === 'income' ? 'text-emerald-500' : 'text-rose-500'
                                  )}>
                                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                                  </p>
                                  <button 
                                    onClick={() => t.id && handleDeleteTransaction(t.id)}
                                    className="p-1.5 text-slate-300 hover:text-rose-500"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                    </Card>
                  </div>
                </div>
              </>
            ) : (
              // Investments Tab
              <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Carteira de Ativos</h2>
                    <p className="text-slate-500 font-medium">Acompanhe seu patrimônio e performance de mercado.</p>
                  </div>
                  <Button onClick={() => setIsInvestmentModalOpen(true)} className="bg-slate-900 hover:bg-slate-800 gap-2 h-12 px-6 shadow-xl shadow-slate-900/20">
                    <PlusCircle size={20} />
                    Adicionar Novo Ativo
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                  <div className="col-span-1 md:col-span-8 space-y-8">
                    {/* Modal Content - Mobile Optimized Padding */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                      <Card className="p-4 md:p-6 rounded-3xl bg-white border-slate-100 shadow-sm flex flex-col justify-between min-h-[110px] md:min-h-[140px]">
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest leading-none">Total Disponível</p>
                        <h3 className="text-2xl font-black mt-2 font-mono">
                          {formatCurrency(totals.balance)}
                        </h3>
                        <div className="mt-4 flex items-center gap-1 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                          <Wallet size={12} />
                          <span>Saldo p/ aporte</span>
                        </div>
                      </Card>
                      <Card className="p-4 md:p-6 rounded-3xl bg-white border-slate-100 shadow-sm flex flex-col justify-between min-h-[110px] md:min-h-[140px]">
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest leading-none">Capital em Ativos</p>
                        <h3 className="text-2xl font-black mt-2 font-mono text-indigo-600">
                          {formatCurrency(investments.reduce((acc, inv) => acc + (inv.quantity * inv.purchasePrice), 0))}
                        </h3>
                        <div className="mt-4 w-full h-1.5 bg-indigo-50 rounded-full"></div>
                      </Card>
                      <Card className="p-4 md:p-6 rounded-3xl bg-slate-900 text-white border-none shadow-xl shadow-slate-900/20 flex flex-col justify-between min-h-[110px] md:min-h-[140px]">
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest leading-none">Diversificação</p>
                        <h3 className="text-2xl font-black mt-2 font-mono">
                          {new Set(investments.map(i => i.assetType)).size} Classes
                        </h3>
                        <p className="text-white/60 text-[10px] font-bold mt-4 uppercase tracking-widest">{investments.length} Ativos</p>
                      </Card>
                    </div>

                    {/* Tabela de Ativos / Lista Mobile */}
                    <Card className="rounded-3xl border-slate-100 shadow-sm overflow-hidden bg-white min-h-0">
                      {/* Desktop Table */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left text-sm min-w-[600px]">
                          <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                              <th className="px-6 md:px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ativo</th>
                              <th className="px-6 md:px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Qtd</th>
                              <th className="px-6 md:px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Preço Médio</th>
                              <th className="px-6 md:px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total Investido</th>
                              <th className="px-6 md:px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {investments.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-8 py-20 text-center text-slate-300 font-medium h-48">
                                  <Coins size={48} className="mx-auto mb-4 opacity-10" />
                                  <p>Nenhum ativo na carteira.</p>
                                </td>
                              </tr>
                            ) : (
                              investments.map(inv => (
                                <tr key={inv.id} className="hover:bg-slate-50/30 group transition-colors">
                                  <td className="px-6 md:px-8 py-5">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 font-black text-xs shrink-0">
                                        {inv.symbol.substring(0, 2)}
                                      </div>
                                      <div>
                                        <p className="font-bold text-slate-900 leading-tight">{inv.symbol}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{inv.assetType}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 md:px-8 py-5 font-mono text-slate-600 font-bold text-center">{inv.quantity}</td>
                                  <td className="px-6 md:px-8 py-5 text-right font-mono font-bold text-slate-900">{formatCurrency(inv.purchasePrice)}</td>
                                  <td className="px-6 md:px-8 py-5 text-right font-mono font-black text-slate-900">
                                    {formatCurrency(inv.quantity * inv.purchasePrice)}
                                  </td>
                                  <td className="px-6 md:px-8 py-5 text-right">
                                    <button 
                                      onClick={() => inv.id && handleDeleteInvestment(inv.id)}
                                      className="p-2 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-xl md:opacity-0 md:group-hover:opacity-100 transition-all opacity-100"
                                    >
                                      <X size={16} />
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile List */}
                      <div className="md:hidden divide-y divide-slate-50 bg-white">
                         {investments.length === 0 ? (
                            <div className="px-8 py-20 text-center text-slate-300 font-medium">
                              <Coins size={48} className="mx-auto mb-4 opacity-10" />
                              <p>Nenhum ativo.</p>
                            </div>
                         ) : (
                            investments.map(inv => (
                              <div key={inv.id} className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-black text-[10px]">
                                    {inv.symbol.substring(0, 2)}
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-900 text-sm">{inv.symbol}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Qtd: {inv.quantity}</p>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <p className="font-black font-mono text-sm text-slate-900">
                                    {formatCurrency(inv.quantity * inv.purchasePrice)}
                                  </p>
                                  <button 
                                    onClick={() => inv.id && handleDeleteInvestment(inv.id)}
                                    className="p-1 px-2 bg-rose-50 text-rose-500 rounded-lg text-[9px] font-black uppercase tracking-tighter"
                                  >
                                    Remover
                                  </button>
                                </div>
                              </div>
                            ))
                         )}
                      </div>
                    </Card>
                  </div>

                  <div className="col-span-1 md:col-span-4 space-y-8 pb-10 md:pb-0">
                    {/* Alloc Chart */}
                    <Card className="p-6 rounded-3xl bg-white border-slate-100 shadow-sm h-[320px] md:h-[400px]">
                      <h4 className="font-bold text-slate-800 mb-6 flex items-center gap-2 uppercase text-[10px] tracking-widest text-slate-400">
                         Alocação por Tipo
                      </h4>
                      <div className="h-[200px] md:h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={investments.reduce((acc, inv) => {
                                const existing = acc.find(a => a.name === inv.assetType);
                                if (existing) existing.value += (inv.quantity * inv.purchasePrice);
                                else acc.push({ name: inv.assetType, value: (inv.quantity * inv.purchasePrice) });
                                return acc;
                              }, [] as any[])}
                              cx="50%"
                              cy="50%"
                              innerRadius={45}
                              outerRadius={75}
                              paddingAngle={5}
                              dataKey="value"
                              stroke="none"
                            >
                              {investments.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>

                    {/* AI Investment Tip */}
                    <Card className="bg-indigo-50 border-indigo-100 rounded-3xl p-6 shadow-sm">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 bg-indigo-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                          <Sparkles size={16} />
                        </div>
                        <h4 className="font-bold text-indigo-900">Análise de IA de Carteira</h4>
                      </div>
                      <p className="text-indigo-800 text-xs leading-relaxed font-medium">
                        Com base nos seus {investments.length} ativos, sua carteira parece bem posicionada. Considere diversificar em Fundos Imobiliários para gerar renda passiva recorrente.
                      </p>
                      <button className="mt-4 text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline transition-all">Ver relatório completo →</button>
                    </Card>
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white border-t border-slate-100 flex md:hidden items-center justify-around px-6 z-40">
        <MobileNavItem 
          icon={<LayoutDashboard size={24} />} 
          active={activeTab === 'dashboard'} 
          onClick={() => setActiveTab('dashboard')} 
        />
        <MobileNavItem 
          icon={<Coins size={24} />} 
          active={activeTab === 'investments'} 
          onClick={() => setActiveTab('investments')} 
        />
        <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-slate-900/20 -translate-y-4" onClick={() => setIsModalOpen(true)}>
           <Plus size={24} />
        </div>
        <MobileNavItem icon={<Target size={24} />} />
        <MobileNavItem icon={<History size={24} />} />
      </nav>

      {/* Transaction Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative w-full max-w-lg bg-white rounded-[2rem] shadow-2xl p-6 md:p-10 space-y-6 md:space-y-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center">
                <div>
                   <h2 className="text-3xl font-bold tracking-tight text-slate-900">Registrar</h2>
                   <p className="text-slate-500 text-sm font-medium mt-1">Preencha os dados da movimentação.</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddTransaction} className="space-y-6">
                <div className="flex p-1.5 bg-slate-100 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setType('expense')}
                    className={cn(
                      "flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all",
                      type === 'expense' ? "bg-white text-rose-500 shadow-md" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    Saída (-)
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('income')}
                    className={cn(
                      "flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all",
                      type === 'income' ? "bg-white text-emerald-500 shadow-md" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    Entrada (+)
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Valor do Montante</label>
                  <div className="relative group">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-black font-mono">R$</span>
                    <Input 
                      type="number" 
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0,00"
                      className="pl-12 h-14 text-2xl font-black font-mono border-slate-100 group-hover:border-slate-300 transition-colors rounded-2xl"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Categoria</label>
                     <select 
                       value={category}
                       onChange={(e) => setCategory(e.target.value)}
                       className="w-full h-12 px-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-slate-900 transition-all appearance-none outline-none"
                     >
                       {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                     </select>
                   </div>
                   <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Data</label>
                     <div className="h-12 px-4 bg-slate-50 rounded-2xl text-sm font-bold text-slate-900 flex items-center">
                        Hoje, {format(new Date(), "dd/MM")}
                     </div>
                   </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Descrição</label>
                  <Input 
                    placeholder="Ex: Almoço, Salário, Internet..." 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="h-12 px-4 border-slate-100 rounded-2xl"
                  />
                </div>

                <div className="pt-6">
                  <Button type="submit" className="w-full h-14 text-lg bg-slate-900 hover:bg-slate-800 rounded-2xl shadow-xl shadow-slate-900/20">
                    Confirmar Transação
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Subcomponents for cleaner organization
function SidebarItem({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl font-semibold transition-all duration-200",
        active 
          ? "bg-white/10 text-white shadow-inner" 
          : "text-slate-400 hover:text-white hover:bg-white/5"
      )}
    >
      <span className={active ? "text-emerald-400" : ""}>{icon}</span>
      <span className="text-sm tracking-tight">{label}</span>
      {active && <motion.div layoutId="active-pill" className="ml-auto w-1.5 h-1.5 bg-emerald-400 rounded-full" />}
    </button>
  );
}

function MobileNavItem({ icon, active = false, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "p-2 transition-all duration-200",
        active ? "text-emerald-500" : "text-slate-300"
      )}
    >
      {icon}
    </button>
  );
}

function StatCard({ label, value, subtext, trend, type, className, indicatorColor = "bg-emerald-100" }: any) {
  return (
    <Card className={cn("p-6 flex flex-col justify-between h-36 md:h-44 rounded-[2rem] hover:scale-[1.02] transition-transform", className)}>
      <div>
        <p className="text-slate-500 text-[11px] font-black uppercase tracking-widest leading-tight mb-2 opacity-60">{label}</p>
        <h3 className={cn(
          "text-2xl md:text-4xl font-black leading-none font-mono tracking-tighter",
          type === 'income' ? 'text-emerald-600' : type === 'expense' ? 'text-rose-600' : 'text-slate-900'
        )}>
          {formatCurrency(value)}
        </h3>
      </div>
      <div className="mt-4">
        {trend && (
           <p className={cn("text-[11px] font-black uppercase tracking-wider flex items-center gap-1", trend === 'up' ? 'text-emerald-500' : 'text-rose-500')}>
             {trend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
             {subtext}
           </p>
        )}
        {!trend && <div className={cn("w-full h-2 rounded-full", indicatorColor)}></div>}
      </div>
    </Card>
  );
}