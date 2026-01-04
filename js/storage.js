/**
 * Hans Financial Note - Storage Service
 * Handles local storage operations with data validation
 */

const StorageService = {
    /**
     * Save data to localStorage with error handling
     */
    save(key, data) {
        try {
            const serialized = JSON.stringify(data);
            localStorage.setItem(key, serialized);
            return true;
        } catch (error) {
            console.error('Storage save error:', error);
            return false;
        }
    },

    /**
     * Load data from localStorage with validation
     */
    load(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            if (data === null) return defaultValue;
            return JSON.parse(data);
        } catch (error) {
            console.error('Storage load error:', error);
            return defaultValue;
        }
    },

    /**
     * Remove item from localStorage
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Storage remove error:', error);
            return false;
        }
    },

    /**
     * Check if key exists in localStorage
     */
    exists(key) {
        return localStorage.getItem(key) !== null;
    },

    /**
     * Clear all app-related data from localStorage
     */
    clearAll() {
        try {
            Object.values(CONFIG.storageKeys).forEach(key => {
                localStorage.removeItem(key);
            });
            return true;
        } catch (error) {
            console.error('Storage clear error:', error);
            return false;
        }
    },

    /**
     * Get total storage usage in bytes
     */
    getUsage() {
        let total = 0;
        Object.values(CONFIG.storageKeys).forEach(key => {
            const item = localStorage.getItem(key);
            if (item) {
                total += item.length * 2; // UTF-16 characters
            }
        });
        return total;
    },

    /**
     * Export all data as JSON
     */
    exportAll() {
        const data = {};
        Object.entries(CONFIG.storageKeys).forEach(([name, key]) => {
            const value = this.load(key);
            if (value !== null) {
                data[name] = value;
            }
        });
        data.exportDate = new Date().toISOString();
        data.appVersion = CONFIG.app.version;
        return data;
    },

    /**
     * Import data from JSON
     */
    importAll(data) {
        try {
            Object.entries(CONFIG.storageKeys).forEach(([name, key]) => {
                if (data[name] !== undefined) {
                    this.save(key, data[name]);
                }
            });
            return true;
        } catch (error) {
            console.error('Import error:', error);
            return false;
        }
    },

    /**
     * Create a backup of all data
     */
    createBackup() {
        const backup = this.exportAll();
        backup.backupDate = new Date().toISOString();
        return backup;
    },

    /**
     * Restore from backup
     */
    restoreBackup(backup) {
        if (!backup || !backup.appVersion) {
            throw new Error('Invalid backup file');
        }
        return this.importAll(backup);
    }
};

// Data Manager for specific data types
const DataManager = {
    // Transactions
    getTransactions() {
        return StorageService.load(CONFIG.storageKeys.transactions, []);
    },

    saveTransactions(transactions) {
        return StorageService.save(CONFIG.storageKeys.transactions, transactions);
    },

    addTransaction(transaction) {
        const transactions = this.getTransactions();
        transaction.id = transaction.id || Date.now().toString();
        transaction.createdAt = transaction.createdAt || new Date().toISOString();
        transactions.unshift(transaction);
        return this.saveTransactions(transactions);
    },

    updateTransaction(id, updates) {
        const transactions = this.getTransactions();
        const index = transactions.findIndex(t => t.id === id);
        if (index !== -1) {
            transactions[index] = { ...transactions[index], ...updates, updatedAt: new Date().toISOString() };
            return this.saveTransactions(transactions);
        }
        return false;
    },

    deleteTransaction(id) {
        const transactions = this.getTransactions();
        const filtered = transactions.filter(t => t.id !== id);
        return this.saveTransactions(filtered);
    },

    // Categories
    getCategories() {
        return StorageService.load(CONFIG.storageKeys.categories, CONFIG.defaultCategories);
    },

    saveCategories(categories) {
        return StorageService.save(CONFIG.storageKeys.categories, categories);
    },

    // Budget
    getBudget() {
        return StorageService.load(CONFIG.storageKeys.budget, {
            annualIncome: CONFIG.budget.defaultAnnualIncome,
            monthlyBudget: CONFIG.budget.defaultMonthlyBudget,
            categoryBudgets: {}
        });
    },

    saveBudget(budget) {
        return StorageService.save(CONFIG.storageKeys.budget, budget);
    },

    // Investments
    getInvestments() {
        return StorageService.load(CONFIG.storageKeys.investments, {
            allocation: CONFIG.investments.defaultAllocation,
            stockPercentage: CONFIG.investments.defaultStockPercentage,
            cryptoPercentage: CONFIG.investments.defaultCryptoPercentage,
            stockReturn: CONFIG.investments.defaultStockReturn,
            cryptoReturn: CONFIG.investments.defaultCryptoReturn
        });
    },

    saveInvestments(investments) {
        return StorageService.save(CONFIG.storageKeys.investments, investments);
    },

    // Utilities
    getUtilities() {
        return StorageService.load(CONFIG.storageKeys.utilities, {
            electricity: {
                rate: CONFIG.utilities.electricity.defaultRate,
                threshold: CONFIG.utilities.electricity.defaultThreshold,
                readings: []
            },
            water: {
                rate: CONFIG.utilities.water.defaultRate,
                readings: []
            }
        });
    },

    saveUtilities(utilities) {
        return StorageService.save(CONFIG.storageKeys.utilities, utilities);
    },

    // Balances
    getBalances() {
        return StorageService.load(CONFIG.storageKeys.balances, {
            thb: 0,
            idr: 0
        });
    },

    saveBalances(balances) {
        return StorageService.save(CONFIG.storageKeys.balances, balances);
    },

    // Settings
    getSettings() {
        return StorageService.load(CONFIG.storageKeys.settings, {
            theme: CONFIG.appearance.defaultTheme,
            currencyFormat: CONFIG.appearance.currencyFormat,
            autoRefreshRate: CONFIG.exchangeRate.autoRefresh
        });
    },

    saveSettings(settings) {
        return StorageService.save(CONFIG.storageKeys.settings, settings);
    },

    // Setup Complete
    isSetupComplete() {
        return StorageService.load(CONFIG.storageKeys.setupComplete, false);
    },

    setSetupComplete(complete) {
        return StorageService.save(CONFIG.storageKeys.setupComplete, complete);
    },

    // Exchange Rates
    getExchangeRates() {
        return StorageService.load(CONFIG.storageKeys.exchangeRates, {
            rate: CONFIG.exchangeRate.default,
            lastUpdate: null
        });
    },

    saveExchangeRates(rates) {
        return StorageService.save(CONFIG.storageKeys.exchangeRates, rates);
    },

    // Recurring Transactions
    getRecurring() {
        return StorageService.load(CONFIG.storageKeys.recurring, []);
    },

    saveRecurring(recurring) {
        return StorageService.save(CONFIG.storageKeys.recurring, recurring);
    },

    // Balance Adjustments
    getAdjustments() {
        return StorageService.load(CONFIG.storageKeys.adjustments, []);
    },

    saveAdjustments(adjustments) {
        return StorageService.save(CONFIG.storageKeys.adjustments, adjustments);
    }
};
