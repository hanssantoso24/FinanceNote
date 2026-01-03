/**
 * Hans Financial Note - Modals Module
 * Handles modal dialogs and popups
 */

const ModalsManager = {
    activeModal: null,

    /**
     * Initialize modals
     */
    init() {
        this.createModalContainer();
        this.bindEvents();
    },

    /**
     * Create modal container and inject modal HTML
     */
    createModalContainer() {
        const container = document.getElementById('modalsContainer');
        if (!container) return;

        container.innerHTML = `
            <!-- Edit Transaction Modal -->
            <div id="editTransactionModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Edit Transaction</h3>
                        <button class="modal-close" onclick="ModalsManager.close()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="editTransactionForm">
                            <input type="hidden" id="editTransactionId">
                            <div class="form-group">
                                <label for="editDate">Date</label>
                                <input type="date" id="editDate" required>
                            </div>
                            <div class="form-group">
                                <label for="editType">Type</label>
                                <select id="editType" required>
                                    <option value="income">Income</option>
                                    <option value="expense">Expense</option>
                                    <option value="transfer">Transfer</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="editCategory">Category</label>
                                <select id="editCategory" required></select>
                            </div>
                            <div class="form-group">
                                <label for="editAmount">Amount</label>
                                <input type="number" id="editAmount" step="0.01" min="0" required>
                            </div>
                            <div class="form-group">
                                <label for="editCurrency">Currency</label>
                                <select id="editCurrency" required>
                                    <option value="THB">THB (฿)</option>
                                    <option value="IDR">IDR (Rp)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="editDescription">Description</label>
                                <input type="text" id="editDescription">
                            </div>
                            <div class="form-actions">
                                <button type="button" class="btn" onclick="ModalsManager.close()">Cancel</button>
                                <button type="submit" class="btn btn-primary">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <!-- Settings Modal -->
            <div id="settingsModal" class="modal">
                <div class="modal-content modal-large">
                    <div class="modal-header">
                        <h3>Settings</h3>
                        <button class="modal-close" onclick="ModalsManager.close()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="settings-tabs">
                            <button class="tab-btn active" data-tab="general">General</button>
                            <button class="tab-btn" data-tab="categories">Categories</button>
                            <button class="tab-btn" data-tab="backup">Backup</button>
                            <button class="tab-btn" data-tab="about">About</button>
                        </div>

                        <div class="tab-content active" id="tab-general">
                            <h4>Display Settings</h4>
                            <div class="form-group">
                                <label for="themeSetting">Theme</label>
                                <select id="themeSetting">
                                    <option value="light">Light</option>
                                    <option value="dark">Dark</option>
                                    <option value="auto">Auto (System)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>
                                    <input type="checkbox" id="autoRefreshRate" checked>
                                    Auto-refresh exchange rate
                                </label>
                            </div>
                        </div>

                        <div class="tab-content" id="tab-categories">
                            <h4>Manage Categories</h4>
                            <div class="category-manager">
                                <div class="category-type">
                                    <h5>Income Categories</h5>
                                    <ul id="incomeCategoriesList"></ul>
                                    <div class="add-category">
                                        <input type="text" id="newIncomeCategory" placeholder="New category">
                                        <button class="btn btn-small" onclick="ModalsManager.addCategory('income')">Add</button>
                                    </div>
                                </div>
                                <div class="category-type">
                                    <h5>Expense Categories</h5>
                                    <ul id="expenseCategoriesList"></ul>
                                    <div class="add-category">
                                        <input type="text" id="newExpenseCategory" placeholder="New category">
                                        <button class="btn btn-small" onclick="ModalsManager.addCategory('expense')">Add</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="tab-content" id="tab-backup">
                            <h4>Data Backup & Restore</h4>
                            <div class="backup-actions">
                                <button class="btn" onclick="ModalsManager.exportData()">
                                    Export Data (JSON)
                                </button>
                                <button class="btn" onclick="ModalsManager.exportCSV()">
                                    Export Transactions (CSV)
                                </button>
                                <div class="file-upload">
                                    <label for="importFile" class="btn">Import Data</label>
                                    <input type="file" id="importFile" accept=".json" onchange="ModalsManager.importData(event)">
                                </div>
                            </div>
                            <div class="danger-zone">
                                <h5>Danger Zone</h5>
                                <button class="btn btn-danger" onclick="ModalsManager.confirmClearData()">
                                    Clear All Data
                                </button>
                            </div>
                        </div>

                        <div class="tab-content" id="tab-about">
                            <h4>About ${CONFIG.app.name}</h4>
                            <p>Version: ${CONFIG.app.version}</p>
                            <p>Build Date: ${CONFIG.app.buildDate}</p>
                            <p>A personal finance management application with dual-currency support (THB/IDR), budget tracking, investment projections, and utility monitoring.</p>
                            <h5>Storage Usage</h5>
                            <p id="storageUsage"></p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Cloud Sync Modal -->
            <div id="cloudSyncModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Cloud Sync</h3>
                        <button class="modal-close" onclick="ModalsManager.close()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div id="cloudSyncContent">
                            <div id="notSignedIn">
                                <p>Sign in to sync your data across devices.</p>
                                <button class="btn btn-primary" onclick="App.signInWithGoogle()">
                                    Sign in with Google
                                </button>
                            </div>
                            <div id="signedIn" style="display: none;">
                                <div class="user-info">
                                    <img id="userAvatar" src="" alt="User avatar">
                                    <div>
                                        <p id="userName"></p>
                                        <p id="userEmail"></p>
                                    </div>
                                </div>
                                <div class="sync-info">
                                    <p>Last sync: <span id="lastSyncTime">Never</span></p>
                                </div>
                                <div class="sync-actions">
                                    <button class="btn btn-primary" onclick="App.syncToCloud()">
                                        Sync to Cloud
                                    </button>
                                    <button class="btn" onclick="App.syncFromCloud()">
                                        Restore from Cloud
                                    </button>
                                </div>
                                <hr>
                                <button class="btn btn-danger" onclick="App.signOut()">
                                    Sign Out
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Google Sheets Modal -->
            <div id="sheetsModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Google Sheets</h3>
                        <button class="modal-close" onclick="ModalsManager.close()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div id="sheetsNotAuthorized">
                            <p>Connect to Google Sheets to backup your data to a spreadsheet.</p>
                            <button class="btn btn-primary" onclick="GoogleAPIService.authorize()">
                                Connect Google Sheets
                            </button>
                        </div>
                        <div id="sheetsAuthorized" style="display: none;">
                            <div class="sheets-actions">
                                <button class="btn btn-primary" onclick="App.exportToSheets()">
                                    Export to New Spreadsheet
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Receipt Upload Modal -->
            <div id="receiptModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Upload Receipt</h3>
                        <button class="modal-close" onclick="ModalsManager.close()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="receiptForm">
                            <input type="hidden" id="receiptTransactionId">
                            <div class="file-upload-area" id="receiptDropZone">
                                <p>Drag and drop receipt image here or</p>
                                <input type="file" id="receiptFile" accept="image/*">
                                <label for="receiptFile" class="btn">Choose File</label>
                            </div>
                            <div id="receiptPreview" style="display: none;">
                                <img id="receiptPreviewImg" src="" alt="Receipt preview">
                            </div>
                            <div class="form-actions">
                                <button type="button" class="btn" onclick="ModalsManager.close()">Cancel</button>
                                <button type="submit" class="btn btn-primary">Upload</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Bind modal events
     */
    bindEvents() {
        // Close modal on backdrop click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.close();
                }
            });
        });

        // Close modal on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeModal) {
                this.close();
            }
        });

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                this.switchTab(tab);
            });
        });

        // Edit transaction form
        const editForm = document.getElementById('editTransactionForm');
        if (editForm) {
            editForm.addEventListener('submit', (e) => this.handleEditSubmit(e));
        }

        // Edit type change - update categories
        const editType = document.getElementById('editType');
        if (editType) {
            editType.addEventListener('change', (e) => {
                this.updateCategoryOptions(e.target.value, 'editCategory');
            });
        }

        // Receipt form
        const receiptForm = document.getElementById('receiptForm');
        if (receiptForm) {
            receiptForm.addEventListener('submit', (e) => this.handleReceiptUpload(e));
        }

        // Receipt file preview
        const receiptFile = document.getElementById('receiptFile');
        if (receiptFile) {
            receiptFile.addEventListener('change', (e) => this.previewReceipt(e));
        }
    },

    /**
     * Open a modal
     */
    open(modalId, data = null) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        // Populate data if provided
        if (data) {
            this.populateModal(modalId, data);
        }

        modal.classList.add('active');
        this.activeModal = modal;
        document.body.style.overflow = 'hidden';
    },

    /**
     * Close the active modal
     */
    close() {
        if (this.activeModal) {
            this.activeModal.classList.remove('active');
            this.activeModal = null;
            document.body.style.overflow = '';
        }
    },

    /**
     * Populate modal with data
     */
    populateModal(modalId, data) {
        if (modalId === 'editTransactionModal' && data) {
            document.getElementById('editTransactionId').value = data.id;
            document.getElementById('editDate').value = data.date;
            document.getElementById('editType').value = data.type;
            this.updateCategoryOptions(data.type, 'editCategory');
            document.getElementById('editCategory').value = data.category;
            document.getElementById('editAmount').value = data.amount;
            document.getElementById('editCurrency').value = data.currency;
            document.getElementById('editDescription').value = data.description || '';
        } else if (modalId === 'settingsModal') {
            this.loadSettings();
        } else if (modalId === 'receiptModal' && data) {
            document.getElementById('receiptTransactionId').value = data.transactionId;
        }
    },

    /**
     * Update category options based on type
     */
    updateCategoryOptions(type, selectId) {
        const select = document.getElementById(selectId);
        if (!select) return;

        const categories = DataManager.getCategories();
        const options = categories[type] || [];

        select.innerHTML = options.map(cat =>
            `<option value="${cat}">${cat}</option>`
        ).join('');
    },

    /**
     * Switch settings tab
     */
    switchTab(tabName) {
        // Update buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabName}`);
        });

        // Load tab-specific data
        if (tabName === 'categories') {
            this.loadCategories();
        } else if (tabName === 'about') {
            this.loadStorageInfo();
        }
    },

    /**
     * Load settings into modal
     */
    loadSettings() {
        const settings = DataManager.getSettings();

        const themeSelect = document.getElementById('themeSetting');
        const autoRefresh = document.getElementById('autoRefreshRate');

        if (themeSelect) themeSelect.value = settings.theme || 'light';
        if (autoRefresh) autoRefresh.checked = settings.autoRefreshRate !== false;
    },

    /**
     * Load categories into modal
     */
    loadCategories() {
        const categories = DataManager.getCategories();

        const incomeList = document.getElementById('incomeCategoriesList');
        const expenseList = document.getElementById('expenseCategoriesList');

        if (incomeList) {
            incomeList.innerHTML = categories.income.map(cat => `
                <li>
                    ${cat}
                    <button class="btn btn-small btn-danger" onclick="ModalsManager.removeCategory('income', '${cat}')">×</button>
                </li>
            `).join('');
        }

        if (expenseList) {
            expenseList.innerHTML = categories.expense.map(cat => `
                <li>
                    ${cat}
                    <button class="btn btn-small btn-danger" onclick="ModalsManager.removeCategory('expense', '${cat}')">×</button>
                </li>
            `).join('');
        }
    },

    /**
     * Add category
     */
    addCategory(type) {
        const input = document.getElementById(`new${type.charAt(0).toUpperCase() + type.slice(1)}Category`);
        if (!input || !input.value.trim()) return;

        const categories = DataManager.getCategories();
        const newCategory = input.value.trim();

        if (!categories[type].includes(newCategory)) {
            categories[type].push(newCategory);
            DataManager.saveCategories(categories);
            this.loadCategories();
            App.showToast('Category added', 'success');
        }

        input.value = '';
    },

    /**
     * Remove category
     */
    removeCategory(type, category) {
        const categories = DataManager.getCategories();
        categories[type] = categories[type].filter(c => c !== category);
        DataManager.saveCategories(categories);
        this.loadCategories();
        App.showToast('Category removed', 'success');
    },

    /**
     * Load storage info
     */
    loadStorageInfo() {
        const usage = StorageService.getUsage();
        const usageKB = (usage / 1024).toFixed(2);
        const storageDisplay = document.getElementById('storageUsage');
        if (storageDisplay) {
            storageDisplay.textContent = `${usageKB} KB used`;
        }
    },

    /**
     * Handle edit transaction submit
     */
    handleEditSubmit(e) {
        e.preventDefault();

        const id = document.getElementById('editTransactionId').value;
        const updates = {
            date: document.getElementById('editDate').value,
            type: document.getElementById('editType').value,
            category: document.getElementById('editCategory').value,
            amount: parseFloat(document.getElementById('editAmount').value),
            currency: document.getElementById('editCurrency').value,
            description: document.getElementById('editDescription').value
        };

        TransactionsManager.update(id, updates);
        this.close();
        App.showToast('Transaction updated', 'success');
    },

    /**
     * Export data as JSON
     */
    exportData() {
        const data = StorageService.exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `finance_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        App.showToast('Data exported', 'success');
    },

    /**
     * Export transactions as CSV
     */
    exportCSV() {
        TransactionsManager.exportToCSV();
        App.showToast('Transactions exported', 'success');
    },

    /**
     * Import data from JSON file
     */
    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                StorageService.importAll(data);
                App.reload();
                App.showToast('Data imported successfully', 'success');
            } catch (error) {
                App.showToast('Invalid backup file', 'error');
            }
        };
        reader.readAsText(file);
    },

    /**
     * Confirm clear all data
     */
    confirmClearData() {
        if (confirm('Are you sure you want to delete ALL data? This cannot be undone.')) {
            StorageService.clearAll();
            App.reload();
            App.showToast('All data cleared', 'success');
        }
    },

    /**
     * Preview receipt image
     */
    previewReceipt(event) {
        const file = event.target.files[0];
        if (!file) return;

        const preview = document.getElementById('receiptPreview');
        const img = document.getElementById('receiptPreviewImg');

        const reader = new FileReader();
        reader.onload = (e) => {
            img.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    },

    /**
     * Handle receipt upload
     */
    async handleReceiptUpload(e) {
        e.preventDefault();

        const file = document.getElementById('receiptFile').files[0];
        const transactionId = document.getElementById('receiptTransactionId').value;

        if (!file) {
            App.showToast('Please select a file', 'error');
            return;
        }

        try {
            const result = await GoogleAPIService.uploadReceipt(file, transactionId);
            if (result.success) {
                App.showToast('Receipt uploaded', 'success');
                this.close();
            } else {
                App.showToast('Upload failed: ' + result.error, 'error');
            }
        } catch (error) {
            App.showToast('Upload failed', 'error');
        }
    }
};
