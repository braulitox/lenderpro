import { Client, Loan, InstallmentStatus, LoanStatus, Frequency, LoanType, InterestType } from '../types';

const CLIENTS_KEY = 'lenderpro_clients';
const LOANS_KEY = 'lenderpro_loans';

// --- Simple In-Memory Cache ---
let clientsCache: Client[] | null = null;
let loansCache: Loan[] | null = null;

// Helper to simulate delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const StorageService = {
  getClients: (): Client[] => {
    // Return cache if available
    if (clientsCache) return clientsCache;

    try {
        const data = localStorage.getItem(CLIENTS_KEY);
        if (!data) {
            clientsCache = [];
            return clientsCache;
        }
        const parsed = JSON.parse(data);
        if (!Array.isArray(parsed)) {
            clientsCache = [];
            return clientsCache;
        }
        
        // Aggressive Sanitization on Read
        clientsCache = parsed
            .filter(c => c && typeof c === 'object') // Remove nulls
            .map(c => ({
                id: String(c.id || Math.random().toString(36).substr(2, 9)),
                name: String(c.name || 'Sin Nombre'),
                dni: String(c.dni || ''),
                phone: String(c.phone || ''),
                address: String(c.address || ''),
                createdAt: c.createdAt || new Date().toISOString()
            }));
        
        return clientsCache;
    } catch (e) {
        console.error("Error reading clients", e);
        return [];
    }
  },

  saveClient: (client: Client): void => {
    // Get current state (populates cache if needed)
    const clients = StorageService.getClients();
    
    const index = clients.findIndex(c => c.id === client.id);
    if (index >= 0) {
      clients[index] = client;
    } else {
      clients.push(client);
    }
    
    // Update Cache (by reference modification above) and Storage
    clientsCache = clients; 
    localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
  },

  getLoans: (): Loan[] => {
    // Return cache if available
    if (loansCache) return loansCache;

    try {
        const data = localStorage.getItem(LOANS_KEY);
        if (!data) {
            loansCache = [];
            return loansCache;
        }
        const parsed = JSON.parse(data);
        if (!Array.isArray(parsed)) {
            loansCache = [];
            return loansCache;
        }

        // Aggressive Sanitization on Read
        loansCache = parsed
            .filter(l => l && typeof l === 'object')
            .map((l: any) => ({
                 ...l,
                 id: String(l.id || Math.random().toString(36).substr(2, 9)),
                 clientId: String(l.clientId || ''),
                 // Ensure numeric values are numbers to prevent NaN crashes
                 amount: Number(l.amount) || 0,
                 interestRate: Number(l.interestRate) || 0,
                 duration: Number(l.duration) || 1,
                 totalPayable: Number(l.totalPayable) || 0,
                 totalPaid: Number(l.totalPaid) || 0,
                 // Ensure arrays exist
                 installments: Array.isArray(l.installments) ? l.installments : [],
                 // Ensure strings exist
                 startDate: l.startDate || new Date().toISOString(),
                 status: l.status || LoanStatus.ACTIVE
            }));
            
        return loansCache;
    } catch (e) {
        console.error("Error reading loans", e);
        return [];
    }
  },

  saveLoan: (loan: Loan): void => {
    const loans = StorageService.getLoans();
    const index = loans.findIndex(l => l.id === loan.id);
    if (index >= 0) {
      loans[index] = loan;
    } else {
      loans.push(loan);
    }
    
    // Update Cache (by reference) and Storage
    loansCache = loans;
    localStorage.setItem(LOANS_KEY, JSON.stringify(loans));
  },

  updateLoan: (loan: Loan): void => {
    const loans = StorageService.getLoans();
    const index = loans.findIndex(l => l.id === loan.id);
    if (index >= 0) {
      loans[index] = loan;
      // Update Cache (by reference) and Storage
      loansCache = loans;
      localStorage.setItem(LOANS_KEY, JSON.stringify(loans));
    }
  },

  payInstallment: (loanId: string, installmentNumber: number): Loan | null => {
    const loans = StorageService.getLoans();
    const loanIndex = loans.findIndex(l => l.id === loanId);
    
    if (loanIndex === -1) return null;

    const loan = loans[loanIndex];
    // Safety check for old data
    if (!loan.installments) loan.installments = [];

    const installmentIndex = loan.installments.findIndex(i => i.number === installmentNumber);
    
    if (installmentIndex === -1) return null;

    // Update Installment
    loan.installments[installmentIndex].status = 'Pagado' as any;
    loan.installments[installmentIndex].paymentDate = new Date().toISOString();

    // Recalculate Totals
    const paidAmount = loan.installments
      .filter(i => i.status === 'Pagado' as any)
      .reduce((acc, curr) => acc + curr.amount, 0);
    
    loan.totalPaid = paidAmount;

    // Check if loan is completed
    const allPaid = loan.installments.every(i => i.status === 'Pagado' as any);
    if (allPaid) {
      loan.status = 'Pagado' as any;
    }

    loans[loanIndex] = loan;
    
    // Update Cache (by reference) and Storage
    loansCache = loans;
    localStorage.setItem(LOANS_KEY, JSON.stringify(loans));
    return loan;
  },

  // --- Data Management Features ---

  exportData: (): string => {
    // Read from cache if available, otherwise read directly from LS to ensure source of truth if cache is empty (though getClients handles this)
    const clients = StorageService.getClients();
    const loans = StorageService.getLoans();
    
    const backup = {
      meta: {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        app: 'LenderPro'
      },
      data: {
        clients: clients,
        loans: loans
      }
    };
    return JSON.stringify(backup, null, 2);
  },

  importData: (jsonInput: string | any): { success: boolean, message?: string } => {
    try {
      if (!jsonInput) return { success: false, message: "No se proporcionaron datos para importar." };
      
      let backup;
      // Handle both string (from file) and object (if passed directly)
      if (typeof jsonInput === 'string') {
        try {
            backup = JSON.parse(jsonInput);
        } catch (e) {
            return { success: false, message: "El archivo está corrupto o no es un JSON válido." };
        }
      } else {
        backup = jsonInput;
      }
      
      // Basic structure validation
      if (!backup || typeof backup !== 'object') {
          return { success: false, message: "Estructura del archivo inválida." };
      }
      
      // Flexible data access
      const dataRoot = backup.data || backup;
      
      // Handle cases where keys might be missing
      const clients = Array.isArray(dataRoot.clients) ? dataRoot.clients : [];
      const loans = Array.isArray(dataRoot.loans) ? dataRoot.loans : [];

      if (clients.length === 0 && loans.length === 0) {
          return { success: false, message: "El archivo no contiene clientes ni préstamos." };
      }

      // --- SANITIZATION & MIGRATION ON IMPORT ---
      
      const sanitizedClients = clients
        .filter((c: any) => c && typeof c === 'object')
        .map((c: any) => ({
            id: String(c.id || Math.random().toString(36).substr(2, 9)),
            name: String(c.name || 'Sin Nombre Recuperado'),
            dni: String(c.dni || ''),
            phone: String(c.phone || ''),
            address: String(c.address || ''),
            createdAt: c.createdAt || new Date().toISOString()
        }));

      const sanitizedLoans = loans
        .filter((l: any) => l && typeof l === 'object')
        .map((l: any) => ({
            id: String(l.id || Math.random().toString(36).substr(2, 9)),
            clientId: String(l.clientId || ''),
            amount: Number(l.amount) || 0,
            interestRate: Number(l.interestRate) || 0,
            interestType: l.interestType || InterestType.PERCENTAGE,
            frequency: l.frequency || Frequency.MONTHLY,
            duration: Number(l.duration) || 1,
            type: l.type || LoanType.SIMPLE,
            startDate: l.startDate || new Date().toISOString().split('T')[0],
            endDate: l.endDate || new Date().toISOString().split('T')[0],
            // Deep sanitization for installments to prevent render crashes
            installments: (Array.isArray(l.installments) ? l.installments : []).map((i: any) => ({
                number: Number(i.number) || 0,
                dueDate: i.dueDate || new Date().toISOString(),
                amount: Number(i.amount) || 0,
                capital: Number(i.capital) || 0,
                interest: Number(i.interest) || 0,
                status: i.status || InstallmentStatus.PENDING,
                paymentDate: i.paymentDate || undefined
            })), 
            status: l.status || LoanStatus.ACTIVE,
            totalPayable: Number(l.totalPayable) || 0,
            totalPaid: Number(l.totalPaid) || 0
        }));

      // Safe save to Storage with specific error handling
      try {
          localStorage.setItem(CLIENTS_KEY, JSON.stringify(sanitizedClients));
          localStorage.setItem(LOANS_KEY, JSON.stringify(sanitizedLoans));
      } catch (storageError: any) {
          // Check for QuotaExceededError
          if (
              storageError.name === 'QuotaExceededError' || 
              storageError.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
              storageError.code === 22
          ) {
              return { success: false, message: "Almacenamiento lleno. Intenta 'Resetear Sistema' antes de importar o libera espacio en el navegador." };
          }
          throw storageError;
      }

      // Update Cache immediately
      clientsCache = sanitizedClients;
      loansCache = sanitizedLoans;

      return { success: true };
    } catch (e: any) {
      console.error("Error processing backup file", e);
      return { success: false, message: `Error inesperado: ${e.message}` };
    }
  },

  clearData: (): void => {
    localStorage.removeItem(CLIENTS_KEY);
    localStorage.removeItem(LOANS_KEY);
    // Clear Cache
    clientsCache = null;
    loansCache = null;
  }
};