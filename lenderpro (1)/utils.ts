import { Frequency, Installment, InstallmentStatus, LoanType, InterestType } from './types';

// --- Date Helpers (Robust Timezone Handling) ---

// Create a Date object set to Noon Local Time to prevent timezone shifts when converting
export const parseDate = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  if (dateStr.includes('T')) return new Date(dateStr); // Already ISO full
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
};

export const toISODate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// --- Formatters ---

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2
  }).format(amount);
};

export const formatDate = (dateString: string): string => {
  if (!dateString) return '-';
  const date = parseDate(dateString.split('T')[0]);
  
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}/${month}/${year}`;
};

// --- Date Math ---

export const addTime = (date: Date, frequency: Frequency, count: number): Date => {
  const result = new Date(date);
  // Ensure we operate on noon to avoid DST skips causing day shifts
  result.setHours(12, 0, 0, 0); 
  
  switch (frequency) {
    case Frequency.DAILY:
      result.setDate(result.getDate() + count);
      break;
    case Frequency.WEEKLY:
      result.setDate(result.getDate() + (count * 7));
      break;
    case Frequency.BIWEEKLY:
      result.setDate(result.getDate() + (count * 15));
      break;
    case Frequency.MONTHLY:
      result.setMonth(result.getMonth() + count);
      break;
  }
  return result;
};

export const calculateDurationFromDates = (start: string, end: string, frequency: Frequency): number => {
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  
  if (endDate <= startDate) return 1;

  // Iteratively check how many periods fit before exceeding the end date
  // This ensures perfect consistency with addTime logic logic regardless of month lengths
  let count = 0;
  // Safety limit of 100 years to prevent infinite loops if dates are wild
  while (count < 1200) { 
    const nextDate = addTime(startDate, frequency, count + 1);
    if (nextDate > endDate) break;
    count++;
  }
  
  return count > 0 ? count : 1;
};

// --- Financial Core ---

/**
 * Calculates the loan amortization schedule.
 * Supports variable rates via the variableRates parameter.
 * 
 * @param variableRates - An optional object where keys are installment numbers (1-based) 
 * and values are the new rate/amount to apply from that period onwards.
 */
export const calculateSchedule = (
  amount: number,
  initialRateOrAmount: number, // Can be % or Fixed Amount
  interestType: InterestType,
  frequency: Frequency,
  duration: number,
  loanType: LoanType,
  startDate: string,
  variableRates?: { [installmentNumber: number]: number }
): Installment[] => {
  const installments: Installment[] = [];
  let currentDate = parseDate(startDate);
  
  // Track current rate as we iterate, initialized with the starting rate
  let currentRate = initialRateOrAmount;

  if (loanType === LoanType.SIMPLE) {
    // Simple Interest Logic:
    // Capital is divided evenly. Interest is calculated per period based on the *current* rate setting.
    // Note: If InterestType is PERCENTAGE, 'currentRate' is treated as the Global Rate for the loan term.
    // To calculate the interest for a specific period, we derive the period slice: (Principal * (Rate/100)) / Duration.
    
    const capitalPerInstallment = amount / duration;

    for (let i = 1; i <= duration; i++) {
      // Check for rate change at this installment
      if (variableRates && variableRates[i] !== undefined) {
        currentRate = variableRates[i];
      }

      currentDate = addTime(parseDate(startDate), frequency, i);
      
      let interestForPeriod = 0;
      
      if (interestType === InterestType.FIXED_AMOUNT) {
        // If fixed amount (e.g., $1200 total interest), the portion for this period is Total / Duration
        interestForPeriod = currentRate / duration;
      } else {
        // If percentage (e.g., 10% total interest), calc total expected interest then divide by duration
        // Interest_i = (Principal * Rate_i%) / Duration
        const totalInterestForRate = amount * (currentRate / 100);
        interestForPeriod = totalInterestForRate / duration;
      }

      installments.push({
        number: i,
        dueDate: toISODate(currentDate),
        amount: capitalPerInstallment + interestForPeriod,
        capital: capitalPerInstallment,
        interest: interestForPeriod,
        status: InstallmentStatus.PENDING
      });
    }

  } else if (loanType === LoanType.FRENCH) {
    // Fallback if Fixed Amount is selected for French (treat as simple)
    if (interestType === InterestType.FIXED_AMOUNT) {
         return calculateSchedule(amount, initialRateOrAmount, interestType, frequency, duration, LoanType.SIMPLE, startDate, variableRates);
    }

    // French System with Variable Rates (Re-amortization)
    let remainingCapital = amount;
    let installmentAmount = 0; // PMT

    for (let k = 1; k <= duration; k++) {
      // Check for rate change
      let rateChanged = false;
      if (variableRates && variableRates[k] !== undefined) {
        currentRate = variableRates[k];
        rateChanged = true;
      }

      // Calculate (or Recalculate) PMT if:
      // 1. It's the first period
      // 2. The rate has changed (Re-amortization based on remaining capital and remaining terms)
      if (k === 1 || rateChanged) {
        const i = currentRate / 100; // Rate per period
        const remainingTerms = duration - k + 1;
        
        if (i === 0) {
          installmentAmount = remainingCapital / remainingTerms;
        } else {
          // Standard French Amortization Formula applied to remaining balance
          installmentAmount = remainingCapital * (i * Math.pow(1 + i, remainingTerms)) / (Math.pow(1 + i, remainingTerms) - 1);
        }
      }

      const i = currentRate / 100;
      const interestPayment = remainingCapital * i;
      let capitalPayment = installmentAmount - interestPayment;
      
      // Handle last installment rounding to ensure perfect zero balance
      if (k === duration) {
        capitalPayment = remainingCapital;
        installmentAmount = capitalPayment + interestPayment;
      }

      currentDate = addTime(parseDate(startDate), frequency, k);
      
      installments.push({
        number: k,
        dueDate: toISODate(currentDate),
        amount: installmentAmount,
        capital: capitalPayment,
        interest: interestPayment,
        status: InstallmentStatus.PENDING
      });

      remainingCapital -= capitalPayment;
      // Prevent negative zero floating point issues
      if (remainingCapital < 0.01) remainingCapital = 0;
    }
  }

  return installments;
};

// --- Status Helpers ---

export const getInstallmentStatus = (inst: Installment): InstallmentStatus => {
  if (inst.status === InstallmentStatus.PAID) return InstallmentStatus.PAID;
  
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const due = parseDate(inst.dueDate);
  due.setHours(0,0,0,0);

  if (today > due) return InstallmentStatus.LATE;
  return InstallmentStatus.PENDING;
};