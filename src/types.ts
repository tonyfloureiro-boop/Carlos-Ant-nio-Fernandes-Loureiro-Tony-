export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  currency: string;
  monthlyIncome?: number;
}

export interface Transaction {
  id?: string;
  userId: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description?: string;
  date: Date;
  createdAt: Date;
  isDateUnspecified?: boolean;
}

export interface Budget {
  id?: string;
  userId: string;
  category: string;
  amount: number;
  period: 'monthly' | 'weekly';
}

export interface Goal {
  id?: string;
  userId: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: Date;
}

export interface Bill {
  id?: string;
  userId: string;
  title: string;
  amount: number;
  dueDate: Date;
  status: 'paid' | 'unpaid';
}

export interface Investment {
  id?: string;
  userId: string;
  symbol: string;
  assetType: 'stock' | 'crypto' | 'fund' | 'fixed_income';
  quantity: number;
  purchasePrice: number;
  purchaseDate: Date;
  createdAt: Date;
}

export interface RealityProfile {
  id?: string;
  userId: string;
  childrenCount: number;
  housingType: 'rented' | 'owned' | 'financed' | 'family';
  maritalStatus: 'single' | 'married' | 'divorced' | 'widowed' | 'stable_union';
  employmentStatus: 'employed' | 'self_employed' | 'unemployed' | 'student' | 'retired';
  hasHealthInsurance: boolean;
  hasVehicle: boolean;
  updatedAt: Date;
}
