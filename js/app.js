/**
 * Hans Financial Note - Main Application
 * Core application logic and initialization
 */

// Luxon DateTime Library
const DateTime = luxon.DateTime;

const App = {
    isLoading: true,
    isSetupComplete: false,
    clockInterval: null,

    /**
     * Initialize the application
     */
    async init() {
        console.log(`${CONFIG.app.name} v${CONFIG.app.version} initializing...`);

        this.showLoading();

        try {
            // Check if setup is complete
            this.isSetupComplete = DataManager.isSetupComplete();

            // Initialize real-time clock
            this.initializeDateTime();

            // Initialize core services
            ExchangeRateService.init();

            // Initialize Firebase
            await FirebaseService.init();

            // Initialize Google API - WITH ERROR HANDLING
            try {
                await GoogleAPIService.init();
            } catch (googleError) {
                console.warn('Google API init warning (continuing without Google Sheets):', googleError);
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

            // Initialize category dropdowns
            this.initializeCategoryDropdowns();

            // Set up auto-sync
            this.setupAutoSync();

            // Update online/offline status
            this.updateConnectionStatus();

            this.hideLoading();
            console.log('App initialized successfully');

        } catch (error) {
            console.error('App initialization error:', error);
            this.hideLoading();
            this.showToast('Error initializing app', 'error');
        }
    },

    /**
     * Initialize real-time date and time display
     */
    initializeDateTime() {
        // Update immediately
        this.updateDateTime();

        // Update every second
        if (this.clockInterval) {
            clearInterval(this.clockInterval);
        }
        this.clockInterval = setInterval(() => {
            this.updateDateTime();
        }, 1000);

        // Update current year in footer
        const yearElement = document.getElementById('currentYear');
        if (yearElement) {
            yearElement.textContent = DateTime.now().year;
        }

        // Set today's date in form inputs
        this.setDefaultDates();
    },

    /**
     * Update date and time display
     */
    updateDateTime() {
        const now = DateTime.now();
        const dateTimeElement = document.getElementById('currentDateTime');

        if (dateTimeElement) {
            // Format: January 3, 2026 at 11:15:17 PM GMT+7
            const dateTimeStr = now.toFormat("MMMM d, yyyy 'at' h:mm:ss a 'GMT'ZZ");
            dateTimeElement.textContent = dateTimeStr;
        }
    },

    /**
     * Set default dates on form inputs
     */
    setDefaultDates() {
        const today = DateTime.now().toISODate();

        const dateInputs = [
            'txDate',
            'electricityCurrentDate',
            'waterCurrentDate',
            'startDateFilter',
            'endDateFilter'
        ];

        dateInputs.forEach(id => {
            const input = document.getElementById(id);
            if (input && !input.value) {
                input.value = today;
            }
        });
    },

    /**
     * Update connection status
     */
    updateConnectionStatus() {
        const statusBadge = document.getElementById('appStatusBadge');
        if (statusBadge) {
            if (navigator.onLine) {
                statusBadge.innerHTML = '<i class="fas fa-circle"></i> <span>Online</span>';
                statusBadge.className = 'badge online';
            } else {
                statusBadge.innerHTML = '<i class="fas fa-circle"></i> <span>Offline</span>';
                statusBadge.className = 'badge offline';
            }
        }

        // Listen for online/offline events
        window.addEventListener('online', () => this.handleConnectionChange(true));
        window.addEventListener('offline', () => this.handleConnectionChange(false));
    },

    /**
     * Handle connection change
     */
    handleConnectionChange(isOnline) {
        const statusBadge = document.getElementById('appStatusBadge');
        if (statusBadge) {
            if (isOnline) {
                statusBadge.innerHTML = '<i class="fas fa-circle"></i> <span>Online</span>';
                statusBadge.className = 'badge online';
                // Refresh exchange rate when coming online
                ExchangeRateService.fetchRate();
                this.showToast('Back online - syncing data', 'success');
            } else {
                statusBadge.innerHTML = '<i class="fas fa-circle"></i> <span>Offline</span>';
                statusBadge.className = 'badge offline';
                this.showToast('You are offline - data saved locally', 'warning');
            }
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

        // Add category button
        const addCategoryBtn = document.getElementById('addCategoryBtn');
        if (addCategoryBtn) {
            addCategoryBtn.addEventListener('click', () => this.addNewCategory());
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

        // Refresh rate button - uses forceRefresh for immediate update
        const refreshRateBtn = document.getElementById('refreshRateBtn');
        if (refreshRateBtn) {
            refreshRateBtn.addEventListener('click', async () => {
                refreshRateBtn.disabled = true;
                const result = await ExchangeRateService.forceRefresh();
                refreshRateBtn.disabled = false;
                if (result.success) {
                    this.showToast(`Exchange rate updated: ${ExchangeRateService.formatNumber(result.rate)} IDR/THB`, 'success');
                } else {
                    this.showToast('Failed to fetch exchange rate. Using cached rate.', 'warning');
                }
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
            editBudgetBtn.addEventListener('click', () => this.openBudgetModal());
        }

        // Investment edit button
        const editInvestmentsBtn = document.getElementById('editInvestmentsBtn');
        if (editInvestmentsBtn) {
            editInvestmentsBtn.addEventListener('click', () => this.openInvestmentModal());
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

        // Save electricity reading button
        const saveElectricityBtn = document.getElementById('saveElectricityBtn');
        if (saveElectricityBtn) {
            saveElectricityBtn.addEventListener('click', () => this.saveElectricityReading());
        }

        // Cancel electricity button
        const cancelElectricityBtn = document.getElementById('cancelElectricityBtn');
        if (cancelElectricityBtn) {
            cancelElectricityBtn.addEventListener('click', () => {
                document.getElementById('electricityCalcResult').style.display = 'none';
            });
        }

        // Save water reading button
        const saveWaterBtn = document.getElementById('saveWaterBtn');
        if (saveWaterBtn) {
            saveWaterBtn.addEventListener('click', () => this.saveWaterReading());
        }

        // Cancel water button
        const cancelWaterBtn = document.getElementById('cancelWaterBtn');
        if (cancelWaterBtn) {
            cancelWaterBtn.addEventListener('click', () => {
                document.getElementById('waterCalcResult').style.display = 'none';
            });
        }

        // Add past reading button
        const addPastReadingBtn = document.getElementById('addPastReadingBtn');
        if (addPastReadingBtn) {
            addPastReadingBtn.addEventListener('click', () => this.openPastReadingModal());
        }

        // Utility history button
        const utilityHistoryBtn = document.getElementById('utilityHistoryBtn');
        if (utilityHistoryBtn) {
            utilityHistoryBtn.addEventListener('click', () => this.showUtilityHistory());
        }

        // Utility export button
        const utilityExportBtn = document.getElementById('utilityExportBtn');
        if (utilityExportBtn) {
            utilityExportBtn.addEventListener('click', () => this.exportUtilityData());
        }

        // Sync to Sheets button (alternate ID)
        const syncToSheetsBtnAlt = document.getElementById('syncToSheetsBtn');
        if (syncToSheetsBtnAlt) {
            syncToSheetsBtnAlt.addEventListener('click', () => this.syncToGoogleSheets());
        }

        // Bank history and adjust buttons
        const bankHistoryBtn = document.getElementById('bankHistoryBtn');
        const bankAdjustBtn = document.getElementById('bankAdjustBtn');
        if (bankHistoryBtn) {
            bankHistoryBtn.addEventListener('click', () => this.showBalanceHistory('bank'));
        }
        if (bankAdjustBtn) {
            bankAdjustBtn.addEventListener('click', () => this.adjustBalance('bank'));
        }

        // Cash history and adjust buttons
        const cashHistoryBtn = document.getElementById('cashHistoryBtn');
        const cashAdjustBtn = document.getElementById('cashAdjustBtn');
        if (cashHistoryBtn) {
            cashHistoryBtn.addEventListener('click', () => this.showBalanceHistory('cash'));
        }
        if (cashAdjustBtn) {
            cashAdjustBtn.addEventListener('click', () => this.adjustBalance('cash'));
        }

        // Reset all data button
        const resetAllDataBtn = document.getElementById('resetAllDataBtn');
        if (resetAllDataBtn) {
            resetAllDataBtn.addEventListener('click', () => this.resetAllData());
        }
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
        const today = new Date().toISOString().split('T')[0];

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
            case 4: // Categories - Save categories from wizard
                const categories = DataManager.getCategories();
                DataManager.saveCategories(categories);
                break;
            case 5: // Utilities - Save as past readings
                const elecReading = parseFloat(document.getElementById('initialElectricityReading')?.value) || 0;
                const elecRate = parseFloat(document.getElementById('electricityRateSetup')?.value) || 8;
                const waterReading = parseFloat(document.getElementById('initialWaterReading')?.value) || 0;
                const waterRate = parseFloat(document.getElementById('waterRateSetup')?.value) || 20;

                DataManager.saveUtilities({
                    electricity: {
                        rate: elecRate,
                        threshold: 3,
                        readings: [],
                        pastReading: elecReading,
                        pastReadingDate: today,
                        ongoingReading: elecReading,
                        ongoingReadingDate: today
                    },
                    water: {
                        rate: waterRate,
                        readings: [],
                        pastReading: waterReading,
                        pastReadingDate: today,
                        ongoingReading: waterReading,
                        ongoingReadingDate: today
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
     * Calculate electricity estimation (does NOT add to expenses)
     */
    calculateElectricity() {
        const currentReading = parseFloat(document.getElementById('electricityCurrentReading')?.value);
        const currentDate = document.getElementById('electricityCurrentDate')?.value;

        if (isNaN(currentReading) || !currentDate) {
            this.showToast('Please enter current reading and date', 'error');
            return;
        }

        // Use UtilitiesManager to calculate estimation
        const estimation = UtilitiesManager.calculateElectricityEstimation(currentReading, currentDate);

        // Show result
        document.getElementById('electricityTotal').textContent = `${estimation.usage.toFixed(2)} kWh`;
        document.getElementById('electricityDays').textContent = `${estimation.daysBetween} days`;
        document.getElementById('electricityAverage').textContent = `${estimation.averagePerDay.toFixed(2)} kWh/day`;
        document.getElementById('electricityCostTHB').textContent = `฿ ${estimation.cost.toFixed(2)}`;
        document.getElementById('electricityCalcResult').style.display = 'block';

        // Show warning if high consumption
        const warningEl = document.getElementById('electricityWarning');
        if (warningEl && estimation.averagePerDay > estimation.threshold) {
            warningEl.style.display = 'flex';
        } else if (warningEl) {
            warningEl.style.display = 'none';
        }

        // Save as Ongoing button (does NOT add expense)
        const saveBtn = document.getElementById('saveElectricityBtn');
        if (saveBtn) {
            saveBtn.onclick = () => {
                // Update ongoing reading only (not past reading)
                UtilitiesManager.setElectricityOngoingReading(currentReading, currentDate);

                this.showToast('Ongoing reading updated (estimation only, not added to expenses)', 'success');
                document.getElementById('electricityCalcResult').style.display = 'none';
                document.getElementById('electricityCurrentReading').value = '';
            };
        }
    },

    /**
     * Calculate water estimation (does NOT add to expenses)
     */
    calculateWater() {
        const currentReading = parseFloat(document.getElementById('waterCurrentReading')?.value);
        const currentDate = document.getElementById('waterCurrentDate')?.value;

        if (isNaN(currentReading) || !currentDate) {
            this.showToast('Please enter current reading and date', 'error');
            return;
        }

        // Use UtilitiesManager to calculate estimation
        const estimation = UtilitiesManager.calculateWaterEstimation(currentReading, currentDate);

        // Show result
        document.getElementById('waterTotal').textContent = `${estimation.usage.toFixed(2)} units`;
        document.getElementById('waterDays').textContent = `${estimation.daysBetween} days`;
        document.getElementById('waterAverage').textContent = `${estimation.averagePerDay.toFixed(2)} units/day`;
        document.getElementById('waterCostTHB').textContent = `฿ ${estimation.cost.toFixed(2)}`;
        document.getElementById('waterCalcResult').style.display = 'block';

        // Save as Ongoing button (does NOT add expense)
        const saveBtn = document.getElementById('saveWaterBtn');
        if (saveBtn) {
            saveBtn.onclick = () => {
                // Update ongoing reading only (not past reading)
                UtilitiesManager.setWaterOngoingReading(currentReading, currentDate);

                this.showToast('Ongoing reading updated (estimation only, not added to expenses)', 'success');
                document.getElementById('waterCalcResult').style.display = 'none';
                document.getElementById('waterCurrentReading').value = '';
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
        // Try multiple possible element IDs for category select
        const categorySelect = document.getElementById('txCategory') ||
                              document.getElementById('transactionCategory') ||
                              document.getElementById('editCategory');
        if (!categorySelect) return;

        // If type is empty or invalid, show placeholder
        if (!type || (type !== 'income' && type !== 'expense' && type !== 'transfer')) {
            categorySelect.innerHTML = '<option value="">Select type first</option>';
            return;
        }

        const categories = DataManager.getCategories();
        const options = categories[type] || [];

        if (options.length === 0) {
            categorySelect.innerHTML = '<option value="">No categories - click + to add</option>';
            return;
        }

        // Always include placeholder option first
        categorySelect.innerHTML = '<option value="">Select Category</option>' +
            options.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    },

    /**
     * Add new category from the transaction form
     */
    addNewCategory() {
        const typeSelect = document.getElementById('txType');
        const type = typeSelect?.value;

        if (!type || (type !== 'income' && type !== 'expense' && type !== 'transfer')) {
            this.showToast('Please select a transaction type first', 'warning');
            return;
        }

        const categoryName = prompt(`Enter new ${type} category name:`);
        if (!categoryName || categoryName.trim() === '') {
            return;
        }

        const trimmedName = categoryName.trim();
        const categories = DataManager.getCategories();

        // Check if category already exists
        if (categories[type] && categories[type].includes(trimmedName)) {
            this.showToast('Category already exists', 'warning');
            return;
        }

        // Add the category
        if (!categories[type]) categories[type] = [];
        categories[type].push(trimmedName);
        DataManager.saveCategories(categories);

        // Update the dropdown and select the new category
        this.updateCategories(type);
        const categorySelect = document.getElementById('txCategory');
        if (categorySelect) {
            categorySelect.value = trimmedName;
        }

        this.showToast(`Category "${trimmedName}" added`, 'success');
    },

    /**
     * Initialize category dropdowns on page load
     */
    initializeCategoryDropdowns() {
        // Initialize main transaction form category
        const txType = document.getElementById('txType');
        const txCategory = document.getElementById('txCategory');

        if (txType && txCategory) {
            // If type is already selected, load categories for that type
            // Otherwise show "Select type first" message
            const type = txType.value;
            this.updateCategories(type);
        }

        // Also update setup wizard categories if present
        this.updateSetupWizardCategories();
    },

    /**
     * Update setup wizard category dropdowns
     */
    updateSetupWizardCategories() {
        const categories = DataManager.getCategories();

        // Setup wizard income categories
        const wizardIncomeCategory = document.getElementById('wizardIncomeCategory');
        if (wizardIncomeCategory && categories.income) {
            wizardIncomeCategory.innerHTML = categories.income.map(cat =>
                `<option value="${cat}">${cat}</option>`
            ).join('');
        }

        // Setup wizard expense categories
        const wizardExpenseCategory = document.getElementById('wizardExpenseCategory');
        if (wizardExpenseCategory && categories.expense) {
            wizardExpenseCategory.innerHTML = categories.expense.map(cat =>
                `<option value="${cat}">${cat}</option>`
            ).join('');
        }
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
        // Update settings page elements
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

        // Update wizard connection status (Step 2)
        const wizardConnectionStatus = document.getElementById('wizardConnectionStatus');
        const wizardGoogleSignInBtn = document.getElementById('wizardGoogleSignInBtn');
        const cloudConnectionCard = document.getElementById('cloudConnectionCard');

        if (wizardConnectionStatus) {
            wizardConnectionStatus.innerHTML = `
                <i class="fas fa-check-circle" style="color: var(--success);"></i>
                <span style="color: var(--success);">Connected as ${user.displayName || user.email}</span>
            `;
            wizardConnectionStatus.classList.add('connected');
        }
        if (wizardGoogleSignInBtn) {
            wizardGoogleSignInBtn.innerHTML = '<i class="fas fa-check"></i> Connected';
            wizardGoogleSignInBtn.disabled = true;
            wizardGoogleSignInBtn.classList.add('btn-success');
            wizardGoogleSignInBtn.classList.remove('btn-primary');
        }
        if (cloudConnectionCard) {
            cloudConnectionCard.classList.add('connected');
        }

        // Update main display cloud sync bar
        const cloudSyncBar = document.getElementById('cloudSyncBar');
        const syncAccountName = document.getElementById('syncAccountName');
        const syncStatusText = document.getElementById('syncStatusText');
        const syncIcon = document.getElementById('syncIcon');
        const cloudSignInBtn = document.getElementById('cloudSignInBtn');

        if (cloudSyncBar) {
            cloudSyncBar.classList.remove('not-connected');
            cloudSyncBar.classList.add('connected');
        }
        if (syncAccountName) {
            syncAccountName.textContent = user.displayName || user.email;
        }
        if (syncStatusText) {
            syncStatusText.innerHTML = `<i class="fas fa-check-circle" style="color: var(--success);"></i> Data synced to Google Drive`;
        }
        if (syncIcon) {
            syncIcon.classList.remove('fa-cloud');
            syncIcon.classList.add('fa-cloud-check');
            syncIcon.style.color = 'var(--success)';
        }
        if (cloudSignInBtn) {
            cloudSignInBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Sync Now';
            cloudSignInBtn.onclick = () => this.syncToCloud();
        }

        this.updateSyncStatus();
        this.showToast('Signed in successfully - Data will sync to Google Drive', 'success');
    },

    /**
     * Handle user sign out
     */
    onUserSignedOut() {
        // Update settings page elements
        const notSignedIn = document.getElementById('notSignedIn');
        const signedIn = document.getElementById('signedIn');

        if (notSignedIn) notSignedIn.style.display = 'block';
        if (signedIn) signedIn.style.display = 'none';

        // Reset wizard connection status
        const wizardConnectionStatus = document.getElementById('wizardConnectionStatus');
        const wizardGoogleSignInBtn = document.getElementById('wizardGoogleSignInBtn');
        const cloudConnectionCard = document.getElementById('cloudConnectionCard');

        if (wizardConnectionStatus) {
            wizardConnectionStatus.innerHTML = `
                <i class="fas fa-cloud-upload-alt"></i>
                <span>Not Connected</span>
            `;
            wizardConnectionStatus.classList.remove('connected');
        }
        if (wizardGoogleSignInBtn) {
            wizardGoogleSignInBtn.innerHTML = '<i class="fab fa-google"></i> Sign In with Google';
            wizardGoogleSignInBtn.disabled = false;
            wizardGoogleSignInBtn.classList.remove('btn-success');
            wizardGoogleSignInBtn.classList.add('btn-primary');
        }
        if (cloudConnectionCard) {
            cloudConnectionCard.classList.remove('connected');
        }

        // Reset main display cloud sync bar
        const cloudSyncBar = document.getElementById('cloudSyncBar');
        const syncAccountName = document.getElementById('syncAccountName');
        const syncStatusText = document.getElementById('syncStatusText');
        const syncIcon = document.getElementById('syncIcon');
        const cloudSignInBtn = document.getElementById('cloudSignInBtn');

        if (cloudSyncBar) {
            cloudSyncBar.classList.add('not-connected');
            cloudSyncBar.classList.remove('connected');
        }
        if (syncAccountName) {
            syncAccountName.textContent = 'Not Connected';
        }
        if (syncStatusText) {
            syncStatusText.textContent = 'Sign in to sync data across devices';
        }
        if (syncIcon) {
            syncIcon.classList.add('fa-cloud');
            syncIcon.classList.remove('fa-cloud-check');
            syncIcon.style.color = '';
        }
        if (cloudSignInBtn) {
            cloudSignInBtn.innerHTML = '<i class="fab fa-google"></i> Sign In with Google';
            cloudSignInBtn.onclick = () => this.signInWithGoogle();
        }

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
     * Save electricity reading (just saves reading, doesn't add to expenses)
     */
    saveElectricityReading() {
        const currentReading = parseFloat(document.getElementById('electricityCurrentReading')?.value);
        const currentDate = document.getElementById('electricityCurrentDate')?.value;

        if (isNaN(currentReading) || !currentDate) {
            this.showToast('Please calculate consumption first', 'error');
            return;
        }

        const utilities = DataManager.getUtilities();
        const lastReading = utilities.electricity?.lastReading || 0;
        const rate = utilities.electricity?.rate || 8;
        const usage = currentReading - lastReading;
        const cost = usage * rate;

        // Store previous reading info for display
        const previousReading = {
            reading: lastReading,
            date: utilities.electricity?.lastReadingDate || '-'
        };

        // Update utilities
        if (!utilities.electricity) utilities.electricity = {};
        utilities.electricity.lastReading = currentReading;
        utilities.electricity.lastReadingDate = currentDate;
        utilities.electricity.lastUsage = usage;
        utilities.electricity.lastCost = cost;
        if (!utilities.electricity.readings) utilities.electricity.readings = [];
        utilities.electricity.readings.unshift({
            date: currentDate,
            reading: currentReading,
            previousReading: lastReading,
            usage: usage,
            cost: cost,
            timestamp: DateTime.now().toISO()
        });
        DataManager.saveUtilities(utilities);

        // Update display to show the saved reading info
        this.updateElectricityDisplay(utilities.electricity);

        // Update UI
        UtilitiesManager.updateUI();
        document.getElementById('electricityCalcResult').style.display = 'none';
        document.getElementById('electricityCurrentReading').value = '';

        this.showToast('Electricity reading saved. Add to expenses manually if needed.', 'success');
    },

    /**
     * Update electricity display with current reading info
     */
    updateElectricityDisplay(electricity) {
        // Update last reading display - matches HTML element IDs
        const lastReadingEl = document.getElementById('electricityLastReading');
        const lastDateEl = document.getElementById('electricityLastDate');
        const lastUpdateEl = document.getElementById('electricityLastUpdate');

        if (lastReadingEl) {
            lastReadingEl.textContent = `${electricity.lastReading?.toFixed(2) || '0.00'} kWh`;
        }
        if (lastDateEl) {
            lastDateEl.textContent = `Date: ${electricity.lastReadingDate || '-'}`;
        }
        if (lastUpdateEl) {
            lastUpdateEl.textContent = electricity.lastReadingDate || '-';
        }

        // Update usage and cost display (if elements exist)
        const usageEl = document.getElementById('electricityUsage');
        const costEl = document.getElementById('electricityCost');
        if (usageEl) {
            usageEl.textContent = `${electricity.lastUsage?.toFixed(2) || '0.00'} kWh`;
        }
        if (costEl) {
            costEl.textContent = `฿${electricity.lastCost?.toFixed(2) || '0.00'}`;
        }

        // Update rate display
        const rateEl = document.getElementById('electricityRateDisplay');
        if (rateEl && electricity.rate) {
            rateEl.textContent = electricity.rate;
        }
    },

    /**
     * Save water reading (just saves reading, doesn't add to expenses)
     */
    saveWaterReading() {
        const currentReading = parseFloat(document.getElementById('waterCurrentReading')?.value);
        const currentDate = document.getElementById('waterCurrentDate')?.value;

        if (isNaN(currentReading) || !currentDate) {
            this.showToast('Please calculate consumption first', 'error');
            return;
        }

        const utilities = DataManager.getUtilities();
        const lastReading = utilities.water?.lastReading || 0;
        const rate = utilities.water?.rate || 20;
        const usage = currentReading - lastReading;
        const cost = usage * rate;

        // Update utilities
        if (!utilities.water) utilities.water = {};
        utilities.water.lastReading = currentReading;
        utilities.water.lastReadingDate = currentDate;
        utilities.water.lastUsage = usage;
        utilities.water.lastCost = cost;
        if (!utilities.water.readings) utilities.water.readings = [];
        utilities.water.readings.unshift({
            date: currentDate,
            reading: currentReading,
            previousReading: lastReading,
            usage: usage,
            cost: cost,
            timestamp: DateTime.now().toISO()
        });
        DataManager.saveUtilities(utilities);

        // Update display
        this.updateWaterDisplay(utilities.water);

        // Update UI
        UtilitiesManager.updateUI();
        document.getElementById('waterCalcResult').style.display = 'none';
        document.getElementById('waterCurrentReading').value = '';

        this.showToast('Water reading saved. Add to expenses manually if needed.', 'success');
    },

    /**
     * Update water display with current reading info
     */
    updateWaterDisplay(water) {
        // Update last reading display - matches HTML element IDs
        const lastReadingEl = document.getElementById('waterLastReading');
        const lastDateEl = document.getElementById('waterLastDate');
        const lastUpdateEl = document.getElementById('waterLastUpdate');

        if (lastReadingEl) {
            lastReadingEl.textContent = `${water.lastReading?.toFixed(2) || '0.00'} units`;
        }
        if (lastDateEl) {
            lastDateEl.textContent = `Date: ${water.lastReadingDate || '-'}`;
        }
        if (lastUpdateEl) {
            lastUpdateEl.textContent = water.lastReadingDate || '-';
        }

        // Update usage and cost display (if elements exist)
        const usageEl = document.getElementById('waterUsage');
        const costEl = document.getElementById('waterCost');
        if (usageEl) {
            usageEl.textContent = `${water.lastUsage?.toFixed(2) || '0.00'} units`;
        }
        if (costEl) {
            costEl.textContent = `฿${water.lastCost?.toFixed(2) || '0.00'}`;
        }

        // Update rate display
        const rateEl = document.getElementById('waterRateDisplay');
        if (rateEl && water.rate) {
            rateEl.textContent = water.rate;
        }
    },

    /**
     * Show utility history
     */
    showUtilityHistory() {
        const utilities = DataManager.getUtilities();
        const elecReadings = utilities.electricity?.readings || [];
        const waterReadings = utilities.water?.readings || [];

        let historyHTML = `
            <div class="utility-history-content">
                <h4><i class="fas fa-lightbulb"></i> Electricity History</h4>
                <div class="history-list">
        `;

        if (elecReadings.length === 0) {
            historyHTML += '<p class="no-data">No electricity readings recorded</p>';
        } else {
            elecReadings.slice(0, 10).forEach(r => {
                historyHTML += `
                    <div class="history-item">
                        <div class="history-date">${r.date}</div>
                        <div class="history-details">
                            <span>Reading: ${r.reading} kWh</span>
                            <span>Usage: ${r.usage?.toFixed(2) || 0} kWh</span>
                            <span>Cost: ฿${r.cost?.toFixed(2) || 0}</span>
                        </div>
                    </div>
                `;
            });
        }

        historyHTML += `
                </div>
                <h4><i class="fas fa-tint"></i> Water History</h4>
                <div class="history-list">
        `;

        if (waterReadings.length === 0) {
            historyHTML += '<p class="no-data">No water readings recorded</p>';
        } else {
            waterReadings.slice(0, 10).forEach(r => {
                historyHTML += `
                    <div class="history-item">
                        <div class="history-date">${r.date}</div>
                        <div class="history-details">
                            <span>Reading: ${r.reading} units</span>
                            <span>Usage: ${r.usage?.toFixed(2) || 0} units</span>
                            <span>Cost: ฿${r.cost?.toFixed(2) || 0}</span>
                        </div>
                    </div>
                `;
            });
        }

        historyHTML += '</div></div>';

        // Create and show modal
        this.showCustomModal('Utility History', historyHTML);
    },

    /**
     * Export utility data
     */
    exportUtilityData() {
        const utilities = DataManager.getUtilities();
        const elecReadings = utilities.electricity?.readings || [];
        const waterReadings = utilities.water?.readings || [];

        let csvContent = 'data:text/csv;charset=utf-8,';
        csvContent += 'Type,Date,Reading,Usage,Cost (THB)\n';

        elecReadings.forEach(r => {
            csvContent += `Electricity,${r.date},${r.reading},${r.usage?.toFixed(2) || 0},${r.cost?.toFixed(2) || 0}\n`;
        });

        waterReadings.forEach(r => {
            csvContent += `Water,${r.date},${r.reading},${r.usage?.toFixed(2) || 0},${r.cost?.toFixed(2) || 0}\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `utility_history_${DateTime.now().toISODate()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.showToast('Utility data exported', 'success');
    },

    /**
     * Sync to Google Sheets
     */
    async syncToGoogleSheets() {
        if (!GoogleAPIService.isAuthorized || !GoogleAPIService.isAuthorized()) {
            this.showToast('Please connect to Google first', 'warning');
            this.openModal('sheetsModal');
            return;
        }

        this.showLoading();
        try {
            const result = await GoogleAPIService.exportAll();
            if (result.success) {
                this.showToast('Data synced to Google Sheets', 'success');
                if (result.spreadsheetId) {
                    window.open(`https://docs.google.com/spreadsheets/d/${result.spreadsheetId}`, '_blank');
                }
            } else {
                this.showToast('Sync failed: ' + (result.error || 'Unknown error'), 'error');
            }
        } catch (error) {
            console.error('Sync error:', error);
            this.showToast('Failed to sync with Google Sheets', 'error');
        }
        this.hideLoading();
    },

    /**
     * Show balance history
     */
    showBalanceHistory(type) {
        const transactions = DataManager.getTransactions();
        const filtered = transactions.filter(t => t.paymentMethod === type).slice(0, 20);

        let historyHTML = `<div class="balance-history-content">`;

        if (filtered.length === 0) {
            historyHTML += '<p class="no-data">No transactions found for this account</p>';
        } else {
            historyHTML += '<div class="history-list">';
            filtered.forEach(t => {
                const amountClass = t.type === 'income' ? 'income' : t.type === 'expense' ? 'expense' : 'transfer';
                const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '-' : '';
                historyHTML += `
                    <div class="history-item">
                        <div class="history-date">${t.date}</div>
                        <div class="history-description">${t.description || t.category}</div>
                        <div class="history-amount ${amountClass}">${sign}฿${ExchangeRateService.formatNumber(t.amount)}</div>
                    </div>
                `;
            });
            historyHTML += '</div>';
        }

        historyHTML += '</div>';

        const title = type === 'bank' ? 'Bank Account History' : 'Cash Wallet History';
        this.showCustomModal(title, historyHTML);
    },

    /**
     * Adjust balance
     */
    adjustBalance(type) {
        const balances = DataManager.getBalances();
        const currentValue = type === 'bank' ? (balances.bank || 0) : (balances.cash || 0);

        const reason = prompt('Reason for adjustment (e.g., Bank reconciliation, Cash count):');
        if (reason === null) return;

        const newValue = prompt(`Enter new ${type} balance (THB):`, currentValue);
        if (newValue === null || isNaN(parseFloat(newValue))) return;

        const adjustment = parseFloat(newValue) - currentValue;

        // Update balance
        if (type === 'bank') {
            balances.bank = parseFloat(newValue);
        } else {
            balances.cash = parseFloat(newValue);
        }
        balances.thb = (balances.bank || 0) + (balances.cash || 0);
        DataManager.saveBalances(balances);

        // Record adjustment as transaction
        if (adjustment !== 0) {
            TransactionsManager.add({
                date: DateTime.now().toISODate(),
                amount: Math.abs(adjustment),
                type: adjustment > 0 ? 'income' : 'expense',
                category: 'Balance Adjustment',
                description: `${reason || 'Balance adjustment'} (${type})`,
                currency: 'THB',
                paymentMethod: type
            });
        }

        this.updateBalanceDisplay();
        this.showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} balance adjusted`, 'success');
    },

    /**
     * Show custom modal with content
     */
    showCustomModal(title, content) {
        // Remove existing custom modal if any
        const existing = document.getElementById('customModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'customModal';
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" onclick="document.getElementById('customModal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    },

    /**
     * Reset all data and start over
     */
    resetAllData() {
        if (!confirm('Are you sure you want to DELETE ALL DATA?\n\nThis will:\n- Delete all transactions\n- Delete all balances\n- Delete all settings\n- Reset the app to initial setup\n\nThis action CANNOT be undone!')) {
            return;
        }

        if (!confirm('FINAL WARNING: All your financial data will be permanently deleted. Continue?')) {
            return;
        }

        // Clear all storage
        StorageService.clearAll();

        // Show toast and reload
        this.showToast('All data deleted. Restarting...', 'info');
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    },

    /**
     * Open budget configuration modal
     */
    openBudgetModal() {
        const budget = DataManager.getBudget();
        const transactions = DataManager.getTransactions();
        const rate = ExchangeRateService.getRate();
        const categories = DataManager.getCategories();
        const categoryBudgets = budget.categoryBudgets || {};

        // Calculate category spending
        const now = DateTime.now();
        const currentMonth = now.month;
        const currentYear = now.year;

        const categorySpending = {};
        transactions.filter(t => {
            if (t.type !== 'expense') return false;
            const tDate = DateTime.fromISO(t.date);
            return tDate.month === currentMonth && tDate.year === currentYear;
        }).forEach(t => {
            const cat = t.category || 'Other';
            if (!categorySpending[cat]) categorySpending[cat] = 0;
            categorySpending[cat] += parseFloat(t.amount) || 0;
        });

        const totalSpent = Object.values(categorySpending).reduce((a, b) => a + b, 0);
        const monthlyBudget = budget.monthlyBudget || 50000;

        let content = `
            <form id="budgetConfigForm">
                <div class="form-group">
                    <label class="form-label">Annual Income (THB)</label>
                    <div class="input-with-icon">
                        <input type="number" class="form-control" id="budgetAnnualIncome" value="${budget.annualIncome || 600000}" step="1000">
                        <span class="input-icon">฿</span>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Monthly Budget (THB)</label>
                    <div class="input-with-icon">
                        <input type="number" class="form-control" id="budgetMonthlyBudget" value="${monthlyBudget}" step="100">
                        <span class="input-icon">฿</span>
                    </div>
                </div>
            </form>

            <div class="section-divider"></div>

            <h4><i class="fas fa-wallet"></i> Budget Per Category (Monthly)</h4>
            <div class="category-budget-settings">
        `;

        // Generate budget inputs for each expense category
        (categories.expense || []).forEach(cat => {
            const catBudget = categoryBudgets[cat] || 0;
            content += `
                <div class="category-budget-row">
                    <label>${cat}</label>
                    <div class="input-with-icon">
                        <input type="number" class="form-control category-budget-input"
                               data-category="${cat}" value="${catBudget}" step="100" placeholder="No limit">
                        <span class="input-icon">฿</span>
                    </div>
                </div>
            `;
        });

        content += `
            </div>

            <div class="section-divider"></div>

            <h4><i class="fas fa-chart-pie"></i> Category Spending This Month</h4>
            <div class="category-breakdown">
        `;

        let hasOverspending = false;

        if (Object.keys(categorySpending).length === 0) {
            content += '<p class="no-data">No expenses recorded this month</p>';
        } else {
            // Sort by amount descending
            const sortedCategories = Object.entries(categorySpending).sort((a, b) => b[1] - a[1]);

            sortedCategories.forEach(([cat, amount]) => {
                const catBudget = categoryBudgets[cat] || 0;
                const idrAmount = amount * rate;
                let percentage = 0;
                let isOverBudget = false;
                let progressClass = 'progress-good';

                if (catBudget > 0) {
                    percentage = (amount / catBudget) * 100;
                    isOverBudget = amount > catBudget;
                    if (percentage >= 100) {
                        progressClass = 'progress-danger';
                        hasOverspending = true;
                    } else if (percentage >= 80) {
                        progressClass = 'progress-warning';
                    }
                } else {
                    // Use overall budget percentage if no category budget
                    percentage = monthlyBudget > 0 ? (amount / monthlyBudget) * 100 : 0;
                }

                const statusBadge = isOverBudget ?
                    '<span class="badge badge-danger"><i class="fas fa-exclamation-triangle"></i> Over Budget!</span>' :
                    (catBudget > 0 ? `<span class="badge">${percentage.toFixed(1)}% used</span>` : '');

                content += `
                    <div class="category-item ${isOverBudget ? 'over-budget' : ''}">
                        <div class="category-info">
                            <span class="category-name">${cat}</span>
                            ${statusBadge}
                        </div>
                        <div class="category-amounts">
                            <span class="amount-thb ${isOverBudget ? 'danger' : ''}">฿${ExchangeRateService.formatNumber(amount)}</span>
                            ${catBudget > 0 ? `<span class="budget-limit">/ ฿${ExchangeRateService.formatNumber(catBudget)}</span>` : ''}
                        </div>
                        <div class="category-amounts-secondary">
                            <span class="amount-idr">≈ Rp ${ExchangeRateService.formatNumber(idrAmount)}</span>
                        </div>
                        <div class="category-bar">
                            <div class="category-bar-fill ${progressClass}" style="width: ${Math.min(percentage, 100)}%"></div>
                        </div>
                    </div>
                `;
            });
        }

        content += `
            </div>
        `;

        // Show overspending alert if any
        if (hasOverspending) {
            content += `
                <div class="warning-alert">
                    <i class="fas fa-exclamation-triangle"></i>
                    <div>
                        <div class="alert-title">Budget Alert!</div>
                        <div class="alert-text">You have exceeded budget limits in some categories. Consider reducing expenses.</div>
                    </div>
                </div>
            `;
        }

        content += `
            <div class="section-divider"></div>

            <div class="budget-summary-modal">
                <div class="summary-item">
                    <span>Total Spent</span>
                    <span class="expense">฿${ExchangeRateService.formatNumber(totalSpent)}</span>
                </div>
                <div class="summary-item">
                    <span>Monthly Budget</span>
                    <span>฿${ExchangeRateService.formatNumber(monthlyBudget)}</span>
                </div>
                <div class="summary-item">
                    <span>Remaining</span>
                    <span class="${monthlyBudget - totalSpent >= 0 ? 'success' : 'danger'}">฿${ExchangeRateService.formatNumber(monthlyBudget - totalSpent)}</span>
                </div>
            </div>

            <div class="modal-actions">
                <button type="button" class="btn btn-primary" onclick="App.saveBudgetConfig()">
                    <i class="fas fa-save"></i> Save Settings
                </button>
                <button type="button" class="btn btn-outline" onclick="document.getElementById('customModal').remove()">
                    Cancel
                </button>
            </div>
        `;

        this.showCustomModal('<i class="fas fa-cog"></i> Budget Configuration', content);
    },

    /**
     * Save budget configuration
     */
    saveBudgetConfig() {
        const annualIncome = parseFloat(document.getElementById('budgetAnnualIncome')?.value) || 600000;
        const monthlyBudget = parseFloat(document.getElementById('budgetMonthlyBudget')?.value) || 50000;

        // Collect category budgets
        const categoryBudgets = {};
        document.querySelectorAll('.category-budget-input').forEach(input => {
            const category = input.dataset.category;
            const value = parseFloat(input.value) || 0;
            if (category && value > 0) {
                categoryBudgets[category] = value;
            }
        });

        const budget = DataManager.getBudget();
        budget.annualIncome = annualIncome;
        budget.monthlyBudget = monthlyBudget;
        budget.categoryBudgets = categoryBudgets;
        DataManager.saveBudget(budget);

        BudgetManager.init();

        // Close modal
        const modal = document.getElementById('customModal');
        if (modal) modal.remove();

        this.showToast('Budget settings saved', 'success');
    },

    /**
     * Open investment configuration modal
     */
    openInvestmentModal() {
        const investments = DataManager.getInvestments();
        const budget = DataManager.getBudget();
        const annualIncome = budget.annualIncome || 600000;
        const monthlyIncome = annualIncome / 12;
        const rate = ExchangeRateService.getRate();

        const allocation = investments.allocation || 20;
        const stockPercentage = investments.stockPercentage || 70;
        const cryptoPercentage = investments.cryptoPercentage || 30;
        const stockReturn = investments.stockReturn || 1.5;
        const cryptoReturn = investments.cryptoReturn || 3.0;

        // Get manual investment amounts if set
        const stockManualAmount = investments.stockManualAmount || 0;
        const cryptoManualAmount = investments.cryptoManualAmount || 0;
        const totalManualInvestment = stockManualAmount + cryptoManualAmount;

        // Calculate percentage of annual income
        const totalInvestmentVsAnnual = totalManualInvestment > 0
            ? ((totalManualInvestment * 12) / annualIncome * 100).toFixed(1)
            : (allocation).toFixed(1);

        const monthlyInvestment = totalManualInvestment > 0
            ? totalManualInvestment
            : (monthlyIncome * allocation) / 100;
        const stockAmount = totalManualInvestment > 0
            ? stockManualAmount
            : (monthlyInvestment * stockPercentage) / 100;
        const cryptoAmount = totalManualInvestment > 0
            ? cryptoManualAmount
            : (monthlyInvestment * cryptoPercentage) / 100;
        const expectedMonthlyReturn = (stockAmount * stockReturn / 100) + (cryptoAmount * cryptoReturn / 100);
        const expectedAnnualReturn = expectedMonthlyReturn * 12;

        let content = `
            <form id="investmentConfigForm">
                <div class="info-box" style="background: linear-gradient(135deg, rgba(30, 64, 175, 0.1), rgba(59, 130, 246, 0.1)); padding: 12px; border-radius: 8px; margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span><i class="fas fa-info-circle"></i> Annual Income</span>
                        <strong>฿${ExchangeRateService.formatNumber(annualIncome)}</strong>
                    </div>
                </div>

                <h4 style="margin-bottom: 15px;"><i class="fas fa-hand-holding-usd"></i> Manual Investment Amount</h4>
                <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 15px;">Enter your actual investment amounts (THB per month):</p>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label"><i class="fas fa-chart-bar"></i> Stock Market (THB/mo)</label>
                        <div class="input-with-icon">
                            <input type="number" class="form-control" id="investStockAmount" value="${stockManualAmount}" min="0" step="100" placeholder="0" onchange="App.updateInvestmentSummary()">
                            <span class="input-icon">฿</span>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label"><i class="fab fa-bitcoin"></i> Crypto (THB/mo)</label>
                        <div class="input-with-icon">
                            <input type="number" class="form-control" id="investCryptoAmount" value="${cryptoManualAmount}" min="0" step="100" placeholder="0" onchange="App.updateInvestmentSummary()">
                            <span class="input-icon">฿</span>
                        </div>
                    </div>
                </div>

                <div class="section-divider" style="margin: 20px 0;"></div>

                <h4 style="margin-bottom: 15px;"><i class="fas fa-percentage"></i> OR Use Percentage of Income</h4>
                <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 15px;">Set investment as percentage (will be ignored if manual amounts are set):</p>

                <div class="form-group">
                    <label class="form-label">Investment Allocation (% of monthly income)</label>
                    <div class="input-with-icon">
                        <input type="number" class="form-control" id="investAllocation" value="${allocation}" min="0" max="100" step="1" onchange="App.updateInvestmentSummary()">
                        <span class="input-icon">%</span>
                    </div>
                    <small class="form-hint">If manual amounts above are 0, this will be used</small>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Stock Split (%)</label>
                        <input type="number" class="form-control" id="investStockPercent" value="${stockPercentage}" min="0" max="100" step="1">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Crypto Split (%)</label>
                        <input type="number" class="form-control" id="investCryptoPercent" value="${cryptoPercentage}" min="0" max="100" step="1">
                    </div>
                </div>

                <div class="section-divider" style="margin: 20px 0;"></div>

                <h4 style="margin-bottom: 15px;"><i class="fas fa-chart-line"></i> Expected Returns</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Stock Expected Return (%/mo)</label>
                        <input type="number" class="form-control" id="investStockReturn" value="${stockReturn}" min="0" max="100" step="0.1" onchange="App.updateInvestmentSummary()">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Crypto Expected Return (%/mo)</label>
                        <input type="number" class="form-control" id="investCryptoReturn" value="${cryptoReturn}" min="0" max="100" step="0.1" onchange="App.updateInvestmentSummary()">
                    </div>
                </div>
            </form>

            <div class="section-divider" style="margin: 20px 0;"></div>

            <h4><i class="fas fa-chart-pie"></i> Investment Summary</h4>
            <div class="investment-summary-modal" id="investmentSummaryDisplay">
                <div class="summary-row">
                    <span>Total Monthly Investment</span>
                    <span id="summaryTotalInvestment">฿${ExchangeRateService.formatNumber(monthlyInvestment)}/mo</span>
                </div>
                <div class="summary-row highlight" style="background: linear-gradient(135deg, rgba(30, 64, 175, 0.1), rgba(59, 130, 246, 0.1));">
                    <span><strong>% of Annual Income</strong></span>
                    <span id="summaryPercentOfIncome" style="color: var(--primary-blue); font-weight: bold;">${totalInvestmentVsAnnual}%</span>
                </div>
                <div class="summary-row">
                    <span>Stock Market Investment</span>
                    <span id="summaryStockAmount">฿${ExchangeRateService.formatNumber(stockAmount)}/mo</span>
                </div>
                <div class="summary-row">
                    <span>Crypto Investment</span>
                    <span id="summaryCryptoAmount">฿${ExchangeRateService.formatNumber(cryptoAmount)}/mo</span>
                </div>
                <div class="summary-row highlight">
                    <span>Expected Monthly Return</span>
                    <span id="summaryMonthlyReturn" class="success">+฿${ExchangeRateService.formatNumber(expectedMonthlyReturn)}</span>
                </div>
                <div class="summary-row highlight">
                    <span>Expected Annual Return</span>
                    <span id="summaryAnnualReturn" class="success">+฿${ExchangeRateService.formatNumber(expectedAnnualReturn)}</span>
                </div>
            </div>

            <div class="modal-actions">
                <button type="button" class="btn btn-primary" onclick="App.saveInvestmentConfig()">Save Settings</button>
            </div>
        `;

        this.showCustomModal('<i class="fas fa-chart-line"></i> Investment Portfolio Settings', content);
    },

    /**
     * Update investment summary in real-time
     */
    updateInvestmentSummary() {
        const budget = DataManager.getBudget();
        const annualIncome = budget.annualIncome || 600000;
        const monthlyIncome = annualIncome / 12;

        // Get values from form
        const stockManualAmount = parseFloat(document.getElementById('investStockAmount')?.value) || 0;
        const cryptoManualAmount = parseFloat(document.getElementById('investCryptoAmount')?.value) || 0;
        const allocation = parseFloat(document.getElementById('investAllocation')?.value) || 0;
        const stockPercentage = parseFloat(document.getElementById('investStockPercent')?.value) || 70;
        const cryptoPercentage = parseFloat(document.getElementById('investCryptoPercent')?.value) || 30;
        const stockReturn = parseFloat(document.getElementById('investStockReturn')?.value) || 0;
        const cryptoReturn = parseFloat(document.getElementById('investCryptoReturn')?.value) || 0;

        // Calculate based on manual or percentage
        const totalManualInvestment = stockManualAmount + cryptoManualAmount;
        const monthlyInvestment = totalManualInvestment > 0
            ? totalManualInvestment
            : (monthlyIncome * allocation) / 100;
        const stockAmount = totalManualInvestment > 0
            ? stockManualAmount
            : (monthlyInvestment * stockPercentage) / 100;
        const cryptoAmount = totalManualInvestment > 0
            ? cryptoManualAmount
            : (monthlyInvestment * cryptoPercentage) / 100;

        // Calculate percentage of annual income
        const totalInvestmentVsAnnual = ((monthlyInvestment * 12) / annualIncome * 100).toFixed(1);

        // Calculate returns
        const expectedMonthlyReturn = (stockAmount * stockReturn / 100) + (cryptoAmount * cryptoReturn / 100);
        const expectedAnnualReturn = expectedMonthlyReturn * 12;

        // Update display
        const summaryTotalInvestment = document.getElementById('summaryTotalInvestment');
        const summaryPercentOfIncome = document.getElementById('summaryPercentOfIncome');
        const summaryStockAmount = document.getElementById('summaryStockAmount');
        const summaryCryptoAmount = document.getElementById('summaryCryptoAmount');
        const summaryMonthlyReturn = document.getElementById('summaryMonthlyReturn');
        const summaryAnnualReturn = document.getElementById('summaryAnnualReturn');

        if (summaryTotalInvestment) summaryTotalInvestment.textContent = `฿${ExchangeRateService.formatNumber(monthlyInvestment)}/mo`;
        if (summaryPercentOfIncome) summaryPercentOfIncome.textContent = `${totalInvestmentVsAnnual}%`;
        if (summaryStockAmount) summaryStockAmount.textContent = `฿${ExchangeRateService.formatNumber(stockAmount)}/mo`;
        if (summaryCryptoAmount) summaryCryptoAmount.textContent = `฿${ExchangeRateService.formatNumber(cryptoAmount)}/mo`;
        if (summaryMonthlyReturn) summaryMonthlyReturn.textContent = `+฿${ExchangeRateService.formatNumber(expectedMonthlyReturn)}`;
        if (summaryAnnualReturn) summaryAnnualReturn.textContent = `+฿${ExchangeRateService.formatNumber(expectedAnnualReturn)}`;
    },

    /**
     * Save investment configuration
     */
    saveInvestmentConfig() {
        const allocation = parseFloat(document.getElementById('investAllocation')?.value) || 20;
        const stockPercentage = parseFloat(document.getElementById('investStockPercent')?.value) || 70;
        const cryptoPercentage = parseFloat(document.getElementById('investCryptoPercent')?.value) || 30;
        const stockReturn = parseFloat(document.getElementById('investStockReturn')?.value) || 1.5;
        const cryptoReturn = parseFloat(document.getElementById('investCryptoReturn')?.value) || 3.0;
        const stockManualAmount = parseFloat(document.getElementById('investStockAmount')?.value) || 0;
        const cryptoManualAmount = parseFloat(document.getElementById('investCryptoAmount')?.value) || 0;

        const investments = {
            allocation,
            stockPercentage,
            cryptoPercentage,
            stockReturn,
            cryptoReturn,
            stockManualAmount,
            cryptoManualAmount
        };

        DataManager.saveInvestments(investments);
        InvestmentsManager.init();

        // Close modal
        const modal = document.getElementById('customModal');
        if (modal) modal.remove();

        this.showToast('Investment settings saved', 'success');
    },

    /**
     * Open past reading modal for utilities
     */
    openPastReadingModal() {
        const utilities = DataManager.getUtilities();

        let content = `
            <div class="past-reading-tabs">
                <button class="past-reading-tab active" data-type="electricity" onclick="App.switchPastReadingTab('electricity')">
                    <i class="fas fa-lightbulb"></i> Electricity
                </button>
                <button class="past-reading-tab" data-type="water" onclick="App.switchPastReadingTab('water')">
                    <i class="fas fa-tint"></i> Water
                </button>
            </div>

            <div id="electricityPastReading" class="past-reading-form">
                <div class="form-group">
                    <label class="form-label"><i class="far fa-calendar"></i> Reading Date</label>
                    <input type="date" class="form-control" id="pastElecDate" value="${DateTime.now().toISODate()}">
                </div>
                <div class="form-group">
                    <label class="form-label"><i class="fas fa-tachometer-alt"></i> Meter Reading (kWh)</label>
                    <input type="number" class="form-control" id="pastElecReading" placeholder="Enter meter reading" step="0.01">
                </div>
                <div class="form-group">
                    <label class="form-label"><i class="fas fa-bolt"></i> Usage (kWh) - Optional</label>
                    <input type="number" class="form-control" id="pastElecUsage" placeholder="Leave blank to auto-calculate" step="0.01">
                    <div class="input-hint">If blank, usage will be calculated from last reading</div>
                </div>
                <div class="form-group">
                    <label class="form-label"><i class="fas fa-money-bill"></i> Cost (THB) - Optional</label>
                    <input type="number" class="form-control" id="pastElecCost" placeholder="Leave blank to auto-calculate" step="0.01">
                    <div class="input-hint">Rate: ฿${utilities.electricity?.rate || 8}/kWh</div>
                </div>
            </div>

            <div id="waterPastReading" class="past-reading-form" style="display: none;">
                <div class="form-group">
                    <label class="form-label"><i class="far fa-calendar"></i> Reading Date</label>
                    <input type="date" class="form-control" id="pastWaterDate" value="${DateTime.now().toISODate()}">
                </div>
                <div class="form-group">
                    <label class="form-label"><i class="fas fa-tachometer-alt"></i> Meter Reading (units)</label>
                    <input type="number" class="form-control" id="pastWaterReading" placeholder="Enter meter reading" step="0.01">
                </div>
                <div class="form-group">
                    <label class="form-label"><i class="fas fa-tint"></i> Usage (units) - Optional</label>
                    <input type="number" class="form-control" id="pastWaterUsage" placeholder="Leave blank to auto-calculate" step="0.01">
                    <div class="input-hint">If blank, usage will be calculated from last reading</div>
                </div>
                <div class="form-group">
                    <label class="form-label"><i class="fas fa-money-bill"></i> Cost (THB) - Optional</label>
                    <input type="number" class="form-control" id="pastWaterCost" placeholder="Leave blank to auto-calculate" step="0.01">
                    <div class="input-hint">Rate: ฿${utilities.water?.rate || 20}/unit</div>
                </div>
            </div>

            <div class="modal-actions">
                <button type="button" class="btn btn-primary" onclick="App.savePastReading()">
                    <i class="fas fa-save"></i> Save Reading
                </button>
                <button type="button" class="btn btn-outline" onclick="document.getElementById('customModal').remove()">
                    Cancel
                </button>
            </div>
        `;

        this.showCustomModal('<i class="fas fa-plus-circle"></i> Add Past Reading', content);
        this.currentPastReadingType = 'electricity';
    },

    /**
     * Switch past reading tab
     */
    switchPastReadingTab(type) {
        this.currentPastReadingType = type;

        // Update tabs
        document.querySelectorAll('.past-reading-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.type === type);
        });

        // Show/hide forms
        document.getElementById('electricityPastReading').style.display = type === 'electricity' ? 'block' : 'none';
        document.getElementById('waterPastReading').style.display = type === 'water' ? 'block' : 'none';
    },

    /**
     * Save past reading
     */
    savePastReading() {
        const type = this.currentPastReadingType || 'electricity';
        const utilities = DataManager.getUtilities();

        if (type === 'electricity') {
            const date = document.getElementById('pastElecDate')?.value;
            const reading = parseFloat(document.getElementById('pastElecReading')?.value);
            let usage = parseFloat(document.getElementById('pastElecUsage')?.value);
            let cost = parseFloat(document.getElementById('pastElecCost')?.value);

            if (!date || isNaN(reading)) {
                this.showToast('Please enter date and meter reading', 'error');
                return;
            }

            // Auto-calculate usage if not provided
            if (isNaN(usage)) {
                const lastReading = utilities.electricity?.lastReading || 0;
                usage = reading - lastReading;
            }

            // Auto-calculate cost if not provided
            if (isNaN(cost)) {
                const rate = utilities.electricity?.rate || 8;
                cost = usage * rate;
            }

            // Add reading
            if (!utilities.electricity) utilities.electricity = {};
            if (!utilities.electricity.readings) utilities.electricity.readings = [];
            utilities.electricity.readings.unshift({
                date,
                reading,
                usage,
                cost,
                timestamp: DateTime.now().toISO()
            });
            utilities.electricity.lastReading = reading;
            utilities.electricity.lastReadingDate = date;
            utilities.electricity.lastUsage = usage;
            utilities.electricity.lastCost = cost;
            DataManager.saveUtilities(utilities);

            // Update display
            this.updateElectricityDisplay(utilities.electricity);

            // Note: No longer auto-adding to expenses - user can add manually

        } else {
            const date = document.getElementById('pastWaterDate')?.value;
            const reading = parseFloat(document.getElementById('pastWaterReading')?.value);
            let usage = parseFloat(document.getElementById('pastWaterUsage')?.value);
            let cost = parseFloat(document.getElementById('pastWaterCost')?.value);

            if (!date || isNaN(reading)) {
                this.showToast('Please enter date and meter reading', 'error');
                return;
            }

            // Auto-calculate usage if not provided
            if (isNaN(usage)) {
                const lastReading = utilities.water?.lastReading || 0;
                usage = reading - lastReading;
            }

            // Auto-calculate cost if not provided
            if (isNaN(cost)) {
                const rate = utilities.water?.rate || 20;
                cost = usage * rate;
            }

            // Add reading
            if (!utilities.water) utilities.water = {};
            if (!utilities.water.readings) utilities.water.readings = [];
            utilities.water.readings.unshift({
                date,
                reading,
                usage,
                cost,
                timestamp: DateTime.now().toISO()
            });
            utilities.water.lastReading = reading;
            utilities.water.lastReadingDate = date;
            utilities.water.lastUsage = usage;
            utilities.water.lastCost = cost;
            DataManager.saveUtilities(utilities);

            // Update display
            this.updateWaterDisplay(utilities.water);

            // Note: No longer auto-adding to expenses - user can add manually
        }

        // Update UI
        UtilitiesManager.updateUI();

        // Close modal
        const modal = document.getElementById('customModal');
        if (modal) modal.remove();

        this.showToast('Past reading saved successfully', 'success');
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
