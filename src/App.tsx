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
  TrendingDown,
  Users,
  Home,
  Heart,
  Briefcase,
  ShieldPlus,
  Car,
  Pencil
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
import { Transaction, Budget, Goal, Bill, UserProfile, Investment, RealityProfile } from "./types";
import { cn, formatCurrency } from "./lib/utils";
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from "./components/UI";
import { getFinancialTips } from "./services/gemini";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Constants
const INCOME_CATEGORIES = [
  "Salário", "Renda Extra", "Investimentos", "Vendas", "Restituição", "Presente", "Outros"
];
const EXPENSE_CATEGORIES = [
  "Moradia", "Alimentação", "Transporte", "Lazer", "Saúde", "Educação", "Compras", "Investimentos", "Dívidas", "Outros"
];
const COLOR_MAP: Record<string, string> = {
  "Moradia": "#3b82f6",
  "Alimentação": "#f59e0b",
  "Transporte": "#10b981",
  "Lazer": "#ec4899",
  "Saúde": "#f43f5e",
  "Educação": "#8b5cf6",
  "Investimentos": "#06b6d4",
  "Compras": "#f97316",
  "Dívidas": "#64748b",
  "Salário": "#10b981",
  "Renda Extra": "#059669",
  "Vendas": "#0d9488",
  "Restituição": "#4ade80",
  "Presente": "#fcd34d",
  "Outros": "#94a3b8"
};
const COLORS = ["#10b981", "#f43f5e", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#64748b"];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'investments' | 'budgets'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInvestmentModalOpen, setIsInvestmentModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [aiTips, setAiTips] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [realityProfile, setRealityProfile] = useState<RealityProfile | null>(null);
  const [isRealityModalOpen, setIsRealityModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isEditAmountModalOpen, setIsEditAmountModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<{
    id: string;
    description: string;
    amount: number;
    category: string;
    type: 'income' | 'expense';
    date: string;
    isDateUnspecified: boolean;
  } | null>(null);
  const [newAmountValue, setNewAmountValue] = useState("");

  // Form State
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [isDateUnspecified, setIsDateUnspecified] = useState(false);
  const [transactionDate, setTransactionDate] = useState(format(new Date(), "yyyy-MM-dd"));

  // Investment Form State
  const [invSymbol, setInvSymbol] = useState("");
  const [invAssetType, setInvAssetType] = useState<Investment['assetType']>('stock');
  const [invQuantity, setInvQuantity] = useState("");
  const [invPrice, setInvPrice] = useState("");

  // Reality Form State
  const [profileChildren, setProfileChildren] = useState(0);
  const [profileHousing, setProfileHousing] = useState<RealityProfile['housingType']>('family');
  const [profileMarital, setProfileMarital] = useState<RealityProfile['maritalStatus']>('single');
  const [profileEmployment, setProfileEmployment] = useState<RealityProfile['employmentStatus']>('employed');
  const [profileHealth, setProfileHealth] = useState(false);
  const [profileVehicle, setProfileVehicle] = useState(false);
  
  // Budget Form State
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetCategory, setBudgetCategory] = useState(EXPENSE_CATEGORIES[0]);

  // Goal Form State
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTargetAmount, setGoalTargetAmount] = useState("");
  const [goalDeadline, setGoalDeadline] = useState("");
  const [contributionInputs, setContributionInputs] = useState<Record<string, string>>({});

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
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        return { 
          id: doc.id, 
          ...d,
          deadline: d.deadline ? (d.deadline as Timestamp).toDate() : undefined
        };
      }) as Goal[];
      setGoals(data);
    });

    const qBills = query(collection(db, "bills"), where("userId", "==", user.uid), orderBy("dueDate", "asc"));
    const unsubB = onSnapshot(qBills, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        return { 
          id: doc.id, 
          ...d,
          dueDate: (d.dueDate as Timestamp).toDate()
        };
      }) as Bill[];
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

    const qReality = query(collection(db, "reality_profiles"), where("userId", "==", user.uid));
    const unsubReality = onSnapshot(qReality, (snapshot) => {
      if (!snapshot.empty) {
        const docData = snapshot.docs[0].data();
        const data = { 
          id: snapshot.docs[0].id, 
          ...docData,
          updatedAt: (docData.updatedAt as Timestamp).toDate()
        } as RealityProfile;
        setRealityProfile(data);
        
        // Initialize form with existing data
        setProfileChildren(data.childrenCount);
        setProfileHousing(data.housingType);
        setProfileMarital(data.maritalStatus);
        setProfileEmployment(data.employmentStatus);
        setProfileHealth(data.hasHealthInsurance);
        setProfileVehicle(data.hasVehicle);
      }
    });

    const qBudgets = query(collection(db, "budgets"), where("userId", "==", user.uid));
    const unsubBudgets = onSnapshot(qBudgets, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Budget[];
      setBudgets(data);
    });

    return () => {
      unsubT();
      unsubG();
      unsubInv();
      unsubB();
      unsubReality();
      unsubBudgets();
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

  useEffect(() => {
    if (type === 'income') {
      setCategory(INCOME_CATEGORIES[0]);
    } else {
      setCategory(EXPENSE_CATEGORIES[0]);
    }
  }, [type]);

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !amount) return;

    try {
      const dateToSave = isDateUnspecified 
        ? new Date() // Use current time for sorting but mark as unspecified
        : new Date(transactionDate + "T12:00:00"); // Noon to avoid timezone issues

      await addDoc(collection(db, "transactions"), {
        userId: user.uid,
        amount: Number(amount) || 0,
        type,
        category,
        description,
        date: Timestamp.fromDate(dateToSave),
        createdAt: Timestamp.now(),
        isDateUnspecified
      });
      setIsModalOpen(false);
      setAmount("");
      setDescription("");
      setIsDateUnspecified(false);
      setTransactionDate(format(new Date(), "yyyy-MM-dd"));
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

  const handleEditTransaction = (transaction: Transaction) => {
    if (!transaction || !transaction.id) {
      console.warn("Attempted to edit transaction without ID");
      return;
    }
    
    // Safety check for date
    let dateStr = "";
    try {
      const dateObj = transaction.date instanceof Date ? transaction.date : 
                     (transaction.date as any)?.toDate ? (transaction.date as any).toDate() : 
                     new Date();
      dateStr = format(dateObj, "yyyy-MM-dd");
    } catch (e) {
      dateStr = format(new Date(), "yyyy-MM-dd");
    }
    
    setEditingTransaction({ 
      id: transaction.id, 
      amount: transaction.amount, 
      description: transaction.description || "",
      category: transaction.category,
      type: transaction.type,
      date: dateStr,
      isDateUnspecified: !!transaction.isDateUnspecified
    });
    setNewAmountValue(transaction.amount.toString());
    setIsEditAmountModalOpen(true);
  };

  const handleUpdateTransaction = async () => {
    if (!editingTransaction) return;
    
    try {
      const dateToSave = editingTransaction.isDateUnspecified 
        ? new Date() 
        : new Date(editingTransaction.date + "T12:00:00");

      const path = `transactions/${editingTransaction.id}`;
      try {
        await updateDoc(doc(db, "transactions", editingTransaction.id), {
          amount: Number(newAmountValue) || 0,
          description: editingTransaction.description,
          category: editingTransaction.category,
          isDateUnspecified: editingTransaction.isDateUnspecified,
          date: Timestamp.fromDate(dateToSave)
        });
        setIsEditAmountModalOpen(false);
        setEditingTransaction(null);
      } catch (error: any) {
        if (error.code === 'permission-denied') {
          handleFirestoreError(error, OperationType.WRITE, path);
        }
        throw error;
      }
    } catch (error) {
      console.error("Update Transaction Error:", error);
    }
  };

  function handleFirestoreError(error: any, operationType: string, path: string | null) {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        providerInfo: auth.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || []
      },
      operationType,
      path
    };
    const jsonStr = JSON.stringify(errInfo);
    console.error('Firestore Error Detail: ', jsonStr);
    throw new Error(jsonStr);
  }

  enum OperationType {
    CREATE = 'create',
    UPDATE = 'update',
    DELETE = 'delete',
    LIST = 'list',
    GET = 'get',
    WRITE = 'write',
  }

  const fetchAiTips = async () => {
    setIsAiLoading(true);
    const tips = await getFinancialTips(transactions, budgets, goals, realityProfile || undefined);
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
        quantity: Number(invQuantity) || 0,
        purchasePrice: Number(invPrice) || 0,
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

  const handleSaveReality = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const data = {
      userId: user.uid,
      childrenCount: Number(profileChildren),
      housingType: profileHousing,
      maritalStatus: profileMarital,
      employmentStatus: profileEmployment,
      hasHealthInsurance: profileHealth,
      hasVehicle: profileVehicle,
      updatedAt: new Date()
    };

    try {
      if (realityProfile?.id) {
        await updateDoc(doc(db, "reality_profiles", realityProfile.id), data);
      } else {
        await addDoc(collection(db, "reality_profiles"), data);
      }
      setIsRealityModalOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !budgetAmount) return;

    try {
      await addDoc(collection(db, "budgets"), {
        userId: user.uid,
        category: budgetCategory,
        amount: Number(budgetAmount) || 0,
        period: 'monthly'
      });
      setIsBudgetModalOpen(false);
      setBudgetAmount("");
    } catch (e) {
      console.error("Add Budget error:", e);
    }
  };

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !goalTitle || !goalTargetAmount) return;

    try {
      await addDoc(collection(db, "goals"), {
        userId: user.uid,
        title: goalTitle,
        targetAmount: Number(goalTargetAmount) || 0,
        currentAmount: 0,
        deadline: goalDeadline ? Timestamp.fromDate(new Date(goalDeadline)) : null,
        createdAt: Timestamp.now()
      });
      setIsGoalModalOpen(false);
      setGoalTitle("");
      setGoalTargetAmount("");
      setGoalDeadline("");
    } catch (e) {
      console.error("Add Goal error:", e);
    }
  };

  const handleContribution = async (goalId: string, contribution: number) => {
    if (!user || contribution <= 0) return;
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;

    try {
      await updateDoc(doc(db, "goals", goalId), {
        currentAmount: (goal.currentAmount || 0) + contribution
      });
    } catch (e) {
      console.error("Contribution error:", e);
    }
  };

  const handleDeleteGoal = async (id: string) => {
    if (!confirm("Excluir esta meta?")) return;
    try {
      await deleteDoc(doc(db, "goals", id));
    } catch (error) {
      console.error("Delete Goal Error:", error);
    }
  };

  const handleDeleteBudget = async (id: string) => {
    if (!confirm("Excluir este orçamento?")) return;
    try {
      await deleteDoc(doc(db, "budgets", id));
    } catch (error) {
      console.error("Delete Budget Error:", error);
    }
  };

  const currentMonthSpending = useMemo(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    
    return transactions
      .filter(t => t.type === 'expense' && t.date >= firstDay)
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
        return acc;
      }, {} as Record<string, number>);
  }, [transactions]);

  const totals = useMemo(() => {
    const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    const expenses = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    return { income, expenses, balance: income - expenses };
  }, [transactions]);

  const chartData = useMemo(() => {
    const cats = transactions
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => {
        const amt = Number(t.amount) || 0;
        acc[t.category] = (acc[t.category] || 0) + amt;
        return acc;
      }, {} as Record<string, number>);

    return Object.entries(cats)
      .map(([name, value]) => ({ name, value }))
      .filter((item: any) => item.value > 0);
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
          <SidebarItem 
            icon={<Target size={20} />} 
            label="Orçamentos" 
            active={activeTab === 'budgets'} 
            onClick={() => setActiveTab('budgets')} 
          />
          <SidebarItem icon={<Calendar size={20} />} label="Contas a Pagar" />
          <SidebarItem icon={<Sparkles size={20} />} label="Objetivos" />
          <SidebarItem 
            icon={<Users size={20} />} 
            label="Minha Realidade" 
            onClick={() => setIsRealityModalOpen(true)}
          />
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
                    onEdit={() => {
                      const latest = transactions[0];
                      if (latest) handleEditTransaction(latest);
                    }}
                  />
                  <StatCard 
                    id="income-stat-card"
                    label="Entradas" 
                    value={totals.income} 
                    type="income"
                    className="bg-white shadow-sm hover:shadow-md transition-shadow"
                    onEdit={() => {
                      const latest = transactions.find(t => t.type === 'income');
                      if (latest) handleEditTransaction(latest);
                    }}
                  />
                  <StatCard 
                    id="expense-stat-card"
                    label="Saídas" 
                    value={totals.expenses} 
                    type="expense"
                    className="bg-white shadow-sm hover:shadow-md transition-shadow"
                    indicatorColor="bg-rose-100"
                    onEdit={() => {
                      const latest = transactions.find(t => t.type === 'expense');
                      if (latest) handleEditTransaction(latest);
                    }}
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
                                <button 
                                  onClick={() => setIsRealityModalOpen(true)}
                                  className="mt-2 text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-800 flex items-center gap-1 group"
                                >
                                  <Users size={12} className="group-hover:scale-110 transition-transform" />
                                  {realityProfile ? "Ajustar sua realidade" : "Definir sua realidade"}
                                </button>
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
                        <div className="flex items-center justify-between">
                            <h4 className="font-bold text-slate-900 text-xl tracking-tight">Metas Ativas</h4>
                            <button 
                              onClick={() => setIsGoalModalOpen(true)}
                              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
                            >
                              <PlusCircle size={14} />
                              Nova Meta
                            </button>
                        </div>
                        <div className="grid grid-cols-1 gap-5">
                          {goals.length === 0 ? (
                            <div className="p-12 border-2 border-dashed border-slate-200 rounded-[2rem] text-center bg-white/50">
                                <Target size={40} className="mx-auto text-slate-300 mb-4 opacity-50" />
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhuma meta definida</p>
                            </div>
                          ) : (
                            goals.map(goal => {
                              const percent = Math.round((goal.currentAmount / goal.targetAmount) * 100);
                              let feedback = "Continue assim!";
                              if (percent >= 100) feedback = "Parabéns! Meta atingida! 🎉";
                              else if (percent >= 75) feedback = "Falta muito pouco! Quase lá!";
                              else if (percent >= 50) feedback = "Metade do caminho percorrido!";
                              else if (percent >= 25) feedback = "Ótimo começo, mantenha o ritmo!";

                              return (
                                <Card key={goal.id} className="p-6 rounded-3xl border-slate-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full translate-x-12 -translate-y-12 group-hover:scale-150 transition-transform duration-500" />
                                    <div className="relative z-10">
                                        <div className="flex justify-between items-start mb-4">
                                          <div>
                                              <h5 className="font-black text-slate-900 text-lg leading-tight">{goal.title}</h5>
                                              <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mt-1.5 flex items-center gap-1">
                                                  <PlusCircle size={10} /> {feedback}
                                              </p>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <span className="text-sm font-black text-indigo-600 bg-indigo-100 px-3 py-1.5 rounded-xl">
                                              {percent}%
                                            </span>
                                            <button 
                                              onClick={() => goal.id && handleDeleteGoal(goal.id)}
                                              className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"
                                            >
                                              <X size={14} />
                                            </button>
                                          </div>
                                        </div>
                                        
                                        <div className="h-2 bg-slate-100 rounded-full mb-4 overflow-hidden">
                                          <motion.div 
                                              initial={{ width: 0 }}
                                              animate={{ width: `${Math.min(100, percent)}%` }}
                                              className="h-full bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(79,70,229,0.3)]"
                                          />
                                        </div>

                                        <div className="flex justify-between items-center text-xs font-bold font-mono mb-4">
                                          <span className="text-slate-900">{formatCurrency(goal.currentAmount)}</span>
                                          <span className="text-slate-400/60">ALVO: {formatCurrency(goal.targetAmount)}</span>
                                        </div>

                                        {percent < 100 && (
                                          <div className="flex gap-2">
                                            <Input 
                                              type="number"
                                              placeholder="Valor aporte"
                                              className="h-9 rounded-xl text-[10px] font-bold"
                                              value={contributionInputs[goal.id!] || ""}
                                              onChange={(e) => setContributionInputs(prev => ({ ...prev, [goal.id!]: e.target.value }))}
                                            />
                                            <Button 
                                              onClick={() => {
                                                if (goal.id) {
                                                  handleContribution(goal.id, Number(contributionInputs[goal.id!]));
                                                  setContributionInputs(prev => ({ ...prev, [goal.id!]: "" }));
                                                }
                                              }}
                                              className="h-9 px-3 text-[10px] font-black uppercase bg-slate-900 hover:bg-slate-800 rounded-xl"
                                            >
                                              Aporte
                                            </Button>
                                          </div>
                                        )}
                                    </div>
                                </Card>
                              );
                            })
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
                                      {t.isDateUnspecified ? "Sem data" : format(t.date, "dd MMM", { locale: ptBR })}
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
                                    <td className="px-8 py-5 text-right flex justify-end gap-2">
                                      <button 
                                        onClick={() => handleEditTransaction(t)}
                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all opacity-60 group-hover:opacity-100 shadow-sm border border-transparent hover:border-indigo-100"
                                        title="Editar valor"
                                      >
                                        <Pencil size={16} />
                                      </button>
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
                                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                                        {t.isDateUnspecified ? "Sem data" : format(t.date, "dd MMM", { locale: ptBR })}
                                      </span>
                                      <span className="w-1 h-1 bg-slate-200 rounded-full" />
                                      <span className="text-[10px] font-bold text-slate-400 capitalize">{t.category}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  <div className="flex items-center gap-2">
                                    <button 
                                      onClick={() => handleEditTransaction(t)}
                                      className="p-1.5 text-slate-400 hover:text-indigo-600 bg-slate-50 rounded-lg"
                                    >
                                      <Pencil size={12} />
                                    </button>
                                    <p className={cn(
                                      "font-black font-mono text-sm leading-none",
                                      t.type === 'income' ? 'text-emerald-500' : 'text-rose-500'
                                    )}>
                                      {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                                    </p>
                                  </div>
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
            ) : activeTab === 'investments' ? (
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
                          {formatCurrency(investments.reduce((acc, inv) => acc + ((Number(inv.quantity) || 0) * (Number(inv.purchasePrice) || 0)), 0))}
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
                                    {formatCurrency((Number(inv.quantity) || 0) * (Number(inv.purchasePrice) || 0))}
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
                                const val = (Number(inv.quantity) || 0) * (Number(inv.purchasePrice) || 0);
                                if (val <= 0) return acc;
                                const existing = acc.find(a => a.name === inv.assetType);
                                if (existing) existing.value += val;
                                else acc.push({ name: inv.assetType, value: val });
                                return acc;
                              }, [] as any[]).filter(item => !isNaN(item.value))}
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
            ) : (
              // Budgets Tab
              <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Planejamento de Gastos</h2>
                    <p className="text-slate-500 font-medium">Defina limites mensais para cada categoria e evite surpresas.</p>
                  </div>
                  <Button onClick={() => setIsBudgetModalOpen(true)} className="bg-slate-900 hover:bg-slate-800 gap-2 h-12 px-6 shadow-xl shadow-slate-900/20">
                    <PlusCircle size={20} />
                    Novo Orçamento
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {budgets.length === 0 ? (
                    <div className="col-span-full p-20 border-2 border-dashed border-slate-200 rounded-[3rem] text-center bg-white/50">
                      <Target size={48} className="mx-auto text-slate-300 mb-4 opacity-50" />
                      <p className="text-lg font-bold text-slate-400">Nenhum orçamento definido.</p>
                      <p className="text-sm text-slate-400 mt-1">Crie limites para suas categorias favoritas.</p>
                    </div>
                  ) : (
                    budgets.map(budget => {
                      const spent = currentMonthSpending[budget.category] || 0;
                      const percent = Math.min(100, (spent / budget.amount) * 100);
                      const isDanger = percent >= 90;
                      const isWarning = percent >= 75 && percent < 90;

                      return (
                        <Card key={budget.id} className="p-8 rounded-[2rem] border-slate-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
                           <div className="flex justify-between items-start mb-6">
                              <div>
                                <h4 className="text-xl font-bold text-slate-900">{budget.category}</h4>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Limite Mensal</p>
                              </div>
                              <button 
                                onClick={() => budget.id && handleDeleteBudget(budget.id)}
                                className="p-2 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                              >
                                <X size={16} />
                              </button>
                           </div>

                           <div className="space-y-4">
                              <div className="flex justify-between items-end">
                                 <div>
                                    <p className="text-2xl font-black font-mono text-slate-900">{formatCurrency(spent)}</p>
                                    <p className="text-[10px] font-bold text-slate-400">GASTO ATUAL</p>
                                 </div>
                                 <div className="text-right">
                                    <p className="text-sm font-bold text-slate-500">{formatCurrency(budget.amount)}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Limite</p>
                                 </div>
                              </div>

                              <div className="h-3 bg-slate-100 rounded-full overflow-hidden relative">
                                 <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${percent}%` }}
                                    className={cn(
                                       "h-full rounded-full transition-all duration-500",
                                       isDanger ? "bg-rose-500" : isWarning ? "bg-amber-500" : "bg-emerald-500"
                                    )}
                                 />
                              </div>

                              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                 <span className={cn(
                                    isDanger ? "text-rose-500" : isWarning ? "text-amber-500" : "text-emerald-500"
                                 )}>
                                    {Math.round(percent)}% utilizado
                                 </span>
                                 <span className="text-slate-400">
                                   Restam {formatCurrency(Math.max(0, budget.amount - spent))}
                                 </span>
                              </div>
                           </div>
                           
                           {isDanger && (
                             <div className="mt-6 flex items-center gap-2 p-3 bg-rose-50 rounded-xl border border-rose-100 animate-pulse">
                               <Bell size={14} className="text-rose-500" />
                               <p className="text-[10px] font-bold text-rose-600">Limite quase atingido!</p>
                             </div>
                           )}
                        </Card>
                      );
                    })
                  )}
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
        <MobileNavItem 
          icon={<History size={24} />} 
        />
        <MobileNavItem 
          icon={<Target size={24} />} 
          active={activeTab === 'budgets'}
          onClick={() => setActiveTab('budgets')}
        />
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Categoria</label>
                     <select 
                       value={category}
                       onChange={(e) => setCategory(e.target.value)}
                       className="w-full h-12 px-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-slate-900 transition-all appearance-none outline-none"
                     >
                       {(type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                     </select>
                   </div>
                   <div className="space-y-2">
                      <div className="flex justify-between items-center ml-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data</label>
                        <label className="flex items-center gap-2 cursor-pointer group">
                           <input 
                             type="checkbox" 
                             checked={isDateUnspecified} 
                             onChange={(e) => setIsDateUnspecified(e.target.checked)}
                             className="w-4 h-4 rounded-lg border-slate-200 text-slate-900 focus:ring-slate-900 transition-all cursor-pointer"
                           />
                           <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter group-hover:text-slate-600">Não especificada</span>
                        </label>
                      </div>
                      {isDateUnspecified ? (
                        <div className="h-12 px-4 bg-slate-50 rounded-2xl text-sm font-bold text-slate-400 flex items-center italic border-2 border-dashed border-slate-100">
                           Sem data vinculada
                        </div>
                      ) : (
                        <Input 
                          type="date"
                          value={transactionDate}
                          onChange={(e) => setTransactionDate(e.target.value)}
                          className="h-12 px-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900"
                        />
                      )}
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

        {/* Reality Questionnaire Modal */}
        {isRealityModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsRealityModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl p-8 space-y-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Sua Realidade</h2>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Personalize sua consultoria</p>
                </div>
                <button 
                  onClick={() => setIsRealityModalOpen(false)}
                  className="p-3 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-2xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveReality} className="space-y-6">
                {/* Dependentes */}
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <Users size={14} className="text-indigo-500" />
                    Quantos filhos/dependentes você tem?
                  </label>
                  <Input 
                    type="number" 
                    value={profileChildren} 
                    onChange={(e) => setProfileChildren(parseInt(e.target.value) || 0)} 
                    className="h-12 rounded-xl text-lg font-bold"
                  />
                </div>

                {/* Moradia */}
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <Home size={14} className="text-indigo-500" />
                    Tipo de Moradia
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'rented', label: 'Aluguel' },
                      { id: 'owned', label: 'Própria' },
                      { id: 'financed', label: 'Financiada' },
                      { id: 'family', label: 'Familiar' }
                    ].map(type => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setProfileHousing(type.id as any)}
                        className={cn(
                          "h-12 rounded-xl text-xs font-bold transition-all border-2",
                          profileHousing === type.id 
                            ? "bg-slate-900 border-slate-900 text-white shadow-lg" 
                            : "bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100"
                        )}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Estado Civil */}
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <Heart size={14} className="text-indigo-500" />
                    Estado Civil
                  </label>
                  <select 
                    value={profileMarital}
                    onChange={(e) => setProfileMarital(e.target.value as any)}
                    className="w-full h-12 px-4 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-slate-900 transition-all outline-none"
                  >
                    <option value="single">Solteiro(a)</option>
                    <option value="married">Casado(a)</option>
                    <option value="divorced">Divorciado(a)</option>
                    <option value="widowed">Viúvo(a)</option>
                    <option value="stable_union">União Estável</option>
                  </select>
                </div>

                {/* Trabalho */}
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <Briefcase size={14} className="text-indigo-500" />
                    Situação Profissional
                  </label>
                  <select 
                    value={profileEmployment}
                    onChange={(e) => setProfileEmployment(e.target.value as any)}
                    className="w-full h-12 px-4 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-slate-900 transition-all outline-none"
                  >
                    <option value="employed">CLT / Empregado</option>
                    <option value="self_employed">Autônomo / PJ</option>
                    <option value="unemployed">Desempregado</option>
                    <option value="student">Estudante</option>
                    <option value="retired">Aposentado</option>
                  </select>
                </div>

                {/* Checkboxes */}
                <div className="grid grid-cols-1 gap-4">
                  <button
                    type="button"
                    onClick={() => setProfileHealth(!profileHealth)}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-2xl border-2 transition-all",
                      profileHealth ? "bg-emerald-50 border-emerald-500" : "bg-slate-50 border-transparent"
                    )}
                  >
                    <div className="flex items-center gap-3 text-left">
                      <div className={cn("p-2 rounded-lg", profileHealth ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400")}>
                        <ShieldPlus size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-slate-900">Possui Plano de Saúde?</p>
                        <p className="text-[10px] text-slate-400 font-medium">Isso altera a segurança financeira</p>
                      </div>
                    </div>
                    {profileHealth && <PlusCircle size={18} className="text-emerald-500" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setProfileVehicle(!profileVehicle)}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-2xl border-2 transition-all",
                      profileVehicle ? "bg-indigo-50 border-indigo-500" : "bg-slate-50 border-transparent"
                    )}
                  >
                    <div className="flex items-center gap-3 text-left">
                      <div className={cn("p-2 rounded-lg", profileVehicle ? "bg-indigo-500 text-white" : "bg-slate-200 text-slate-400")}>
                        <Car size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-slate-900">Possui Veículo Próprio?</p>
                        <p className="text-[10px] text-slate-400 font-medium">Gastos com IPVA, seguro, etc.</p>
                      </div>
                    </div>
                    {profileVehicle && <PlusCircle size={18} className="text-indigo-500" />}
                  </button>
                </div>

                <div className="pt-4">
                  <Button type="submit" className="w-full h-14 text-lg bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-xl shadow-indigo-600/20">
                    Salvar Realidade
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
        {/* Budget Modal */}
        {isBudgetModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsBudgetModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl p-8 space-y-8"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Novo Orçamento</h2>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Defina limites por categoria</p>
                </div>
                <button 
                  onClick={() => setIsBudgetModalOpen(false)}
                  className="p-3 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-2xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddBudget} className="space-y-6">
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500">Categoria</label>
                  <select 
                    value={budgetCategory}
                    onChange={(e) => setBudgetCategory(e.target.value)}
                    className="w-full h-14 px-4 bg-slate-50 border-none rounded-2xl text-md font-bold text-slate-900 focus:ring-2 focus:ring-slate-900 transition-all outline-none"
                  >
                    {EXPENSE_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500">Valor Limite Mensal</label>
                  <Input 
                    type="number" 
                    placeholder="0,00" 
                    value={budgetAmount}
                    onChange={(e) => setBudgetAmount(e.target.value)}
                    className="h-14 rounded-2xl text-xl font-bold font-mono"
                  />
                </div>

                <div className="pt-4">
                  <Button type="submit" className="w-full h-14 text-lg bg-slate-900 hover:bg-slate-800 rounded-2xl shadow-xl shadow-slate-900/20">
                    Criar Orçamento
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
        {/* Goal Modal */}
        {isGoalModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsGoalModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl p-8 space-y-8"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Nova Meta</h2>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Defina seus objetivos financeiros</p>
                </div>
                <button 
                  onClick={() => setIsGoalModalOpen(false)}
                  className="p-3 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-2xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddGoal} className="space-y-6">
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500">Título da Meta</label>
                  <Input 
                    placeholder="Ex: Viagem de Férias, Reserva de Emergência" 
                    value={goalTitle}
                    onChange={(e) => setGoalTitle(e.target.value)}
                    className="h-14 rounded-2xl text-md font-bold"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500">Valor Alvo</label>
                  <Input 
                    type="number" 
                    placeholder="0,00" 
                    value={goalTargetAmount}
                    onChange={(e) => setGoalTargetAmount(e.target.value)}
                    className="h-14 rounded-2xl text-xl font-bold font-mono"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center justify-between">
                    Prazo (Opcional)
                    <span className="text-[9px] lowercase font-medium italic opacity-60">Dia/Mês/Ano</span>
                  </label>
                  <Input 
                    type="date" 
                    value={goalDeadline}
                    onChange={(e) => setGoalDeadline(e.target.value)}
                    className="h-14 rounded-2xl text-md font-bold"
                  />
                </div>

                <div className="pt-4">
                  <Button type="submit" className="w-full h-14 text-lg bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-xl shadow-indigo-600/20 text-white">
                    Criar Meta
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
        {/* Terminal Edit Modal */}
        {isEditAmountModalOpen && editingTransaction && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsEditAmountModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-slate-900 border border-emerald-500/30 rounded-xl shadow-2xl overflow-hidden font-mono text-emerald-400"
            >
              {/* Terminal Header */}
              <div className="bg-slate-800 px-4 py-2 flex items-center justify-between border-b border-emerald-500/30">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500" />
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="ml-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">transaction_editor.sh</span>
                </div>
                <button 
                  onClick={() => setIsEditAmountModalOpen(false)}
                  className="text-slate-400 hover:text-emerald-400 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-1">
                  <p className="text-[10px] text-emerald-500/50 leading-none mb-4"># PATCH_TRANSACTION --id={editingTransaction.id}</p>
                  
                  <div className="space-y-4">
                    {/* Description Field */}
                    <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                      <span className="text-xs uppercase opacity-70">description:</span>
                      <Input 
                        value={editingTransaction.description}
                        onChange={(e) => setEditingTransaction({...editingTransaction, description: e.target.value})}
                        className="bg-slate-950 border-emerald-500/20 text-emerald-400 h-10 rounded-lg focus:border-emerald-500/50 transition-all font-mono"
                      />
                    </div>

                    {/* Amount Field */}
                    <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                      <span className="text-xs uppercase opacity-70">amount:</span>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500/50">R$</span>
                        <Input 
                          type="number"
                          value={newAmountValue}
                          onChange={(e) => setNewAmountValue(e.target.value)}
                          className="bg-slate-950 border-emerald-500/20 text-emerald-400 h-10 pl-10 rounded-lg focus:border-emerald-500/50 transition-all font-mono"
                        />
                      </div>
                    </div>

                    {/* Category Field */}
                    <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                      <span className="text-xs uppercase opacity-70">category:</span>
                      <select 
                        value={editingTransaction.category}
                        onChange={(e) => setEditingTransaction({...editingTransaction, category: e.target.value})}
                        className="bg-slate-950 border border-emerald-500/20 text-emerald-400 h-10 px-3 rounded-lg focus:border-emerald-500/50 transition-all outline-none font-mono text-sm"
                      >
                        {(editingTransaction.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(cat => (
                          <option key={cat} value={cat} className="bg-slate-900">{cat}</option>
                        ))}
                      </select>
                    </div>

                    {/* Date Field */}
                    <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                      <div className="flex flex-col">
                        <span className="text-xs uppercase opacity-70">date:</span>
                        <label className="flex items-center gap-2 mt-1 cursor-pointer">
                          <input 
                            type="checkbox"
                            checked={editingTransaction.isDateUnspecified}
                            onChange={(e) => setEditingTransaction({...editingTransaction, isDateUnspecified: e.target.checked})}
                            className="w-3 h-3 bg-slate-950 border-emerald-500/30 rounded focus:ring-0 text-emerald-500"
                          />
                          <span className="text-[10px] uppercase opacity-50">unspec</span>
                        </label>
                      </div>
                      <Input 
                        type="date"
                        disabled={editingTransaction.isDateUnspecified}
                        value={editingTransaction.date}
                        onChange={(e) => setEditingTransaction({...editingTransaction, date: e.target.value})}
                        className="bg-slate-950 border-emerald-500/20 text-emerald-400 h-10 rounded-lg focus:border-emerald-500/50 transition-all font-mono disabled:opacity-30"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    onClick={() => setIsEditAmountModalOpen(false)}
                    className="flex-1 h-12 border border-emerald-500/20 text-emerald-500/70 hover:bg-emerald-500/10 rounded-lg transition-all text-xs uppercase tracking-widest"
                  >
                    /cancel
                  </button>
                  <button 
                    onClick={handleUpdateTransaction}
                    className="flex-1 h-12 bg-emerald-500 text-slate-950 hover:bg-emerald-400 rounded-lg transition-all text-xs font-black uppercase tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                  >
                    /execute --push
                  </button>
                </div>
              </div>

              {/* Terminal Footer */}
              <div className="bg-slate-950/50 px-4 py-2 border-t border-emerald-500/10 text-[9px] text-emerald-500/30 flex justify-between uppercase">
                <span>System: AI_FINANCE_v2.0.4</span>
                <span>Status: READY</span>
              </div>
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

function StatCard({ label, value, subtext, trend, type, className, indicatorColor = "bg-emerald-100", onEdit }: any) {
  return (
    <Card className={cn("p-6 flex flex-col justify-between h-36 md:h-44 rounded-[2rem] hover:scale-[1.02] transition-transform group/stat relative", className)}>
      {onEdit && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="absolute top-3 right-3 p-2 bg-slate-50/80 backdrop-blur-sm text-slate-500 hover:text-indigo-600 hover:bg-white rounded-xl transition-all opacity-100 z-30 shadow-sm border border-slate-100 cursor-pointer"
          title="Ajustar último lançamento"
        >
          <Pencil size={14} />
        </button>
      )}
      <div className="flex justify-between items-start">
        <div>
          <p className="text-slate-500 text-[11px] font-black uppercase tracking-widest leading-tight mb-2 opacity-60">{label}</p>
          <h3 className={cn(
            "text-2xl md:text-4xl font-black leading-none font-mono tracking-tighter",
            type === 'income' ? 'text-emerald-600' : type === 'expense' ? 'text-rose-600' : 'text-slate-900'
          )}>
            {formatCurrency(value)}
          </h3>
        </div>
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