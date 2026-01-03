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

            // Initialize Google API
            await GoogleAPIService.init();

            // Initialize managers
            TransactionsManager.init();
            BudgetManager.init();
            InvestmentsManager.init();
            UtilitiesManager.init();
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
            transactionForm.addEventListener('submit', (e) => TransactionsManager.handleSubmit(e));
        }

        // Type selector - update categories
        const typeSelect = document.getElementById('transactionType');
        if (typeSelect) {
            typeSelect.addEventListener('change', (e) => {
                this.updateCategories(e.target.value);
            });
            // Initialize with default type
            this.updateCategories(typeSelect.value);
        }

        // Set default date to today
        const dateInput = document.getElementById('transactionDate');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        // Filter events
        const filterType = document.getElementById('filterType');
        const filterCategory = document.getElementById('filterCategory');
        const filterCurrency = document.getElementById('filterCurrency');
        const searchInput = document.getElementById('searchTransactions');

        if (filterType) {
            filterType.addEventListener('change', (e) => TransactionsManager.setFilter('type', e.target.value));
        }
        if (filterCategory) {
            filterCategory.addEventListener('change', (e) => TransactionsManager.setFilter('category', e.target.value));
        }
        if (filterCurrency) {
            filterCurrency.addEventListener('change', (e) => TransactionsManager.setFilter('currency', e.target.value));
        }
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce((e) => {
                TransactionsManager.setFilter('search', e.target.value);
            }, 300));
        }

        // Manual exchange rate update
        const rateForm = document.getElementById('exchangeRateForm');
        if (rateForm) {
            rateForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const rateInput = document.getElementById('exchangeRateInput');
                if (rateInput) {
                    ExchangeRateService.setRate(parseFloat(rateInput.value));
                    this.showToast('Exchange rate updated', 'success');
                }
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

        // Budget form
        const budgetForm = document.getElementById('budgetForm');
        if (budgetForm) {
            budgetForm.addEventListener('submit', (e) => BudgetManager.handleSubmit(e));
        }

        // Investment form
        const investmentForm = document.getElementById('investmentForm');
        if (investmentForm) {
            investmentForm.addEventListener('submit', (e) => InvestmentsManager.handleSubmit(e));
        }

        // Electricity form
        const electricityForm = document.getElementById('electricityForm');
        if (electricityForm) {
            electricityForm.addEventListener('submit', (e) => UtilitiesManager.handleElectricitySubmit(e));
        }

        // Water form
        const waterForm = document.getElementById('waterForm');
        if (waterForm) {
            waterForm.addEventListener('submit', (e) => UtilitiesManager.handleWaterSubmit(e));
        }

        // Save utility rates
        const saveRatesBtn = document.getElementById('saveUtilityRates');
        if (saveRatesBtn) {
            saveRatesBtn.addEventListener('click', () => UtilitiesManager.saveRates());
        }

        // Cloud sync button
        const cloudSyncBtn = document.getElementById('cloudSyncBtn');
        if (cloudSyncBtn) {
            cloudSyncBtn.addEventListener('click', () => this.openModal('cloudSyncModal'));
        }

        // Settings button
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.openModal('settingsModal'));
        }

        // Sheets button
        const sheetsBtn = document.getElementById('sheetsBtn');
        if (sheetsBtn) {
            sheetsBtn.addEventListener('click', () => this.openModal('sheetsModal'));
        }

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
        if (overlay) overlay.classList.add('active');
    },

    /**
     * Hide loading overlay
     */
    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.classList.remove('active');
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
        UtilitiesManager.updateUI();
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
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('ServiceWorker registered:', registration.scope);
            })
            .catch(error => {
                console.log('ServiceWorker registration failed:', error);
            });
    });
}
