/**
 * Hans Financial Note - Main Application
 * Core application logic and initialization
 */

const App = {
    isLoading: true,
    isSetupComplete: false,

    /**
     * Initialize the application
     */
    async init() {
        console.log(`${CONFIG.app.name} v${CONFIG.app.version} initializing...`);

        this.showLoading();

        try {
            // Check if setup is complete
            this.isSetupComplete = DataManager.isSetupComplete();

            // Initialize core services
            ExchangeRateService.init();

            // Initialize Firebase
            await FirebaseService.init();

            // Initialize Google API - WITH ERROR HANDLING
            try {
                await GoogleAPIService.init();
            } catch (googleError) {
                console.warn('Google API init warning (continuing without Google Sheets):', googleError);
                // Don't throw error, just continue without Google Sheets
            }

            // Initialize managers
            TransactionsManager.init();
            BudgetManager.init();
            InvestmentsManager.init();
            
            // Initialize UtilitiesManager - WITH ERROR HANDLING
            try {
                UtilitiesManager.init();
            } catch (utilsError) {
                console.warn('UtilitiesManager init warning (continuing without utilities):', utilsError);
                // Don't throw error, just continue without utilities
            }
            
            ModalsManager.init();

            // Initialize charts (after a small delay to ensure DOM is ready)
            setTimeout(() => ChartsManager.init(), 100);

            // Bind UI events
            this.bindEvents();

            // Show appropriate view
            if (this.isSetupComplete) {
                this.showApp();
            } else {
                this.showSetupWizard();
            }

            // Set up auto-sync
            this.setupAutoSync();

            this.hideLoading();
            console.log('App initialized successfully');

        } catch (error) {
            console.error('App initialization error:', error);
            this.hideLoading();
            this.showToast('Error initializing app', 'error');
        }
    },

    /**
     * Bind UI events
     */
    bindEvents() {
        // Transaction form
        const transactionForm = document.getElementById('transactionForm');
        if (transactionForm) {
            transactionForm.addEventListener('submit', (e) => this.handleTransactionSubmit(e));
        }

        // Type selector - update categories
        const typeSelect = document.getElementById('txType');
        if (typeSelect) {
            typeSelect.addEventListener('change', (e) => {
                this.updateCategories(e.target.value);
            });
        }

        // Set default date to today
        const dateInput = document.getElementById('txDate');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        // Reset form button
        const resetFormBtn = document.getElementById('resetFormBtn');
        if (resetFormBtn) {
            resetFormBtn.addEventListener('click', () => {
                document.getElementById('transactionForm')?.reset();
                document.getElementById('txDate').value = new Date().toISOString().split('T')[0];
            });
        }

        // Filter buttons
        document.querySelectorAll('.filter-buttons .btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-buttons .btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                const filter = e.target.dataset.filter;
                TransactionsManager.setFilter('type', filter);
            });
        });

        // Category filter
        const categoryFilter = document.getElementById('categoryFilter');
        if (categoryFilter) {
            categoryFilter.addEventListener('change', (e) => TransactionsManager.setFilter('category', e.target.value));
        }

        // Date filters
        const startDateFilter = document.getElementById('startDateFilter');
        const endDateFilter = document.getElementById('endDateFilter');
        const applyFiltersBtn = document.getElementById('applyFiltersBtn');
        const clearFiltersBtn = document.getElementById('clearFiltersBtn');

        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', () => {
                if (startDateFilter) TransactionsManager.setFilter('dateFrom', startDateFilter.value);
                if (endDateFilter) TransactionsManager.setFilter('dateTo', endDateFilter.value);
            });
        }

        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => {
                TransactionsManager.clearFilters();
                if (startDateFilter) startDateFilter.value = '';
                if (endDateFilter) endDateFilter.value = '';
                if (categoryFilter) categoryFilter.value = '';
            });
        }

        // Refresh rate button
        const refreshRateBtn = document.getElementById('refreshRateBtn');
        if (refreshRateBtn) {
            refreshRateBtn.addEventListener('click', async () => {
                refreshRateBtn.disabled = true;
                await ExchangeRateService.fetchRate();
                refreshRateBtn.disabled = false;
                this.showToast('Exchange rate refreshed', 'success');
            });
        }

        // Manual rate button
        const manualRateBtn = document.getElementById('manualRateBtn');
        if (manualRateBtn) {
            manualRateBtn.addEventListener('click', () => {
                const newRate = prompt('Enter exchange rate (IDR per THB):', ExchangeRateService.getRate());
                if (newRate && !isNaN(parseFloat(newRate))) {
                    ExchangeRateService.setRate(parseFloat(newRate));
                    this.showToast('Exchange rate updated', 'success');
                }
            });
        }

        // Cloud Sign In button (in the sync bar)
        const cloudSignInBtn = document.getElementById('cloudSignInBtn');
        if (cloudSignInBtn) {
            cloudSignInBtn.addEventListener('click', () => this.signInWithGoogle());
        }

        // Settings buttons (header and footer)
        const headerSettingsBtn = document.getElementById('headerSettingsBtn');
        const settingsBtn = document.getElementById('settingsBtn');
        if (headerSettingsBtn) {
            headerSettingsBtn.addEventListener('click', () => this.openModal('settingsModal'));
        }
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.openModal('settingsModal'));
        }

        // Help button
        const headerHelpBtn = document.getElementById('headerHelpBtn');
        const helpBtn = document.getElementById('helpBtn');
        if (headerHelpBtn) {
            headerHelpBtn.addEventListener('click', () => this.showHelp());
        }
        if (helpBtn) {
            helpBtn.addEventListener('click', () => this.showHelp());
        }

        // Budget configure button
        const editBudgetBtn = document.getElementById('editBudgetBtn');
        if (editBudgetBtn) {
            editBudgetBtn.addEventListener('click', () => this.openModal('budgetModal'));
        }

        // Investment edit button
        const editInvestmentsBtn = document.getElementById('editInvestmentsBtn');
        if (editInvestmentsBtn) {
            editInvestmentsBtn.addEventListener('click', () => this.openModal('investmentModal'));
        }

        // Balance edit buttons
        const editBankBalanceBtn = document.getElementById('editBankBalanceBtn');
        const editCashBalanceBtn = document.getElementById('editCashBalanceBtn');
        if (editBankBalanceBtn) {
            editBankBalanceBtn.addEventListener('click', () => this.editBalance('bank'));
        }
        if (editCashBalanceBtn) {
            editCashBalanceBtn.addEventListener('click', () => this.editBalance('cash'));
        }

        // Utility settings button
        const utilitySettingsBtn = document.getElementById('utilitySettingsBtn');
        if (utilitySettingsBtn) {
            utilitySettingsBtn.addEventListener('click', () => this.openModal('utilitySettingsModal'));
        }

        // Electricity calculate button
        const calculateElectricityBtn = document.getElementById('calculateElectricityBtn');
        if (calculateElectricityBtn) {
            calculateElectricityBtn.addEventListener('click', () => this.calculateElectricity());
        }

        // Water calculate button
        const calculateWaterBtn = document.getElementById('calculateWaterBtn');
        if (calculateWaterBtn) {
            calculateWaterBtn.addEventListener('click', () => this.calculateWater());
        }

        // Export button
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => TransactionsManager.exportToCSV());
        }

        // Sync to Sheets button
        const syncToSheetsBtn = document.getElementById('syncToSheetsBtn');
        if (syncToSheetsBtn) {
            syncToSheetsBtn.addEventListener('click', () => this.exportToSheets());
        }

        // Backup/Restore buttons
        const backupBtn = document.getElementById('backupBtn');
        const restoreBtn = document.getElementById('restoreBtn');
        if (backupBtn) {
            backupBtn.addEventListener('click', () => this.backupData());
        }
        if (restoreBtn) {
            restoreBtn.addEventListener('click', () => this.restoreData());
        }

        // Setup wizard buttons
        this.bindSetupWizardEvents();

        // Listen for Firebase auth changes
        window.addEventListener('userSignedIn', (e) => this.onUserSignedIn(e.detail.user));
        window.addEventListener('userSignedOut', () => this.onUserSignedOut());

        // Listen for Google authorization
        window.addEventListener('googleAuthorized', () => this.onGoogleAuthorized());

        // Listen for exchange rate updates
        window.addEventListener('exchangeRateUpdated', () => {
            ChartsManager.updateAll();
        });

        // Listen for transaction changes
        window.addEventListener('transactionAdded', () => {
            BudgetManager.updateUI();
            ChartsManager.updateAll();
        });
    },

    /**
     * Bind setup wizard events
     */
    bindSetupWizardEvents() {
        // Start setup button
        const startSetupBtn = document.getElementById('startSetupBtn');
        if (startSetupBtn) {
            startSetupBtn.addEventListener('click', () => this.nextWizardStep());
        }

        // Import data button
        const importDataBtn = document.getElementById('importDataBtn');
        if (importDataBtn) {
            importDataBtn.addEventListener('click', () => this.importDataFromFile());
        }

        // Wizard Google Sign In
        const wizardGoogleSignInBtn = document.getElementById('wizardGoogleSignInBtn');
        if (wizardGoogleSignInBtn) {
            wizardGoogleSignInBtn.addEventListener('click', () => this.signInWithGoogle());
        }

        // Skip cloud button
        const skipCloudBtn = document.getElementById('skipCloudBtn');
        if (skipCloudBtn) {
            skipCloudBtn.addEventListener('click', () => this.nextWizardStep());
        }

        // Wizard navigation buttons
        for (let i = 2; i <= 5; i++) {
            const prevBtn = document.getElementById(`prevStep${i}Btn`);
            const nextBtn = document.getElementById(`nextStep${i}Btn`);

            if (prevBtn) {
                prevBtn.addEventListener('click', () => this.prevWizardStep());
            }
            if (nextBtn) {
                nextBtn.addEventListener('click', () => this.nextWizardStep());
            }
        }

        // Finish setup button
        const finishSetupBtn = document.getElementById('finishSetupBtn');
        if (finishSetupBtn) {
            finishSetupBtn.addEventListener('click', () => this.completeSetup());
        }

        // Category tabs
        document.querySelectorAll('.category-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.loadCategoriesForType(e.target.dataset.type);
            });
        });
    },

    /**
     * Handle transaction form submit
     */
    handleTransactionSubmit(e) {
        e.preventDefault();

        const form = e.target;
        const transaction = {
            date: document.getElementById('txDate')?.value,
            amount: parseFloat(document.getElementById('txAmount')?.value),
            type: document.getElementById('txType')?.value,
            description: document.getElementById('txDescription')?.value,
            category: document.getElementById('txCategory')?.value,
            paymentMethod: document.getElementById('txPaymentMethod')?.value,
            notes: document.getElementById('txNotes')?.value,
            currency: 'THB'
        };

        if (!transaction.date || !transaction.amount || !transaction.type || !transaction.description) {
            this.showToast('Please fill in all required fields', 'error');
            return;
        }

        TransactionsManager.add(transaction);
        this.showToast('Transaction added successfully', 'success');
        form.reset();
        document.getElementById('txDate').value = new Date().toISOString().split('T')[0];
    },

    /**
     * Next wizard step
     */
    nextWizardStep() {
        if (!this.currentWizardStep) this.currentWizardStep = 1;

        // Save current step data
        this.saveWizardStepData(this.currentWizardStep);

        this.currentWizardStep++;
        this.updateWizardDisplay();
    },

    /**
     * Previous wizard step
     */
    prevWizardStep() {
        if (this.currentWizardStep > 1) {
            this.currentWizardStep--;
            this.updateWizardDisplay();
        }
    },

    /**
     * Update wizard display
     */
    updateWizardDisplay() {
        // Hide all steps
        for (let i = 1; i <= 5; i++) {
            const step = document.getElementById(`step${i}`);
            if (step) {
                step.classList.remove('active');
                step.style.display = 'none';
            }
        }

        // Show current step
        const currentStep = document.getElementById(`step${this.currentWizardStep}`);
        if (currentStep) {
            currentStep.classList.add('active');
            currentStep.style.display = 'block';
        }

        // Update progress bar
        const progress = document.getElementById('wizardProgress');
        if (progress) {
            progress.style.width = `${(this.currentWizardStep / 5) * 100}%`;
        }
    },

    /**
     * Save wizard step data
     */
    saveWizardStepData(step) {
        switch(step) {
            case 3: // Balances
                const bankBalance = parseFloat(document.getElementById('initialBankBalance')?.value) || 0;
                const cashBalance = parseFloat(document.getElementById('initialCashBalance')?.value) || 0;
                DataManager.saveBalances({
                    thb: bankBalance + cashBalance,
                    idr: 0,
                    bank: bankBalance,
                    cash: cashBalance
                });
                break;
            case 5: // Utilities
                const elecReading = parseFloat(document.getElementById('initialElectricityReading')?.value) || 0;
                const elecRate = parseFloat(document.getElementById('electricityRateSetup')?.value) || 8;
                const waterReading = parseFloat(document.getElementById('initialWaterReading')?.value) || 0;
                const waterRate = parseFloat(document.getElementById('waterRateSetup')?.value) || 20;

                DataManager.saveUtilities({
                    electricity: {
                        rate: elecRate,
                        threshold: 3,
                        readings: [],
                        lastReading: elecReading
                    },
                    water: {
                        rate: waterRate,
                        readings: [],
                        lastReading: waterReading
                    }
                });
                break;
        }
    },

    /**
     * Edit balance
     */
    editBalance(type) {
        const balances = DataManager.getBalances();
        const currentValue = type === 'bank' ? (balances.bank || 0) : (balances.cash || 0);
        const newValue = prompt(`Enter new ${type} balance (THB):`, currentValue);

        if (newValue !== null && !isNaN(parseFloat(newValue))) {
            if (type === 'bank') {
                balances.bank = parseFloat(newValue);
            } else {
                balances.cash = parseFloat(newValue);
            }
            balances.thb = (balances.bank || 0) + (balances.cash || 0);
            DataManager.saveBalances(balances);
            this.updateBalanceDisplay();
            this.showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} balance updated`, 'success');
        }
    },

    /**
     * Update balance display
     */
    updateBalanceDisplay() {
        const balances = DataManager.getBalances();
        const rate = ExchangeRateService.getRate();

        // Bank balance
        const bankValue = document.getElementById('bankBalanceValue');
        const bankIDRValue = document.getElementById('bankBalanceIDRValue');
        if (bankValue) bankValue.textContent = ExchangeRateService.formatNumber(balances.bank || 0);
        if (bankIDRValue) bankIDRValue.textContent = ExchangeRateService.formatNumber((balances.bank || 0) * rate);

        // Cash balance
        const cashValue = document.getElementById('cashBalanceValue');
        const cashIDRValue = document.getElementById('cashBalanceIDRValue');
        if (cashValue) cashValue.textContent = ExchangeRateService.formatNumber(balances.cash || 0);
        if (cashIDRValue) cashIDRValue.textContent = ExchangeRateService.formatNumber((balances.cash || 0) * rate);

        // Total balance
        const totalBalance = document.getElementById('totalBalanceTHB');
        if (totalBalance) totalBalance.textContent = `฿ ${ExchangeRateService.formatNumber(balances.thb || 0)}`;
    },

    /**
     * Calculate electricity
     */
    calculateElectricity() {
        const currentReading = parseFloat(document.getElementById('electricityCurrentReading')?.value);
        const currentDate = document.getElementById('electricityCurrentDate')?.value;

        if (isNaN(currentReading) || !currentDate) {
            this.showToast('Please enter current reading and date', 'error');
            return;
        }

        const utilities = DataManager.getUtilities();
        const lastReading = utilities.electricity.lastReading || 0;
        const rate = utilities.electricity.rate || 8;

        const usage = currentReading - lastReading;
        const cost = usage * rate;

        // Show result
        document.getElementById('electricityTotal').textContent = `${usage.toFixed(2)} kWh`;
        document.getElementById('electricityCostTHB').textContent = `฿ ${cost.toFixed(2)}`;
        document.getElementById('electricityCalcResult').style.display = 'block';

        // Save electricity button
        const saveBtn = document.getElementById('saveElectricityBtn');
        if (saveBtn) {
            saveBtn.onclick = () => {
                utilities.electricity.lastReading = currentReading;
                utilities.electricity.readings.unshift({
                    date: currentDate,
                    reading: currentReading,
                    usage: usage,
                    cost: cost
                });
                DataManager.saveUtilities(utilities);

                // Add as expense
                TransactionsManager.add({
                    date: currentDate,
                    amount: cost,
                    type: 'expense',
                    category: 'Utilities',
                    description: `Electricity bill: ${usage.toFixed(2)} kWh`,
                    currency: 'THB'
                });

                this.showToast('Electricity reading saved', 'success');
                document.getElementById('electricityCalcResult').style.display = 'none';
            };
        }
    },

    /**
     * Calculate water
     */
    calculateWater() {
        const currentReading = parseFloat(document.getElementById('waterCurrentReading')?.value);
        const currentDate = document.getElementById('waterCurrentDate')?.value;

        if (isNaN(currentReading) || !currentDate) {
            this.showToast('Please enter current reading and date', 'error');
            return;
        }

        const utilities = DataManager.getUtilities();
        const lastReading = utilities.water.lastReading || 0;
        const rate = utilities.water.rate || 20;

        const usage = currentReading - lastReading;
        const cost = usage * rate;

        // Show result
        document.getElementById('waterTotal').textContent = `${usage.toFixed(2)} units`;
        document.getElementById('waterCostTHB').textContent = `฿ ${cost.toFixed(2)}`;
        document.getElementById('waterCalcResult').style.display = 'block';

        // Save water button
        const saveBtn = document.getElementById('saveWaterBtn');
        if (saveBtn) {
            saveBtn.onclick = () => {
                utilities.water.lastReading = currentReading;
                utilities.water.readings.unshift({
                    date: currentDate,
                    reading: currentReading,
                    usage: usage,
                    cost: cost
                });
                DataManager.saveUtilities(utilities);

                // Add as expense
                TransactionsManager.add({
                    date: currentDate,
                    amount: cost,
                    type: 'expense',
                    category: 'Utilities',
                    description: `Water bill: ${usage.toFixed(2)} units`,
                    currency: 'THB'
                });

                this.showToast('Water reading saved', 'success');
                document.getElementById('waterCalcResult').style.display = 'none';
            };
        }
    },

    /**
     * Backup data
     */
    backupData() {
        const data = StorageService.exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `finance_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('Backup downloaded', 'success');
    },

    /**
     * Restore data
     */
    restoreData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    StorageService.importAll(data);
                    this.showToast('Data restored successfully. Reloading...', 'success');
                    setTimeout(() => window.location.reload(), 1500);
                } catch (err) {
                    this.showToast('Invalid backup file', 'error');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    },

    /**
     * Import data from file (for setup wizard)
     */
    importDataFromFile() {
        this.restoreData();
    },

    /**
     * Show help
     */
    showHelp() {
        alert('Hans Financial Note v3.0.0\n\nA personal finance management app with:\n- Dual currency support (THB/IDR)\n- Budget tracking\n- Investment projections\n- Utility monitoring\n- Cloud sync with Google\n\nFor support, contact the developer.');
    },

    /**
     * Load categories for type (setup wizard)
     */
    loadCategoriesForType(type) {
        const container = document.getElementById('initialCategoriesContainer');
        if (!container) return;

        const categories = DataManager.getCategories();
        const list = categories[type] || [];

        container.innerHTML = list.map(cat => `
            <div class="category-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px; margin: 4px 0; background: white; border-radius: 4px;">
                <span>${cat}</span>
                <button class="btn btn-sm btn-danger" onclick="App.removeCategory('${type}', '${cat}')">&times;</button>
            </div>
        `).join('');
    },

    /**
     * Remove category
     */
    removeCategory(type, category) {
        const categories = DataManager.getCategories();
        categories[type] = categories[type].filter(c => c !== category);
        DataManager.saveCategories(categories);
        this.loadCategoriesForType(type);
    },

    /**
     * Update categories dropdown based on transaction type
     */
    updateCategories(type) {
        const categorySelect = document.getElementById('transactionCategory');
        if (!categorySelect) return;

        const categories = DataManager.getCategories();
        const options = categories[type] || [];

        categorySelect.innerHTML = options.map(cat =>
            `<option value="${cat}">${cat}</option>`
        ).join('');
    },

    /**
     * Show loading overlay
     */
    showLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.remove('hidden');
            overlay.style.display = 'flex';
        }
    },

    /**
     * Hide loading overlay
     */
    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
            // Also set display none after transition
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 300);
        }
    },

    /**
     * Show main application
     */
    showApp() {
        const wizard = document.getElementById('setupWizard');
        const app = document.getElementById('mainApp');

        if (wizard) wizard.style.display = 'none';
        if (app) app.style.display = 'block';

        // Update all displays
        TransactionsManager.updateBalanceDisplay();
        BudgetManager.updateUI();
        InvestmentsManager.updateUI();
        
        // Update Utilities UI only if it initialized successfully
        try {
            UtilitiesManager.updateUI();
        } catch (error) {
            console.warn('Could not update Utilities UI:', error);
        }
        
        ExchangeRateService.updateUI();
    },

    /**
     * Show setup wizard
     */
    showSetupWizard() {
        const wizard = document.getElementById('setupWizard');
        const app = document.getElementById('mainApp');

        if (wizard) wizard.style.display = 'block';
        if (app) app.style.display = 'none';

        this.initSetupWizard();
    },

    /**
     * Initialize setup wizard
     */
    initSetupWizard() {
        this.currentStep = 1;
        this.totalSteps = 5;
        this.updateWizardUI();

        // Next/Previous buttons
        const nextBtn = document.getElementById('wizardNext');
        const prevBtn = document.getElementById('wizardPrev');

        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.nextStep());
        }
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.prevStep());
        }
    },

    /**
     * Go to next wizard step
     */
    nextStep() {
        if (this.currentStep < this.totalSteps) {
            // Validate current step
            if (!this.validateStep(this.currentStep)) return;

            // Save current step data
            this.saveStepData(this.currentStep);

            this.currentStep++;
            this.updateWizardUI();
        } else {
            // Complete setup
            this.completeSetup();
        }
    },

    /**
     * Go to previous wizard step
     */
    prevStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.updateWizardUI();
        }
    },

    /**
     * Update wizard UI
     */
    updateWizardUI() {
        // Update step indicators
        document.querySelectorAll('.wizard-step').forEach((step, index) => {
            step.classList.toggle('active', index + 1 === this.currentStep);
            step.classList.toggle('completed', index + 1 < this.currentStep);
        });

        // Update step content
        document.querySelectorAll('.wizard-content').forEach((content, index) => {
            content.classList.toggle('active', index + 1 === this.currentStep);
        });

        // Update buttons
        const prevBtn = document.getElementById('wizardPrev');
        const nextBtn = document.getElementById('wizardNext');

        if (prevBtn) {
            prevBtn.style.display = this.currentStep === 1 ? 'none' : 'block';
        }
        if (nextBtn) {
            nextBtn.textContent = this.currentStep === this.totalSteps ? 'Complete Setup' : 'Next';
        }

        // Update progress bar
        const progress = document.getElementById('wizardProgress');
        if (progress) {
            progress.style.width = `${(this.currentStep / this.totalSteps) * 100}%`;
        }
    },

    /**
     * Validate wizard step
     */
    validateStep(step) {
        switch (step) {
            case 1: // Welcome - no validation
                return true;
            case 2: // Initial balance
                const thbBalance = document.getElementById('setupThbBalance');
                const idrBalance = document.getElementById('setupIdrBalance');
                return thbBalance && idrBalance;
            case 3: // Budget
                const annualIncome = document.getElementById('setupAnnualIncome');
                const monthlyBudget = document.getElementById('setupMonthlyBudget');
                return annualIncome && monthlyBudget;
            case 4: // Investment
                return true;
            case 5: // Complete
                return true;
            default:
                return true;
        }
    },

    /**
     * Save wizard step data
     */
    saveStepData(step) {
        switch (step) {
            case 2: // Initial balance
                const thbBalance = parseFloat(document.getElementById('setupThbBalance')?.value) || 0;
                const idrBalance = parseFloat(document.getElementById('setupIdrBalance')?.value) || 0;
                DataManager.saveBalances({ thb: thbBalance, idr: idrBalance });
                break;
            case 3: // Budget
                const annualIncome = parseFloat(document.getElementById('setupAnnualIncome')?.value) || CONFIG.budget.defaultAnnualIncome;
                const monthlyBudget = parseFloat(document.getElementById('setupMonthlyBudget')?.value) || CONFIG.budget.defaultMonthlyBudget;
                DataManager.saveBudget({ annualIncome, monthlyBudget });
                break;
            case 4: // Investment
                const allocation = parseFloat(document.getElementById('setupInvestmentAllocation')?.value) || CONFIG.investments.defaultAllocation;
                const stockPercentage = parseFloat(document.getElementById('setupStockPercentage')?.value) || CONFIG.investments.defaultStockPercentage;
                DataManager.saveInvestments({
                    allocation,
                    stockPercentage,
                    cryptoPercentage: 100 - stockPercentage,
                    stockReturn: CONFIG.investments.defaultStockReturn,
                    cryptoReturn: CONFIG.investments.defaultCryptoReturn
                });
                break;
        }
    },

    /**
     * Complete setup wizard
     */
    completeSetup() {
        DataManager.setSetupComplete(true);
        this.isSetupComplete = true;

        // Reinitialize managers with new data
        TransactionsManager.init();
        BudgetManager.init();
        InvestmentsManager.init();

        this.showApp();
        this.showToast('Setup complete! Welcome to ' + CONFIG.app.name, 'success');
    },

    /**
     * Open modal
     */
    openModal(modalId, data = null) {
        ModalsManager.open(modalId, data);
    },

    /**
     * Close modal
     */
    closeModal() {
        ModalsManager.close();
    },

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer') || this.createToastContainer();

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span>${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
        `;

        container.appendChild(toast);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    },

    /**
     * Create toast container
     */
    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
        return container;
    },

    /**
     * Handle user sign in
     */
    onUserSignedIn(user) {
        const notSignedIn = document.getElementById('notSignedIn');
        const signedIn = document.getElementById('signedIn');
        const userName = document.getElementById('userName');
        const userEmail = document.getElementById('userEmail');
        const userAvatar = document.getElementById('userAvatar');

        if (notSignedIn) notSignedIn.style.display = 'none';
        if (signedIn) signedIn.style.display = 'block';
        if (userName) userName.textContent = user.displayName || 'User';
        if (userEmail) userEmail.textContent = user.email;
        if (userAvatar) userAvatar.src = user.photoURL || 'images/default-avatar.png';

        this.updateSyncStatus();
        this.showToast('Signed in successfully', 'success');
    },

    /**
     * Handle user sign out
     */
    onUserSignedOut() {
        const notSignedIn = document.getElementById('notSignedIn');
        const signedIn = document.getElementById('signedIn');

        if (notSignedIn) notSignedIn.style.display = 'block';
        if (signedIn) signedIn.style.display = 'none';

        this.showToast('Signed out', 'info');
    },

    /**
     * Handle Google authorization
     */
    onGoogleAuthorized() {
        const notAuth = document.getElementById('sheetsNotAuthorized');
        const auth = document.getElementById('sheetsAuthorized');

        if (notAuth) notAuth.style.display = 'none';
        if (auth) auth.style.display = 'block';

        this.showToast('Google Sheets connected', 'success');
    },

    /**
     * Sign in with Google
     */
    async signInWithGoogle() {
        const result = await FirebaseService.signInWithGoogle();
        if (!result.success) {
            this.showToast('Sign in failed: ' + result.error, 'error');
        }
    },

    /**
     * Sign out
     */
    async signOut() {
        await FirebaseService.signOut();
    },

    /**
     * Sync to cloud
     */
    async syncToCloud() {
        this.showLoading();
        const result = await FirebaseService.syncToCloud();
        this.hideLoading();

        if (result.success) {
            this.updateSyncStatus();
            this.showToast('Synced to cloud', 'success');
        } else {
            this.showToast('Sync failed: ' + result.error, 'error');
        }
    },

    /**
     * Sync from cloud
     */
    async syncFromCloud() {
        this.showLoading();
        const result = await FirebaseService.syncFromCloud();
        this.hideLoading();

        if (result.success) {
            this.reload();
            this.showToast('Restored from cloud', 'success');
        } else {
            this.showToast('Restore failed: ' + result.error, 'error');
        }
    },

    /**
     * Export to Google Sheets
     */
    async exportToSheets() {
        this.showLoading();
        const result = await GoogleAPIService.exportAll();
        this.hideLoading();

        if (result.success) {
            this.showToast('Exported to Google Sheets', 'success');
            window.open(`https://docs.google.com/spreadsheets/d/${result.spreadsheetId}`, '_blank');
        } else {
            this.showToast('Export failed: ' + result.error, 'error');
        }
    },

    /**
     * Update sync status
     */
    updateSyncStatus() {
        const lastSync = FirebaseService.getLastSync();
        const display = document.getElementById('lastSyncTime');

        if (display) {
            if (lastSync) {
                const date = new Date(lastSync);
                display.textContent = date.toLocaleString();
            } else {
                display.textContent = 'Never';
            }
        }
    },

    /**
     * Setup auto-sync
     */
    setupAutoSync() {
        // Auto-sync every 5 minutes if signed in
        setInterval(() => {
            if (FirebaseService.isSignedIn()) {
                FirebaseService.syncToCloud();
            }
        }, 5 * 60 * 1000);
    },

    /**
     * Reload application
     */
    reload() {
        window.location.reload();
    },

    /**
     * Debounce utility
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Register service worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Use relative path for GitHub Pages compatibility
        const swPath = './sw.js';
        navigator.serviceWorker.register(swPath)
            .then(registration => {
                console.log('ServiceWorker registered:', registration.scope);
            })
            .catch(error => {
                console.warn('ServiceWorker registration failed (app will work without offline support):', error);
            });
    });
}
