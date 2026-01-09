export type AnnualBudgetResponse = {
  amount: number | null;
  currency?: string;
  updated_at?: string | null;
};

export type AnnualBudgetViewState = {
  amount: string;
  currency: string;
  lastUpdated: string | null;
  missingYear: number | null;
};

export type AnnualBudgetResolution = {
  state: AnnualBudgetViewState;
  status: 'ok' | 'missing' | 'error';
};

const DEFAULT_CURRENCY = 'USD';

export const isBudgetNotFoundError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const maybeError = error as { status?: number; statusCode?: number };
  return maybeError.status === 404 || maybeError.statusCode === 404;
};

export const resolveAnnualBudgetState = ({
  budget,
  error,
  year,
  defaultCurrency = DEFAULT_CURRENCY,
}: {
  budget?: AnnualBudgetResponse | null;
  error?: unknown;
  year: number;
  defaultCurrency?: string;
}): AnnualBudgetResolution => {
  if (error) {
    if (isBudgetNotFoundError(error)) {
      return {
        status: 'missing',
        state: {
          amount: '',
          currency: defaultCurrency,
          lastUpdated: null,
          missingYear: year,
        },
      };
    }

    return {
      status: 'error',
      state: {
        amount: '',
        currency: defaultCurrency,
        lastUpdated: null,
        missingYear: null,
      },
    };
  }

  if (budget && budget.amount !== null) {
    return {
      status: 'ok',
      state: {
        amount: budget.amount.toString(),
        currency: budget.currency || defaultCurrency,
        lastUpdated: budget.updated_at || null,
        missingYear: null,
      },
    };
  }

  return {
    status: 'ok',
    state: {
      amount: '',
      currency: defaultCurrency,
      lastUpdated: null,
      missingYear: null,
    },
  };
};
