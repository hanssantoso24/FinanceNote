/**
 * Hans Financial Note - Budget Module
 * Handles budget tracking, analysis, and alerts
 */

const BudgetManager = {
    budget: null,

    /**
     * Initialize budget manager
     */
    init() {
        this.budget = DataManager.getBudget();
        this.updateUI();
    },

    /**
     * Set annual income
     */
    setAnnualIncome(income) {
        this.budget.annualIncome = parseFloat(income);
        DataManager.saveBudget(this.budget);
        this.updateUI();
    },

    /**
     * Set monthly budget
     */
    setMonthlyBudget(budget) {
        this.budget.monthlyBudget = parseFloat(budget);
        DataManager.saveBudget(this.budget);
        this.updateUI();
    },

    /**
     * Get monthly income (calculated from annual)
     */
    getMonthlyIncome() {
        return this.budget.annualIncome / 12;
    },

    /**
     * Get current month's spending
     */
    getCurrentMonthSpending() {
        const transactions = DataManager.getTransactions();
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        return transactions
            .filter(t => {
                if (t.type !== 'expense') return false;
                const date = new Date(t.date);
                return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
            })
            .reduce((sum, t) => {
                // Convert to THB if needed
                let amount = parseFloat(t.amount);
                if (t.currency === 'IDR') {
                    amount = ExchangeRateService.idrToThb(amount);
                }
                return sum + amount;
            }, 0);
    },

    /**
     * Get budget remaining
     */
    getBudgetRemaining() {
        const spent = this.getCurrentMonthSpending();
        return this.budget.monthlyBudget - spent;
    },

    /**
     * Get budget percentage used
     */
    getBudgetPercentage() {
        const spent = this.getCurrentMonthSpending();
        return (spent / this.budget.monthlyBudget) * 100;
    },

    /**
     * Get budget status
     */
    getBudgetStatus() {
        const percentage = this.getBudgetPercentage();

        if (percentage >= CONFIG.budget.dangerThreshold) {
            return { status: 'danger', message: 'Budget exceeded!', class: 'danger' };
        } else if (percentage >= CONFIG.budget.warningThreshold) {
            return { status: 'warning', message: 'Approaching budget limit', class: 'warning' };
        } else {
            return { status: 'ok', message: 'On track', class: 'success' };
        }
    },

    /**
     * Get daily budget allowance
     */
    getDailyBudget() {
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        return this.budget.monthlyBudget / daysInMonth;
    },

    /**
     * Get remaining daily budget for rest of month
     */
    getRemainingDailyBudget() {
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const currentDay = now.getDate();
        const daysRemaining = daysInMonth - currentDay + 1;

        const remaining = this.getBudgetRemaining();
        return remaining / daysRemaining;
    },

    /**
     * Get spending by week
     */
    getWeeklySpending() {
        const transactions = DataManager.getTransactions();
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // Group by week
        const weeks = {};
        transactions
            .filter(t => {
                if (t.type !== 'expense') return false;
                const date = new Date(t.date);
                return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
            })
            .forEach(t => {
                const date = new Date(t.date);
                const weekNum = this.getWeekOfMonth(date);
                if (!weeks[weekNum]) weeks[weekNum] = 0;

                let amount = parseFloat(t.amount);
                if (t.currency === 'IDR') {
                    amount = ExchangeRateService.idrToThb(amount);
                }
                weeks[weekNum] += amount;
            });

        return weeks;
    },

    /**
     * Get week of month
     */
    getWeekOfMonth(date) {
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
        return Math.ceil((date.getDate() + firstDay.getDay()) / 7);
    },

    /**
     * Get spending trend
     */
    getSpendingTrend() {
        const transactions = DataManager.getTransactions();
        const now = new Date();

        // Get last 6 months
        const months = [];
        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const month = date.getMonth();
            const year = date.getFullYear();

            const spending = transactions
                .filter(t => {
                    if (t.type !== 'expense') return false;
                    const tDate = new Date(t.date);
                    return tDate.getMonth() === month && tDate.getFullYear() === year;
                })
                .reduce((sum, t) => {
                    let amount = parseFloat(t.amount);
                    if (t.currency === 'IDR') {
                        amount = ExchangeRateService.idrToThb(amount);
                    }
                    return sum + amount;
                }, 0);

            months.push({
                label: date.toLocaleDateString('en-US', { month: 'short' }),
                spending: spending
            });
        }

        return months;
    },

    /**
     * Get savings rate
     */
    getSavingsRate() {
        const transactions = DataManager.getTransactions();
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const monthTransactions = transactions.filter(t => {
            const date = new Date(t.date);
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        });

        const income = monthTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => {
                let amount = parseFloat(t.amount);
                if (t.currency === 'IDR') {
                    amount = ExchangeRateService.idrToThb(amount);
                }
                return sum + amount;
            }, 0);

        const expense = monthTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => {
                let amount = parseFloat(t.amount);
                if (t.currency === 'IDR') {
                    amount = ExchangeRateService.idrToThb(amount);
                }
                return sum + amount;
            }, 0);

        if (income === 0) return 0;
        return ((income - expense) / income) * 100;
    },

    /**
     * Update UI with budget data
     */
    updateUI() {
        const spent = this.getCurrentMonthSpending();
        const remaining = this.getBudgetRemaining();
        const percentage = this.getBudgetPercentage();
        const status = this.getBudgetStatus();
        const dailyBudget = this.getDailyBudget();
        const remainingDaily = this.getRemainingDailyBudget();

        // Update main budget display (index.html IDs)
        const monthlyBudgetTHB = document.getElementById('monthlyBudgetTHB');
        const monthlySpentTHB = document.getElementById('monthlySpentTHB');
        const monthlyRemainingTHB = document.getElementById('monthlyRemainingTHB');
        const budgetUsagePercent = document.getElementById('budgetUsagePercent');
        const budgetProgressBar = document.getElementById('budgetProgressBar');
        const budgetStatusText = document.getElementById('budgetStatusText');
        const headerMonthlyBudget = document.getElementById('headerMonthlyBudget');

        if (monthlyBudgetTHB) {
            monthlyBudgetTHB.textContent = `฿ ${ExchangeRateService.formatNumber(this.budget.monthlyBudget)}`;
        }

        if (monthlySpentTHB) {
            monthlySpentTHB.textContent = `฿ ${ExchangeRateService.formatNumber(spent)}`;
        }

        if (monthlyRemainingTHB) {
            monthlyRemainingTHB.textContent = `฿ ${ExchangeRateService.formatNumber(remaining)}`;
            monthlyRemainingTHB.className = remaining >= 0 ? 'remaining-value' : 'remaining-value danger';
        }

        if (budgetUsagePercent) {
            budgetUsagePercent.textContent = `${Math.min(percentage, 100).toFixed(0)}%`;
        }

        if (budgetProgressBar) {
            budgetProgressBar.style.width = `${Math.min(percentage, 100)}%`;
            budgetProgressBar.className = `progress-fill progress-${status.class === 'success' ? 'good' : status.class}`;
        }

        if (budgetStatusText) {
            budgetStatusText.textContent = status.message;
        }

        if (headerMonthlyBudget) {
            headerMonthlyBudget.textContent = `฿ ${ExchangeRateService.formatNumber(this.budget.monthlyBudget)}`;
        }

        // Legacy element IDs (for modals)
        const budgetDisplay = document.getElementById('monthlyBudgetDisplay');
        const spentDisplay = document.getElementById('budgetSpent');
        const remainingDisplay = document.getElementById('budgetRemaining');
        const progressBar = document.getElementById('budgetProgress');
        const dailyDisplay = document.getElementById('dailyBudget');
        const remainingDailyDisplay = document.getElementById('remainingDailyBudget');
        const statusDisplay = document.getElementById('budgetStatus');

        if (budgetDisplay) {
            budgetDisplay.textContent = ExchangeRateService.format(this.budget.monthlyBudget, 'THB');
        }

        if (spentDisplay) {
            spentDisplay.textContent = ExchangeRateService.format(spent, 'THB');
        }

        if (remainingDisplay) {
            remainingDisplay.textContent = ExchangeRateService.format(remaining, 'THB');
            remainingDisplay.className = remaining >= 0 ? 'text-success' : 'text-danger';
        }

        if (progressBar) {
            progressBar.style.width = `${Math.min(percentage, 100)}%`;
            progressBar.className = `progress-bar progress-${status.class}`;
        }

        if (dailyDisplay) {
            dailyDisplay.textContent = ExchangeRateService.format(dailyBudget, 'THB');
        }

        if (remainingDailyDisplay) {
            remainingDailyDisplay.textContent = ExchangeRateService.format(remainingDaily, 'THB');
            remainingDailyDisplay.className = remainingDaily >= 0 ? 'text-success' : 'text-danger';
        }

        if (statusDisplay) {
            statusDisplay.textContent = status.message;
            statusDisplay.className = `badge badge-${status.class}`;
        }

        // Update input fields
        const annualInput = document.getElementById('annualIncome');
        const monthlyInput = document.getElementById('monthlyBudget');

        if (annualInput) annualInput.value = this.budget.annualIncome;
        if (monthlyInput) monthlyInput.value = this.budget.monthlyBudget;
    },

    /**
     * Handle form submission
     */
    handleSubmit(event) {
        event.preventDefault();
        const form = event.target;

        const annualIncome = parseFloat(form.elements['annualIncome'].value);
        const monthlyBudget = parseFloat(form.elements['monthlyBudget'].value);

        if (!isNaN(annualIncome)) {
            this.setAnnualIncome(annualIncome);
        }

        if (!isNaN(monthlyBudget)) {
            this.setMonthlyBudget(monthlyBudget);
        }

        App.showToast('Budget settings saved', 'success');
    },

    /**
     * Get budget recommendations
     */
    getRecommendations() {
        const recommendations = [];
        const savingsRate = this.getSavingsRate();
        const percentage = this.getBudgetPercentage();
        const categoryStats = TransactionsManager.getCategoryStats('expense', 'month');

        if (savingsRate < 20) {
            recommendations.push({
                type: 'warning',
                message: 'Your savings rate is below 20%. Consider reducing expenses.'
            });
        }

        if (percentage > 90) {
            recommendations.push({
                type: 'danger',
                message: 'You are close to exceeding your budget. Review your spending.'
            });
        }

        // Find highest spending category
        let maxCategory = null;
        let maxAmount = 0;
        Object.entries(categoryStats).forEach(([category, stats]) => {
            if (stats.total > maxAmount) {
                maxAmount = stats.total;
                maxCategory = category;
            }
        });

        if (maxCategory) {
            recommendations.push({
                type: 'info',
                message: `Your highest spending category is ${maxCategory} (${ExchangeRateService.format(maxAmount, 'THB')}).`
            });
        }

        return recommendations;
    }
};
