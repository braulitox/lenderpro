export enum Frequency {
  DAILY = 'Diario',
  WEEKLY = 'Semanal',
  BIWEEKLY = 'Quincenal',
  MONTHLY = 'Mensual'
}

export enum LoanType {
  SIMPLE = 'Interés Simple',
  FRENCH = 'Sistema Francés'
}

export enum InterestType {
  PERCENTAGE = 'Porcentaje (%)',
  FIXED_AMOUNT = 'Monto Fijo ($)'
}

export enum LoanStatus {
  ACTIVE = 'Activo',
  COMPLETED = 'Pagado',
  DEFAULTED = 'En Mora'
}

export enum InstallmentStatus {
  PENDING = 'Pendiente',
  PAID = 'Pagado',
  LATE = 'Vencido'
}

export interface Client {
  id: string;
  name: string;
  dni: string;
  phone: string;
  address: string;
  createdAt: string;
}

export interface Installment {
  number: number;
  dueDate: string; // ISO Date
  amount: number;
  capital: number;
  interest: number;
  status: InstallmentStatus;
  paymentDate?: string;
}

export interface Loan {
  id: string;
  clientId: string;
  amount: number; // Principal
  interestRate: number; // Percentage or Amount depending on type
  interestType: InterestType; 
  frequency: Frequency;
  duration: number; // Number of installments
  type: LoanType;
  startDate: string;
  endDate: string; // New field
  installments: Installment[];
  status: LoanStatus;
  totalPayable: number;
  totalPaid: number;
}