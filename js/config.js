/**
 * Hans Financial Note - Configuration
 * Version: 3.0.0
 */

const CONFIG = {
    // Application Info
    app: {
        name: 'Hans Financial Note',
        version: '3.0.0',
        buildDate: '2024-01-01'
    },

    // Currency Settings
    currencies: {
        primary: 'THB',
        secondary: 'IDR',
        symbols: {
            THB: '฿',
            IDR: 'Rp'
        }
    },

    // Exchange Rate Settings
    exchangeRate: {
        default: 460.00,
        source: 'exchangerateapi',
        autoRefresh: true,
        refreshInterval: 300000, // 5 minutes
        providers: {
            exchangerateapi: 'https://api.exchangerate-api.com/v4/latest/THB',
            openexchangerates: 'https://openexchangerates.org/api/latest.json',
            frankfurter: 'https://api.frankfurter.app/latest?from=THB&to=IDR'
        }
    },

    // Firebase Configuration
    // Users should replace these with their own Firebase project credentials
    firebase: {
        apiKey: "AIzaSyDf2NJhrsfy30bz135djNTFVNa9G9C37UY",
        authDomain: "financial-note-7b9a7.firebaseapp.com",
        projectId: "financial-note-7b9a7",
        storageBucket: "financial-note-7b9a7.firebasestorage.app",
        messagingSenderId:  "471750054704",
        appId: ""1:471750054704:web:5522228f68a1a9da412ef5""
    },

    // Google API Configuration
    google: {
        clientId: "471750054704-npa9mbgfco4qb329uk8spcs42ldr5lke.apps.googleusercontent.com",
        apiKey: "AIzaSyBKEsEVuP6IDhulQ1xzlTn4Gny-2ThmCdg",
        scopes: [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive.file',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile'
        ],
        discoveryDocs: [
            'https://sheets.googleapis.com/$discovery/rest?version=v4',
            'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
        ]
    },

    // Utility Settings
    utilities: {
        electricity: {
            defaultRate: 8.00,
            defaultThreshold: 3.00,
            unit: 'kWh'
        },
        water: {
            defaultRate: 20.00,
            unit: 'units'
        }
    },

    // Budget Settings
    budget: {
        defaultAnnualIncome: 600000,
        defaultMonthlyBudget: 50000,
        warningThreshold: 80, // Percentage
        dangerThreshold: 100
    },

    // Investment Settings
    investments: {
        defaultAllocation: 20, // Percentage of income
        defaultStockPercentage: 70,
        defaultCryptoPercentage: 30,
        defaultStockReturn: 1.5, // Monthly percentage
        defaultCryptoReturn: 3.0
    },

    // Storage Keys
    storageKeys: {
        transactions: 'hans_finance_transactions_v3',
        categories: 'hans_finance_categories_v3',
        budget: 'hans_finance_budget_v3',
        investments: 'hans_finance_investments_v3',
        utilities: 'hans_finance_utilities_v3',
        balances: 'hans_finance_balances_v3',
        settings: 'hans_finance_settings_v3',
        setupComplete: 'hans_finance_setup_complete_v3',
        exchangeRates: 'hans_finance_exchange_rates_v3',
        recurring: 'hans_finance_recurring_v3',
        adjustments: 'hans_finance_adjustments_v3',
        googleToken: 'hans_finance_google_token',
        lastSync: 'hans_finance_last_sync'
    },

    // Default Categories
    defaultCategories: {
        income: [
            'Salary',
            'Freelance',
            'Investment Income',
            'Bonus',
            'Interest',
            'Gift Received',
            'Other Income'
        ],
        expense: [
            'Food & Dining',
            'Transportation',
            'Housing',
            'Utilities',
            'Entertainment',
            'Healthcare',
            'Education',
            'Shopping',
            'Travel',
            'Insurance',
            'Personal Care',
            'Other Expense'
        ],
        transfer: [
            'Bank Transfer',
            'Cash Withdrawal',
            'Cash Deposit',
            'Investment Transfer'
        ]
    },

    // Pagination
    pagination: {
        defaultPageSize: 10,
        pageSizeOptions: [10, 25, 50, 100]
    },

    // Auto-save Interval
    autoSave: {
        interval: 30000, // 30 seconds
        enabled: true
    },

    // Backup Settings
    backup: {
        autoBackup: true,
        interval: 3600000, // 1 hour
        maxBackups: 7
    },

    // Theme
    appearance: {
        defaultTheme: 'auto', // 'auto', 'light', 'dark'
        currencyFormat: 'thousands' // 'thousands', 'spaces', 'dots'
    }
};

// Freeze configuration to prevent modifications
Object.freeze(CONFIG);
Object.freeze(CONFIG.app);
Object.freeze(CONFIG.currencies);
Object.freeze(CONFIG.exchangeRate);
Object.freeze(CONFIG.utilities);
Object.freeze(CONFIG.budget);
Object.freeze(CONFIG.investments);
Object.freeze(CONFIG.storageKeys);
Object.freeze(CONFIG.defaultCategories);
Object.freeze(CONFIG.pagination);
Object.freeze(CONFIG.autoSave);
Object.freeze(CONFIG.backup);
Object.freeze(CONFIG.appearance);
