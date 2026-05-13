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
  Pencil,
  ChevronDown,
  Trash2,
  Zap,
  Settings
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
  updateDoc,
  getDocs,
  limit
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
import { AIAccountant } from "./components/AIAccountant";
import { Transaction, Budget, Goal, Bill, UserProfile, Investment, RealityProfile, Category, MonthlyReport } from "./types";
import { cn, formatCurrency } from "./lib/utils";
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from "./components/UI";
import { getFinancialTips, generateMonthlyReport } from "./services/gemini";
import { format, isLastDayOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import Markdown from "react-markdown";

// Constants
const INCOME_CATEGORIES = [
  "Salário", "Renda Extra", "Investimentos", "Vendas", "Restituição", "Presente", "Outros"
];

function Logo({ className, light = false, size = "md" }: { className?: string, light?: boolean, size?: "sm" | "md" | "lg" }) {
  const iconSizes = { sm: 14, md: 18, lg: 32 };
  const containerSizes = { sm: "w-7 h-7", md: "w-9 h-9", lg: "w-16 h-16" };
  const textSizes = { sm: "text-lg", md: "text-xl", lg: "text-4xl" };
  
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className={cn(
        "bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20",
        containerSizes[size]
      )}>
        <Zap size={iconSizes[size]} className="text-white fill-white/20" />
      </div>
      <span className={cn(
        "font-black tracking-tighter",
        light ? "text-white" : "text-slate-900",
        textSizes[size]
      )}>
        Smart<span className="text-emerald-500">Fin</span>
      </span>
    </div>
  );
}

const EXPENSE_CATEGORIES = [
  "G.F.M.I.*", "Moradia", "Alimentação", "Transporte", "Lazer", "Saúde", "Educação", "Compras", "Investimentos", "Dívidas", "Outros"
];
const COLOR_MAP: Record<string, string> = {
  "G.F.M.I.*": "#f43f5e",
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'investments' | 'budgets' | 'categories'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInvestmentModalOpen, setIsInvestmentModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [aiTips, setAiTips] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [realityProfile, setRealityProfile] = useState<RealityProfile | null>(null);
  const [isRealityModalOpen, setIsRealityModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isGfmiInfoOpen, setIsGfmiInfoOpen] = useState(false);
  const [isMonthlyReportOpen, setIsMonthlyReportOpen] = useState(false);
  const [currentMonthlyReport, setCurrentMonthlyReport] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
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

  // Category Form State
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryType, setNewCategoryType] = useState<'income' | 'expense'>('expense');
  const [newCategoryColor, setNewCategoryColor] = useState(COLORS[0]);

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

    const qCategories = query(collection(db, "categories"), where("userId", "==", user.uid));
    const unsubCategories = onSnapshot(qCategories, async (snapshot) => {
      if (snapshot.empty) {
        // Seed initial categories
        const defaults = [
          ...INCOME_CATEGORIES.map(name => ({ name, type: 'income', color: COLOR_MAP[name] || COLORS[0], isDefault: true })),
          ...EXPENSE_CATEGORIES.map(name => ({ name, type: 'expense', color: COLOR_MAP[name] || COLORS[1], isDefault: true }))
        ];
        
        for (const cat of defaults) {
          await addDoc(collection(db, "categories"), {
            ...cat,
            userId: user.uid
          });
        }
        return;
      }
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Category[];
      setCategories(data);
    });

    return () => {
      unsubT();
      unsubG();
      unsubInv();
      unsubB();
      unsubReality();
      unsubBudgets();
      unsubCategories();
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

  useEffect(() => {
    if (user && categories.length === 0 && loading === false) {
      // Seed categories if none exist (could be first time user)
      const seed = async () => {
        // Double check in case of race condition
        const q = query(collection(db, "categories"), where("userId", "==", user.uid), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) {
          const defaultCats = [
            ...INCOME_CATEGORIES.map(name => ({ name, type: 'income', color: COLORS[0], isDefault: true })),
            ...EXPENSE_CATEGORIES.map(name => ({ name, type: 'expense', color: COLORS[1], isDefault: true }))
          ];
          for (const cat of defaultCats) {
            await addDoc(collection(db, "categories"), { ...cat, userId: user.uid });
          }
        }
      };
      seed();
    }
  }, [user, categories.length, loading]);

  const handleLogout = () => signOut(auth);

  const availableIncomeCategories = useMemo(() => {
    const list = categories.filter(c => c.type === 'income').map(c => c.name);
    return Array.from(new Set([...INCOME_CATEGORIES, ...list]));
  }, [categories]);

  const availableExpenseCategories = useMemo(() => {
    const list = categories.filter(c => c.type === 'expense').map(c => c.name);
    return Array.from(new Set([...EXPENSE_CATEGORIES, ...list]));
  }, [categories]);

  useEffect(() => {
    if (type === 'income') {
      setCategory(availableIncomeCategories[0]);
    } else {
      setCategory(availableExpenseCategories[0]);
    }
  }, [type, availableIncomeCategories, availableExpenseCategories]);

  const normalizeCategoryName = (name: string) => {
    if (name === "Gastos Fixos Mensais Inegociáveis" || name === "Gastos F. mensais I.") {
      return "G.F.M.I.*";
    }
    return name;
  };

  const renderCategoryName = (name: string) => {
    if (!name) return "";
    if (name.includes('*')) {
      const parts = name.split('*');
      return (
        <>
          {parts[0]}
          <span 
            className="gfmi-asterisk ml-[1px]" 
            onClick={(e) => {
              e.stopPropagation();
              setIsGfmiInfoOpen(true);
            }}
          >
            *
          </span>
          {parts[1]}
        </>
      );
    }
    return name;
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !amount) return;

    // Support for Brazilian decimal format (comma instead of dot)
    const normalizedAmount = amount.replace(',', '.');
    const numericAmount = Number(normalizedAmount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      alert("Por favor, insira um valor válido maior que zero.");
      return;
    }

    try {
      const dateToSave = isDateUnspecified 
        ? new Date() // Use current time for sorting but mark as unspecified
        : new Date(transactionDate + "T12:00:00"); // Noon to avoid timezone issues

      const path = "transactions";
      try {
        await addDoc(collection(db, path), {
          userId: user.uid,
          amount: numericAmount,
          type,
          category,
          description: description.trim(),
          date: Timestamp.fromDate(dateToSave),
          createdAt: Timestamp.now(),
          isDateUnspecified
        });
        setIsModalOpen(false);
        setAmount("");
        setDescription("");
        setIsDateUnspecified(false);
        setTransactionDate(format(new Date(), "yyyy-MM-dd"));
      } catch (error: any) {
        if (error.code === 'permission-denied' || error.message.includes('insufficient permissions')) {
          handleFirestoreError(error, OperationType.WRITE, path);
        }
        throw error;
      }
    } catch (error) {
      console.error("Add Transaction error:", error);
      alert("Erro ao salvar transação. Verifique os dados e tente novamente.");
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      const path = `transactions/${id}`;
      await deleteDoc(doc(db, "transactions", id));
    } catch (error: any) {
      console.error("Delete Error:", error);
      if (error.code === 'permission-denied' || error.message.includes('insufficient permissions')) {
        handleFirestoreError(error, OperationType.DELETE, `transactions/${id}`);
      }
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta categoria? Isso não removerá transações já existentes com esta categoria.")) return;
    try {
      await deleteDoc(doc(db, "categories", id));
    } catch (error: any) {
      console.error("Delete Category Error:", error);
      handleFirestoreError(error, OperationType.DELETE, `categories/${id}`);
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
    
    // Support for Brazilian decimal format (comma instead of dot)
    const normalizedAmount = newAmountValue.replace(',', '.');
    const numericAmount = Number(normalizedAmount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      alert("Por favor, insira um valor válido maior que zero.");
      return;
    }

    try {
      const dateToSave = editingTransaction.isDateUnspecified 
        ? new Date() 
        : new Date(editingTransaction.date + "T12:00:00");

      const path = `transactions/${editingTransaction.id}`;
      try {
        await updateDoc(doc(db, "transactions", editingTransaction.id), {
          amount: numericAmount,
          description: editingTransaction.description.trim(),
          category: editingTransaction.category,
          isDateUnspecified: editingTransaction.isDateUnspecified,
          date: Timestamp.fromDate(dateToSave)
        });
        setIsEditAmountModalOpen(false);
        setEditingTransaction(null);
      } catch (error: any) {
        if (error.code === 'permission-denied' || error.message.includes('insufficient permissions')) {
          handleFirestoreError(error, OperationType.WRITE, path);
        }
        throw error;
      }
    } catch (error) {
      console.error("Update Transaction Error:", error);
      alert("Erro ao atualizar transação.");
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

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newCategoryName) return;

    try {
      if (editingCategory && editingCategory.id) {
        await updateDoc(doc(db, "categories", editingCategory.id), {
          name: newCategoryName,
          type: newCategoryType,
          color: newCategoryColor
        });
      } else {
        await addDoc(collection(db, "categories"), {
          userId: user.uid,
          name: newCategoryName,
          type: newCategoryType,
          color: newCategoryColor,
          isDefault: false
        });
      }
      setNewCategoryName("");
      setEditingCategory(null);
      setIsCategoryModalOpen(false);
    } catch (e: any) {
      console.error("Handle Category error:", e);
      handleFirestoreError(e, editingCategory ? OperationType.UPDATE : OperationType.CREATE, "categories");
    }
  };

  const handleEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setNewCategoryName(cat.name);
    setNewCategoryType(cat.type);
    setNewCategoryColor(cat.color);
    setIsCategoryModalOpen(true);
  };

  useEffect(() => {
    if (!user || loading) return;

    const checkMonthlyReport = async () => {
      // For development/testing purposes, you might want to force this
      const today = new Date();
      if (!isLastDayOfMonth(today)) return;

      const monthKey = format(today, "yyyy-MM");
      
      try {
        const q = query(
          collection(db, "monthly_reports"),
          where("userId", "==", user.uid),
          where("month", "==", monthKey),
          limit(1)
        );

        const snap = await getDocs(q);
        if (!snap.empty) {
          const doc = snap.docs[0].data();
          // Check if session flag exists to not annoy user
          if (!sessionStorage.getItem(`viewed_report_${monthKey}`)) {
            setCurrentMonthlyReport(doc.content);
            setIsMonthlyReportOpen(true);
            sessionStorage.setItem(`viewed_report_${monthKey}`, 'true');
          }
          return;
        }

        // If it's the last day and no report, generate it
        setIsGeneratingReport(true);
        const report = await generateMonthlyReport(monthKey, transactions, budgets, goals, realityProfile || undefined);
        
        await addDoc(collection(db, "monthly_reports"), {
          userId: user.uid,
          month: monthKey,
          content: report,
          createdAt: new Date().toISOString()
        });

        setCurrentMonthlyReport(report);
        setIsMonthlyReportOpen(true);
        setIsGeneratingReport(false);
        sessionStorage.setItem(`viewed_report_${monthKey}`, 'true');
      } catch (e) {
        console.error("Monthly report check error:", e);
        setIsGeneratingReport(false);
      }
    };

    checkMonthlyReport();
  }, [user, loading, transactions, budgets, goals, realityProfile]);

  const currentMonthSpending = useMemo(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    
    return transactions
      .filter(t => t.type === 'expense' && t.date >= firstDay)
      .reduce((acc, t) => {
        const cat = normalizeCategoryName(t.category);
        acc[cat] = (acc[cat] || 0) + Number(t.amount);
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
        const cat = normalizeCategoryName(t.category);
        acc[cat] = (acc[cat] || 0) + amt;
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
          className="w-full max-w-md bg-white border border-slate-200 p-10 rounded-[3rem] shadow-2xl shadow-slate-200/50 space-y-8 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/5 rounded-full -ml-16 -mb-16 blur-2xl"></div>

          <div className="flex flex-col items-center text-center space-y-6">
            <Logo size="lg" className="flex-col gap-4" />
            <p className="text-slate-500 text-lg font-medium max-w-[280px]">Controle suas finanças com inteligência e elegância.</p>
          </div>
          
          <Button onClick={handleLogin} className="w-full h-16 text-lg font-bold gap-3 bg-slate-900 hover:bg-slate-800 shadow-2xl shadow-slate-900/20 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98]">
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
        <div className="mb-12">
          <Logo light />
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
          <SidebarItem 
            icon={<Briefcase size={24} />} 
            label="Categorias" 
            active={activeTab === 'categories'} 
            onClick={() => setActiveTab('categories')} 
          />
          <SidebarItem icon={<Calendar size={20} />} label="Contas a Pagar" />
          <SidebarItem icon={<Sparkles size={20} />} label="Objetivos" />
          <SidebarItem 
            icon={<Users size={20} />} 
            label="Minha Realidade" 
            onClick={() => setIsRealityModalOpen(true)}
          />
          <SidebarItem icon={<History size={20} />} label="Histórico" />
          <button 
            onClick={() => setActiveTab('categories')} 
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group",
              activeTab === 'categories' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "text-slate-400 hover:bg-slate-800 hover:text-white"
            )}
          >
            <Settings size={20} />
            <span className="font-medium">Categorias</span>
          </button>
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
          <div className="md:hidden">
             <Logo size="sm" />
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
                    onDelete={handleDeleteTransaction}
                    transactions={transactions}
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
                    onDelete={handleDeleteTransaction}
                    transactions={transactions.filter(t => t.type === 'income')}
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
                    onDelete={handleDeleteTransaction}
                    transactions={transactions.filter(t => t.type === 'expense')}
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
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                      <div className="bg-white p-5 rounded-[2rem] shadow-2xl border-none">
                                        <div className="flex flex-col gap-1">
                                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Categoria</span>
                                          <span className="text-lg font-black text-slate-900 leading-tight">
                                            {renderCategoryName(data.name)}
                                          </span>
                                          <div className="mt-2 pt-2 border-t border-slate-50 flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0].fill }} />
                                            <span className="font-mono font-bold text-slate-700">
                                              {formatCurrency(Number(payload[0].value))}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
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
                                        {renderCategoryName(t.category)}
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
                                        <Trash2 size={16} />
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
                                      <span className="text-[10px] font-bold text-slate-400 capitalize">{renderCategoryName(t.category)}</span>
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
                                      className="flex items-center justify-center h-10 w-10 text-rose-500 hover:bg-rose-50 rounded-xl transition-all active:scale-90"
                                      aria-label="Excluir transação"
                                    >
                                      <Trash2 size={18} />
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
                      const normalizedCat = normalizeCategoryName(budget.category);
                      const spent = currentMonthSpending[normalizedCat] || 0;
                      const percent = Math.min(100, (spent / budget.amount) * 100);
                      const isDanger = percent >= 90;
                      const isWarning = percent >= 75 && percent < 90;

                      return (
                        <Card key={budget.id} className="p-8 rounded-[2rem] border-slate-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
                           <div className="flex justify-between items-start mb-6">
                              <div>
                                <h4 className="text-xl font-bold text-slate-900">{renderCategoryName(normalizedCat)}</h4>
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

            {activeTab === 'categories' && (
              <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Categorias Personalizadas</h2>
                    <p className="text-slate-500 font-medium">Gerencie suas categorias de gastos e ganhos.</p>
                  </div>
                  <Button onClick={() => { setEditingCategory(null); setNewCategoryName(""); setIsCategoryModalOpen(true); }} className="bg-slate-900 hover:bg-slate-800 gap-2 h-12 px-6 shadow-xl shadow-slate-900/20">
                    <PlusCircle size={20} />
                    Nova Categoria
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {categories.map(cat => (
                    <Card key={cat.id} className="p-6 rounded-3xl border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all group">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center" style={{ color: cat.color }}>
                            <Briefcase size={20} />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900">{renderCategoryName(cat.name)}</h4>
                            <span className={cn(
                              "text-[10px] font-black uppercase tracking-widest",
                              cat.type === 'income' ? 'text-emerald-500' : 'text-rose-500'
                            )}>
                              {cat.type === 'income' ? 'Entrada' : 'Saída'}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleEditCategory(cat)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all active:scale-95"
                            title="Editar Categoria"
                          >
                            <Pencil size={16} />
                          </button>
                          <button 
                            onClick={() => cat.id && handleDeleteCategory(cat.id)}
                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all active:scale-95"
                            title="Excluir Categoria"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </Card>
                  ))}
                  {categories.length === 0 && (
                    <div className="col-span-full py-12 text-center text-slate-300">
                      <p className="text-sm font-medium">Nenhuma categoria personalizada criada ainda.</p>
                    </div>
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
          active={activeTab === 'categories'}
          onClick={() => setActiveTab('categories')}
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
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
                       {(type === 'income' ? availableIncomeCategories : availableExpenseCategories).map(cat => <option key={cat} value={cat}>{cat}</option>)}
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
        {/* Category Modal */}
        {isGfmiInfoOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-rose-500" />
              
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500">
                  <span className="text-4xl font-black">*</span>
                </div>
                
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tighter">G.F.M.I.</h3>
                  <p className="text-rose-500 font-bold text-sm tracking-wide mt-1">
                    Gastos Fixos Mensais Inegociáveis
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl text-slate-500 text-sm leading-relaxed font-medium">
                  Esta categoria agrupa as despesas que ocorrem todo mês e que não podem ser cortadas ou negociadas facilmente (Ex: Aluguel, Condomínio, etc).
                </div>

                <Button 
                  onClick={() => setIsGfmiInfoOpen(false)}
                  className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-xl shadow-slate-900/10"
                >
                  Entendi
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsCategoryModalOpen(false)}
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
                  <h2 className="text-3xl font-black text-slate-900 tracking-tighter">
                    {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
                  </h2>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
                    {editingCategory ? 'Atualize as informações' : 'Personalize sua organização'}
                  </p>
                </div>
                <button 
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="p-3 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-2xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddCategory} className="space-y-6">
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500">Nome da Categoria</label>
                  <Input 
                    placeholder="Ex: Assinaturas, Freelance..." 
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="h-14 rounded-2xl text-md font-bold"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500">Tipo</label>
                  <div className="flex p-1.5 bg-slate-100 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setNewCategoryType('expense')}
                      className={cn(
                        "flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all",
                        newCategoryType === 'expense' ? "bg-white text-rose-500 shadow-md" : "text-slate-400 hover:text-slate-600"
                      )}
                    >
                      Saída
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewCategoryType('income')}
                      className={cn(
                        "flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all",
                        newCategoryType === 'income' ? "bg-white text-emerald-500 shadow-md" : "text-slate-400 hover:text-slate-600"
                      )}
                    >
                      Entrada
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500">Cor Identificadora</label>
                  <div className="grid grid-cols-8 gap-2">
                    {COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewCategoryColor(color)}
                        className={cn(
                          "w-full aspect-square rounded-lg transition-all border-4",
                          newCategoryColor === color ? "border-slate-900 scale-110" : "border-transparent"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <Button type="submit" className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold shadow-xl shadow-slate-900/10">
                  {editingCategory ? 'Salvar Alterações' : 'Criar Categoria'}
                </Button>
              </form>
            </motion.div>
          </div>
        )}
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
                    {availableExpenseCategories.map(c => (
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
                        {(editingTransaction.type === 'income' ? availableIncomeCategories : availableExpenseCategories).map(cat => (
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

      {/* Monthly Report Modal */}
      <AnimatePresence>
        {isMonthlyReportOpen && currentMonthlyReport && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMonthlyReportOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-[3rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-8 md:p-12 border-b border-slate-50 flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800 text-white">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                      <Zap size={24} className="text-white" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-[0.3em] text-emerald-400">Monthly Intelligence</span>
                  </div>
                  <h2 className="text-3xl md:text-5xl font-black tracking-tight">Relatório de Fechamento</h2>
                  <p className="text-slate-400 font-medium mt-2">Visão completa dos seus resultados no mês.</p>
                </div>
                <button 
                  onClick={() => setIsMonthlyReportOpen(false)}
                  className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-all"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 md:p-12 custom-scrollbar">
                <div className="prose prose-slate max-w-none prose-headings:font-black prose-headings:tracking-tight prose-headings:text-slate-900 prose-p:text-slate-600 prose-p:leading-relaxed prose-strong:text-slate-900 prose-table:border-collapse prose-th:bg-slate-50 prose-th:p-3 prose-td:p-3 prose-td:border-b prose-td:border-slate-50">
                  <Markdown>{currentMonthlyReport}</Markdown>
                </div>
              </div>

              <div className="p-8 border-t border-slate-50 bg-slate-50/50 flex justify-end">
                <Button 
                  onClick={() => setIsMonthlyReportOpen(false)}
                  className="bg-slate-900 hover:bg-slate-800 h-14 px-10 rounded-2xl text-lg font-bold shadow-xl shadow-slate-900/20"
                >
                  Continuar para o próximo mês
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isGeneratingReport && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white p-10 rounded-[3rem] shadow-2xl flex flex-col items-center text-center max-w-sm"
            >
              <div className="w-20 h-20 bg-emerald-500 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-emerald-500/20 animate-bounce">
                <Sparkles size={40} className="text-white" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">Gerando seu Relatório</h3>
              <p className="text-slate-500 font-medium leading-relaxed">
                Nossa IA está analisando todos os seus movimentos financeiros deste mês para criar um fechamento detalhado...
              </p>
              <div className="mt-8 flex gap-2">
                <span className="w-3 h-3 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-3 h-3 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-3 h-3 bg-emerald-500 rounded-full animate-bounce"></span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AIAccountant transactions={transactions} balances={totals} user={user} />
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

function StatCard({ label, value, subtext, trend, type, className, indicatorColor = "bg-emerald-100", onEdit, onDelete, transactions = [] }: any) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className={cn(
      "p-6 flex flex-col justify-between rounded-[2rem] transition-all duration-500 ease-in-out group/stat relative overflow-hidden", 
      isExpanded ? "md:h-auto min-h-[11rem] h-auto shadow-2xl ring-2 ring-slate-100" : "h-36 md:h-44",
      className
    )}>
      <div className="absolute top-3 right-3 flex gap-2 z-30">
        {onEdit && !isExpanded && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-2 bg-slate-50/80 backdrop-blur-sm text-slate-500 hover:text-indigo-600 hover:bg-white rounded-xl transition-all shadow-sm border border-slate-100 cursor-pointer"
            title="Ajustar último lançamento"
          >
            <Pencil size={14} />
          </button>
        )}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className={cn(
            "p-2 rounded-xl transition-all shadow-sm border border-slate-100 cursor-pointer",
            isExpanded ? "bg-slate-900 text-white border-slate-800 rotate-180" : "bg-slate-50/80 backdrop-blur-sm text-slate-500 hover:text-indigo-600 hover:bg-white"
          )}
          title={isExpanded ? "Recolher" : "Ver transações"}
        >
          <ChevronDown size={14} />
        </button>
      </div>

      <div className="flex justify-between items-start">
        <div>
          <p className="text-slate-500 text-[11px] font-black uppercase tracking-widest leading-tight mb-2 opacity-60">{label}</p>
          <h3 className={cn(
            "text-2xl md:text-4xl font-black leading-none font-mono tracking-tighter transition-all duration-300",
            isExpanded ? "md:text-2xl text-xl mb-4" : "",
            type === 'income' ? 'text-emerald-600' : type === 'expense' ? 'text-rose-600' : 'text-slate-900'
          )}>
            {formatCurrency(value)}
          </h3>
        </div>
      </div>

      {!isExpanded && (
        <div className="mt-4">
          {trend && (
             <p className={cn("text-[11px] font-black uppercase tracking-wider flex items-center gap-1", trend === 'up' ? 'text-emerald-500' : 'text-rose-500')}>
               {trend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
               {subtext}
             </p>
          )}
          {!trend && <div className={cn("w-full h-2 rounded-full", indicatorColor)}></div>}
        </div>
      )}

      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mt-2 pt-4 border-t border-slate-50"
          >
            <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
              {transactions.length > 0 ? (
                transactions.map((t: any) => (
                  <div key={t.id} className="flex justify-between items-center group/item p-1 hover:bg-slate-50 rounded-lg transition-colors">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (t.id && onDelete) {
                            onDelete(t.id);
                          }
                        }}
                        className="flex items-center justify-center h-10 w-10 md:h-8 md:w-8 text-rose-500 md:text-slate-300 hover:text-rose-600 rounded-xl transition-all md:opacity-0 md:group-hover/item:opacity-100 active:bg-rose-50 relative z-50 cursor-pointer"
                        aria-label="Excluir transação"
                      >
                        <Trash2 size={18} className="md:w-3 md:h-3" />
                      </button>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-900 truncate max-w-[120px]">{t.description || 'S/ Descrição'}</span>
                        <span className="text-[9px] text-slate-400 font-medium">{format(t.date instanceof Date ? t.date : t.date.toDate(), "dd MMM", { locale: ptBR })}</span>
                      </div>
                    </div>
                    <span className={cn(
                      "text-[10px] font-mono font-black tracking-tight",
                      t.type === 'income' ? 'text-emerald-500' : 'text-rose-500'
                    )}>
                      {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 opacity-30 italic text-[10px] text-slate-500">Nenhuma transação encontrada</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}