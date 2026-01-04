/**
 * Hans Financial Note - Transactions Module
 * Handles transaction management, filtering, and display
 */

const TransactionsManager = {
    transactions: [],
    filteredTransactions: [],
    currentPage: 1,
    pageSize: CONFIG.pagination.defaultPageSize,
    filters: {
        type: 'all',
        category: 'all',
        currency: 'all',
        dateFrom: null,
        dateTo: null,
        search: ''
    },

    /**
     * Initialize transactions manager
     */
    init() {
        this.transactions = DataManager.getTransactions();
        this.applyFilters();
        this.render();
    },

    /**
     * Add a new transaction
     */
    add(transaction) {
        const newTransaction = {
            id: Date.now().toString(),
            ...transaction,
            createdAt: new Date().toISOString()
        };

        this.transactions.unshift(newTransaction);
        DataManager.saveTransactions(this.transactions);

        // Update balances
        this.updateBalances(newTransaction, 'add');

        this.applyFilters();
        this.render();

        // Trigger event
        window.dispatchEvent(new CustomEvent('transactionAdded', { detail: newTransaction }));

        return newTransaction;
    },

    /**
     * Update a transaction
     */
    update(id, updates) {
        const index = this.transactions.findIndex(t => t.id === id);
        if (index === -1) return false;

        const oldTransaction = { ...this.transactions[index] };

        // Reverse old balance effect
        this.updateBalances(oldTransaction, 'remove');

        // Apply updates
        this.transactions[index] = {
            ...this.transactions[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };

        // Apply new balance effect
        this.updateBalances(this.transactions[index], 'add');

        DataManager.saveTransactions(this.transactions);
        this.applyFilters();
        this.render();

        return true;
    },

    /**
     * Delete a transaction
     */
    delete(id) {
        const transaction = this.transactions.find(t => t.id === id);
        if (!transaction) return false;

        // Reverse balance effect
        this.updateBalances(transaction, 'remove');

        this.transactions = this.transactions.filter(t => t.id !== id);
        DataManager.saveTransactions(this.transactions);

        this.applyFilters();
        this.render();

        return true;
    },

    /**
     * Update balances based on transaction
     */
    updateBalances(transaction, action) {
        const balances = DataManager.getBalances();
        const amount = parseFloat(transaction.amount);
        const paymentMethod = transaction.paymentMethod || 'bank';
        const multiplier = action === 'add' ? 1 : -1;

        if (transaction.type === 'income') {
            // Income adds to balance
            if (paymentMethod === 'bank') {
                balances.bank = (balances.bank || 0) + amount * multiplier;
            } else if (paymentMethod === 'cash') {
                balances.cash = (balances.cash || 0) + amount * multiplier;
            }
            balances.thb = (balances.bank || 0) + (balances.cash || 0);
        } else if (transaction.type === 'expense') {
            // Expense subtracts from balance
            if (paymentMethod === 'bank') {
                balances.bank = (balances.bank || 0) - amount * multiplier;
            } else if (paymentMethod === 'cash') {
                balances.cash = (balances.cash || 0) - amount * multiplier;
            }
            balances.thb = (balances.bank || 0) + (balances.cash || 0);
        } else if (transaction.type === 'transfer') {
            // Transfer between accounts (cash withdrawal)
            if (transaction.category === 'Cash Withdrawal' || transaction.description?.toLowerCase().includes('withdrawal')) {
                // Cash withdrawal: subtract from bank, add to cash
                balances.bank = (balances.bank || 0) - amount * multiplier;
                balances.cash = (balances.cash || 0) + amount * multiplier;
            } else if (transaction.fromCurrency && transaction.toCurrency) {
                // Currency transfer
                const fromCurr = transaction.fromCurrency.toLowerCase();
                const toCurr = transaction.toCurrency.toLowerCase();
                balances[fromCurr] -= amount * multiplier;
                balances[toCurr] += (transaction.toAmount || amount) * multiplier;
            }
            balances.thb = (balances.bank || 0) + (balances.cash || 0);
        }

        DataManager.saveBalances(balances);
        this.updateBalanceDisplay();
    },

    /**
     * Update balance display in UI
     */
    updateBalanceDisplay() {
        const balances = DataManager.getBalances();
        const rate = ExchangeRateService.getRate();

        // Bank balance - match HTML element IDs
        const bankBalanceValue = document.getElementById('bankBalanceValue');
        const bankBalanceIDRValue = document.getElementById('bankBalanceIDRValue');
        if (bankBalanceValue) {
            bankBalanceValue.textContent = ExchangeRateService.formatNumber(balances.bank || 0);
        }
        if (bankBalanceIDRValue) {
            bankBalanceIDRValue.textContent = ExchangeRateService.formatNumber((balances.bank || 0) * rate);
        }

        // Cash balance - match HTML element IDs
        const cashBalanceValue = document.getElementById('cashBalanceValue');
        const cashBalanceIDRValue = document.getElementById('cashBalanceIDRValue');
        if (cashBalanceValue) {
            cashBalanceValue.textContent = ExchangeRateService.formatNumber(balances.cash || 0);
        }
        if (cashBalanceIDRValue) {
            cashBalanceIDRValue.textContent = ExchangeRateService.formatNumber((balances.cash || 0) * rate);
        }

        // Update header total balance
        const totalBalanceTHB = document.getElementById('totalBalanceTHB');
        if (totalBalanceTHB) {
            const totalThb = (balances.bank || 0) + (balances.cash || 0);
            totalBalanceTHB.textContent = `฿ ${ExchangeRateService.formatNumber(totalThb)}`;
        }

        // Update bank and cash exchange rate displays
        const bankExchangeRate = document.getElementById('bankExchangeRate');
        const cashExchangeRate = document.getElementById('cashExchangeRate');
        if (bankExchangeRate) bankExchangeRate.textContent = `${Math.round(rate)} IDR/THB`;
        if (cashExchangeRate) cashExchangeRate.textContent = `${Math.round(rate)} IDR/THB`;

        // Update last transaction info
        if (this.transactions && this.transactions.length > 0) {
            const lastBankTx = this.transactions.find(t => t.paymentMethod === 'bank');
            const lastCashTx = this.transactions.find(t => t.paymentMethod === 'cash');

            const bankLastTx = document.getElementById('bankLastTx');
            const cashLastTx = document.getElementById('cashLastTx');

            if (bankLastTx && lastBankTx) {
                bankLastTx.textContent = `${lastBankTx.type === 'income' ? '+' : '-'}฿${ExchangeRateService.formatNumber(lastBankTx.amount)}`;
            }
            if (cashLastTx && lastCashTx) {
                cashLastTx.textContent = `${lastCashTx.type === 'income' ? '+' : '-'}฿${ExchangeRateService.formatNumber(lastCashTx.amount)}`;
            }
        }

        // Update last updated timestamps
        const bankLastUpdated = document.getElementById('bankLastUpdated');
        const cashLastUpdated = document.getElementById('cashLastUpdated');
        const now = new Date().toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
        if (bankLastUpdated) bankLastUpdated.textContent = now;
        if (cashLastUpdated) cashLastUpdated.textContent = now;
    },

    /**
     * Apply filters to transactions
     */
    applyFilters() {
        this.filteredTransactions = this.transactions.filter(t => {
            // Type filter
            if (this.filters.type !== 'all' && t.type !== this.filters.type) return false;

            // Category filter
            if (this.filters.category !== 'all' && t.category !== this.filters.category) return false;

            // Currency filter
            if (this.filters.currency !== 'all' && t.currency !== this.filters.currency) return false;

            // Date range filter
            if (this.filters.dateFrom) {
                const from = new Date(this.filters.dateFrom);
                const date = new Date(t.date);
                if (date < from) return false;
            }

            if (this.filters.dateTo) {
                const to = new Date(this.filters.dateTo);
                const date = new Date(t.date);
                if (date > to) return false;
            }

            // Search filter
            if (this.filters.search) {
                const search = this.filters.search.toLowerCase();
                const matchCategory = t.category.toLowerCase().includes(search);
                const matchDesc = (t.description || '').toLowerCase().includes(search);
                const matchAmount = t.amount.toString().includes(search);
                if (!matchCategory && !matchDesc && !matchAmount) return false;
            }

            return true;
        });

        // Reset to first page when filters change
        this.currentPage = 1;
    },

    /**
     * Set filter
     */
    setFilter(key, value) {
        this.filters[key] = value;
        this.applyFilters();
        this.render();
    },

    /**
     * Clear all filters
     */
    clearFilters() {
        this.filters = {
            type: 'all',
            category: 'all',
            currency: 'all',
            dateFrom: null,
            dateTo: null,
            search: ''
        };
        this.applyFilters();
        this.render();

        // Reset filter UI elements
        const typeFilter = document.getElementById('filterType');
        const categoryFilter = document.getElementById('filterCategory');
        const currencyFilter = document.getElementById('filterCurrency');
        const searchInput = document.getElementById('searchTransactions');

        if (typeFilter) typeFilter.value = 'all';
        if (categoryFilter) categoryFilter.value = 'all';
        if (currencyFilter) currencyFilter.value = 'all';
        if (searchInput) searchInput.value = '';
    },

    /**
     * Get paginated transactions
     */
    getPaginatedTransactions() {
        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        return this.filteredTransactions.slice(start, end);
    },

    /**
     * Get total pages
     */
    getTotalPages() {
        return Math.ceil(this.filteredTransactions.length / this.pageSize);
    },

    /**
     * Go to page
     */
    goToPage(page) {
        const totalPages = this.getTotalPages();
        if (page >= 1 && page <= totalPages) {
            this.currentPage = page;
            this.render();
        }
    },

    /**
     * Render transactions table
     */
    render() {
        const tbody = document.getElementById('transactionsTableBody');
        const pagination = document.getElementById('transactionsPagination');

        if (!tbody) return;

        const transactions = this.getPaginatedTransactions();

        if (transactions.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">No transactions found</td>
                </tr>
            `;
        } else {
            tbody.innerHTML = transactions.map(t => this.renderRow(t)).join('');
        }

        // Render pagination
        if (pagination) {
            const totalPages = this.getTotalPages();
            pagination.innerHTML = this.renderPagination(totalPages);
        }

        // Update summary
        this.updateSummary();
    },

    /**
     * Render a single transaction row
     */
    renderRow(t) {
        const typeClass = t.type === 'income' ? 'text-success' : t.type === 'expense' ? 'text-danger' : 'text-info';
        const typeIcon = t.type === 'income' ? '+' : t.type === 'expense' ? '-' : '↔';

        return `
            <tr data-id="${t.id}">
                <td>${this.formatDate(t.date)}</td>
                <td><span class="badge badge-${t.type}">${t.type}</span></td>
                <td>${t.category}</td>
                <td class="${typeClass}">
                    ${typeIcon}${ExchangeRateService.format(t.amount, t.currency)}
                </td>
                <td>${t.currency}</td>
                <td>${t.description || '-'}</td>
                <td>
                    <button class="btn btn-small" onclick="TransactionsManager.edit('${t.id}')">Edit</button>
                    <button class="btn btn-small btn-danger" onclick="TransactionsManager.confirmDelete('${t.id}')">Delete</button>
                </td>
            </tr>
        `;
    },

    /**
     * Render pagination controls
     */
    renderPagination(totalPages) {
        if (totalPages <= 1) return '';

        let html = '<div class="pagination">';

        // Previous button
        html += `
            <button class="btn btn-small"
                    onclick="TransactionsManager.goToPage(${this.currentPage - 1})"
                    ${this.currentPage === 1 ? 'disabled' : ''}>
                Previous
            </button>
        `;

        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
                html += `
                    <button class="btn btn-small ${i === this.currentPage ? 'btn-primary' : ''}"
                            onclick="TransactionsManager.goToPage(${i})">
                        ${i}
                    </button>
                `;
            } else if (i === this.currentPage - 3 || i === this.currentPage + 3) {
                html += '<span>...</span>';
            }
        }

        // Next button
        html += `
            <button class="btn btn-small"
                    onclick="TransactionsManager.goToPage(${this.currentPage + 1})"
                    ${this.currentPage === totalPages ? 'disabled' : ''}>
                Next
            </button>
        `;

        html += '</div>';

        // Info
        html += `
            <div class="pagination-info">
                Showing ${(this.currentPage - 1) * this.pageSize + 1} -
                ${Math.min(this.currentPage * this.pageSize, this.filteredTransactions.length)}
                of ${this.filteredTransactions.length} transactions
            </div>
        `;

        return html;
    },

    /**
     * Update summary statistics
     */
    updateSummary() {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const monthTransactions = this.transactions.filter(t => {
            const date = new Date(t.date);
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        });

        const income = monthTransactions
            .filter(t => t.type === 'income' && t.currency === 'THB')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);

        const expense = monthTransactions
            .filter(t => t.type === 'expense' && t.currency === 'THB')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);

        const incomeDisplay = document.getElementById('monthlyIncome');
        const expenseDisplay = document.getElementById('monthlyExpense');
        const netDisplay = document.getElementById('monthlyNet');

        if (incomeDisplay) incomeDisplay.textContent = ExchangeRateService.format(income, 'THB');
        if (expenseDisplay) expenseDisplay.textContent = ExchangeRateService.format(expense, 'THB');
        if (netDisplay) {
            const net = income - expense;
            netDisplay.textContent = ExchangeRateService.format(net, 'THB');
            netDisplay.className = net >= 0 ? 'text-success' : 'text-danger';
        }
    },

    /**
     * Format date for display
     */
    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    },

    /**
     * Open edit modal
     */
    edit(id) {
        const transaction = this.transactions.find(t => t.id === id);
        if (!transaction) return;

        App.openModal('editTransactionModal', transaction);
    },

    /**
     * Confirm delete
     */
    confirmDelete(id) {
        if (confirm('Are you sure you want to delete this transaction?')) {
            this.delete(id);
            App.showToast('Transaction deleted', 'success');
        }
    },

    /**
     * Handle form submission
     */
    handleSubmit(event) {
        event.preventDefault();
        const form = event.target;

        const transaction = {
            date: form.elements['date'].value,
            type: form.elements['type'].value,
            category: form.elements['category'].value,
            amount: parseFloat(form.elements['amount'].value),
            currency: form.elements['currency'].value,
            paymentMethod: form.elements['paymentMethod']?.value || 'bank',
            description: form.elements['description'].value
        };

        if (!transaction.date || !transaction.type || !transaction.category || isNaN(transaction.amount)) {
            App.showToast('Please fill in all required fields', 'error');
            return;
        }

        this.add(transaction);
        App.showToast('Transaction added successfully', 'success');
        form.reset();

        // Set default date to today
        form.elements['date'].value = new Date().toISOString().split('T')[0];
    },

    /**
     * Get category statistics
     */
    getCategoryStats(type = 'expense', period = 'month') {
        let transactions = this.transactions.filter(t => t.type === type);

        // Filter by period
        const now = new Date();
        if (period === 'month') {
            transactions = transactions.filter(t => {
                const date = new Date(t.date);
                return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
            });
        } else if (period === 'year') {
            transactions = transactions.filter(t => {
                const date = new Date(t.date);
                return date.getFullYear() === now.getFullYear();
            });
        }

        // Group by category
        const stats = {};
        transactions.forEach(t => {
            if (!stats[t.category]) {
                stats[t.category] = { total: 0, count: 0 };
            }
            stats[t.category].total += parseFloat(t.amount);
            stats[t.category].count++;
        });

        return stats;
    },

    /**
     * Export transactions to CSV
     */
    exportToCSV() {
        const headers = ['Date', 'Type', 'Category', 'Amount', 'Currency', 'Description'];
        const rows = this.transactions.map(t => [
            t.date,
            t.type,
            t.category,
            t.amount,
            t.currency,
            t.description || ''
        ]);

        const csv = [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }
};
