/**
 * Hans Financial Note - Google API Service
 * Handles Google Sheets and Google Drive integration
 */

const GoogleAPIService = {
    initialized: false,
    tokenClient: null,
    accessToken: null,
    spreadsheetId: null,

    /**
     * Initialize Google API
     */
    async init() {
        if (this.initialized) return true;

        try {
            // Load saved token
            const savedToken = StorageService.load(CONFIG.storageKeys.googleToken, null);
            if (savedToken && savedToken.expiry > Date.now()) {
                this.accessToken = savedToken.token;
            }

            // Wait for Google API to load
            await this.waitForGapi();

            // Initialize GAPI client
            await gapi.client.init({
                apiKey: CONFIG.google.apiKey,
                discoveryDocs: CONFIG.google.discoveryDocs
            });

            // Initialize token client for OAuth
            this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: CONFIG.google.clientId,
                scope: CONFIG.google.scopes.join(' '),
                callback: (response) => {
                    if (response.access_token) {
                        this.accessToken = response.access_token;
                        StorageService.save(CONFIG.storageKeys.googleToken, {
                            token: response.access_token,
                            expiry: Date.now() + (response.expires_in * 1000)
                        });
                        window.dispatchEvent(new CustomEvent('googleAuthorized'));
                    }
                }
            });

            this.initialized = true;
            return true;
        } catch (error) {
            console.error('Google API init error:', error);
            return false;
        }
    },

    /**
     * Wait for GAPI to load
     */
    waitForGapi() {
        return new Promise((resolve, reject) => {
            if (typeof gapi !== 'undefined' && gapi.client) {
                resolve();
                return;
            }

            let attempts = 0;
            const checkGapi = setInterval(() => {
                attempts++;
                if (typeof gapi !== 'undefined' && gapi.client) {
                    clearInterval(checkGapi);
                    resolve();
                } else if (attempts > 50) {
                    clearInterval(checkGapi);
                    reject(new Error('GAPI failed to load'));
                }
            }, 100);
        });
    },

    /**
     * Request authorization
     */
    authorize() {
        if (!this.tokenClient) {
            console.error('Token client not initialized');
            return;
        }
        this.tokenClient.requestAccessToken({ prompt: 'consent' });
    },

    /**
     * Check if authorized
     */
    isAuthorized() {
        return this.accessToken !== null;
    },

    /**
     * Revoke authorization
     */
    revoke() {
        if (this.accessToken) {
            google.accounts.oauth2.revoke(this.accessToken);
            this.accessToken = null;
            StorageService.remove(CONFIG.storageKeys.googleToken);
        }
    },

    // ============================================
    // Google Sheets Functions
    // ============================================

    /**
     * Create a new spreadsheet
     */
    async createSpreadsheet(title = 'Hans Financial Note Data') {
        if (!this.accessToken) throw new Error('Not authorized');

        try {
            const response = await gapi.client.sheets.spreadsheets.create({
                properties: {
                    title: title
                },
                sheets: [
                    { properties: { title: 'Transactions' } },
                    { properties: { title: 'Budget' } },
                    { properties: { title: 'Investments' } },
                    { properties: { title: 'Utilities' } },
                    { properties: { title: 'Settings' } }
                ]
            });

            this.spreadsheetId = response.result.spreadsheetId;
            return { success: true, spreadsheetId: this.spreadsheetId };
        } catch (error) {
            console.error('Create spreadsheet error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Export transactions to spreadsheet
     */
    async exportTransactions(spreadsheetId) {
        if (!this.accessToken) throw new Error('Not authorized');

        const transactions = DataManager.getTransactions();

        // Prepare header row
        const headers = ['ID', 'Date', 'Type', 'Category', 'Amount', 'Currency', 'Description', 'Created At'];

        // Prepare data rows
        const rows = transactions.map(t => [
            t.id,
            t.date,
            t.type,
            t.category,
            t.amount,
            t.currency,
            t.description || '',
            t.createdAt
        ]);

        try {
            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: spreadsheetId,
                range: 'Transactions!A1',
                valueInputOption: 'RAW',
                resource: {
                    values: [headers, ...rows]
                }
            });

            return { success: true, rowCount: rows.length };
        } catch (error) {
            console.error('Export transactions error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Export budget data to spreadsheet
     */
    async exportBudget(spreadsheetId) {
        if (!this.accessToken) throw new Error('Not authorized');

        const budget = DataManager.getBudget();

        const data = [
            ['Setting', 'Value'],
            ['Annual Income', budget.annualIncome],
            ['Monthly Budget', budget.monthlyBudget]
        ];

        try {
            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: spreadsheetId,
                range: 'Budget!A1',
                valueInputOption: 'RAW',
                resource: { values: data }
            });

            return { success: true };
        } catch (error) {
            console.error('Export budget error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Export investment data to spreadsheet
     */
    async exportInvestments(spreadsheetId) {
        if (!this.accessToken) throw new Error('Not authorized');

        const investments = DataManager.getInvestments();

        const data = [
            ['Setting', 'Value'],
            ['Allocation %', investments.allocation],
            ['Stock %', investments.stockPercentage],
            ['Crypto %', investments.cryptoPercentage],
            ['Stock Return %', investments.stockReturn],
            ['Crypto Return %', investments.cryptoReturn]
        ];

        try {
            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: spreadsheetId,
                range: 'Investments!A1',
                valueInputOption: 'RAW',
                resource: { values: data }
            });

            return { success: true };
        } catch (error) {
            console.error('Export investments error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Export utility readings to spreadsheet
     */
    async exportUtilities(spreadsheetId) {
        if (!this.accessToken) throw new Error('Not authorized');

        const utilities = DataManager.getUtilities();

        const electricityData = [
            ['Electricity Readings'],
            ['Date', 'Previous', 'Current', 'Usage', 'Cost'],
            ...utilities.electricity.readings.map(r => [
                r.date,
                r.previous,
                r.current,
                r.usage,
                r.cost
            ])
        ];

        const waterData = [
            ['Water Readings'],
            ['Date', 'Previous', 'Current', 'Usage', 'Cost'],
            ...utilities.water.readings.map(r => [
                r.date,
                r.previous,
                r.current,
                r.usage,
                r.cost
            ])
        ];

        try {
            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: spreadsheetId,
                range: 'Utilities!A1',
                valueInputOption: 'RAW',
                resource: { values: [...electricityData, [''], ...waterData] }
            });

            return { success: true };
        } catch (error) {
            console.error('Export utilities error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Export all data to spreadsheet
     */
    async exportAll(spreadsheetId = null) {
        if (!spreadsheetId) {
            const result = await this.createSpreadsheet();
            if (!result.success) return result;
            spreadsheetId = result.spreadsheetId;
        }

        const results = await Promise.all([
            this.exportTransactions(spreadsheetId),
            this.exportBudget(spreadsheetId),
            this.exportInvestments(spreadsheetId),
            this.exportUtilities(spreadsheetId)
        ]);

        const allSuccess = results.every(r => r.success);
        return {
            success: allSuccess,
            spreadsheetId,
            results
        };
    },

    /**
     * Import transactions from spreadsheet
     */
    async importTransactions(spreadsheetId) {
        if (!this.accessToken) throw new Error('Not authorized');

        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: spreadsheetId,
                range: 'Transactions!A2:H'
            });

            const values = response.result.values || [];
            const transactions = values.map(row => ({
                id: row[0],
                date: row[1],
                type: row[2],
                category: row[3],
                amount: parseFloat(row[4]),
                currency: row[5],
                description: row[6] || '',
                createdAt: row[7]
            }));

            DataManager.saveTransactions(transactions);
            return { success: true, count: transactions.length };
        } catch (error) {
            console.error('Import transactions error:', error);
            return { success: false, error: error.message };
        }
    },

    // ============================================
    // Google Drive Functions
    // ============================================

    /**
     * Create app folder in Drive
     */
    async createAppFolder() {
        if (!this.accessToken) throw new Error('Not authorized');

        try {
            // Check if folder exists
            const searchResponse = await gapi.client.drive.files.list({
                q: "name='Hans Financial Note' and mimeType='application/vnd.google-apps.folder' and trashed=false",
                fields: 'files(id, name)'
            });

            if (searchResponse.result.files && searchResponse.result.files.length > 0) {
                return { success: true, folderId: searchResponse.result.files[0].id };
            }

            // Create folder
            const response = await gapi.client.drive.files.create({
                resource: {
                    name: 'Hans Financial Note',
                    mimeType: 'application/vnd.google-apps.folder'
                },
                fields: 'id'
            });

            return { success: true, folderId: response.result.id };
        } catch (error) {
            console.error('Create folder error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Upload receipt image to Drive
     */
    async uploadReceipt(file, transactionId) {
        if (!this.accessToken) throw new Error('Not authorized');

        try {
            // Get or create app folder
            const folderResult = await this.createAppFolder();
            if (!folderResult.success) return folderResult;

            const folderId = folderResult.folderId;

            // Create receipts subfolder if needed
            let receiptsFolderId;
            const searchResponse = await gapi.client.drive.files.list({
                q: `name='Receipts' and '${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
                fields: 'files(id)'
            });

            if (searchResponse.result.files && searchResponse.result.files.length > 0) {
                receiptsFolderId = searchResponse.result.files[0].id;
            } else {
                const createResponse = await gapi.client.drive.files.create({
                    resource: {
                        name: 'Receipts',
                        mimeType: 'application/vnd.google-apps.folder',
                        parents: [folderId]
                    },
                    fields: 'id'
                });
                receiptsFolderId = createResponse.result.id;
            }

            // Upload file
            const metadata = {
                name: `receipt_${transactionId}_${Date.now()}.${file.name.split('.').pop()}`,
                parents: [receiptsFolderId]
            };

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', file);

            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                },
                body: form
            });

            const result = await response.json();
            return { success: true, fileId: result.id, link: result.webViewLink };
        } catch (error) {
            console.error('Upload receipt error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * List receipt files
     */
    async listReceipts() {
        if (!this.accessToken) throw new Error('Not authorized');

        try {
            const folderResult = await this.createAppFolder();
            if (!folderResult.success) return folderResult;

            // Find receipts folder
            const searchResponse = await gapi.client.drive.files.list({
                q: `name='Receipts' and '${folderResult.folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
                fields: 'files(id)'
            });

            if (!searchResponse.result.files || searchResponse.result.files.length === 0) {
                return { success: true, files: [] };
            }

            const receiptsFolderId = searchResponse.result.files[0].id;

            // List files in receipts folder
            const filesResponse = await gapi.client.drive.files.list({
                q: `'${receiptsFolderId}' in parents and trashed=false`,
                fields: 'files(id, name, webViewLink, thumbnailLink, createdTime)',
                orderBy: 'createdTime desc'
            });

            return { success: true, files: filesResponse.result.files || [] };
        } catch (error) {
            console.error('List receipts error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Delete receipt from Drive
     */
    async deleteReceipt(fileId) {
        if (!this.accessToken) throw new Error('Not authorized');

        try {
            await gapi.client.drive.files.delete({
                fileId: fileId
            });
            return { success: true };
        } catch (error) {
            console.error('Delete receipt error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Create backup file in Drive
     */
    async createBackup() {
        if (!this.accessToken) throw new Error('Not authorized');

        try {
            const folderResult = await this.createAppFolder();
            if (!folderResult.success) return folderResult;

            // Create backups subfolder
            let backupsFolderId;
            const searchResponse = await gapi.client.drive.files.list({
                q: `name='Backups' and '${folderResult.folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
                fields: 'files(id)'
            });

            if (searchResponse.result.files && searchResponse.result.files.length > 0) {
                backupsFolderId = searchResponse.result.files[0].id;
            } else {
                const createResponse = await gapi.client.drive.files.create({
                    resource: {
                        name: 'Backups',
                        mimeType: 'application/vnd.google-apps.folder',
                        parents: [folderResult.folderId]
                    },
                    fields: 'id'
                });
                backupsFolderId = createResponse.result.id;
            }

            // Create backup file
            const backupData = StorageService.exportAll();
            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });

            const metadata = {
                name: `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
                parents: [backupsFolderId]
            };

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', blob);

            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                },
                body: form
            });

            const result = await response.json();
            return { success: true, fileId: result.id, fileName: result.name };
        } catch (error) {
            console.error('Create backup error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * List backup files
     */
    async listBackups() {
        if (!this.accessToken) throw new Error('Not authorized');

        try {
            const folderResult = await this.createAppFolder();
            if (!folderResult.success) return folderResult;

            const searchResponse = await gapi.client.drive.files.list({
                q: `name='Backups' and '${folderResult.folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
                fields: 'files(id)'
            });

            if (!searchResponse.result.files || searchResponse.result.files.length === 0) {
                return { success: true, files: [] };
            }

            const backupsFolderId = searchResponse.result.files[0].id;

            const filesResponse = await gapi.client.drive.files.list({
                q: `'${backupsFolderId}' in parents and trashed=false`,
                fields: 'files(id, name, createdTime, size)',
                orderBy: 'createdTime desc'
            });

            return { success: true, files: filesResponse.result.files || [] };
        } catch (error) {
            console.error('List backups error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Restore from backup file
     */
    async restoreBackup(fileId) {
        if (!this.accessToken) throw new Error('Not authorized');

        try {
            const response = await gapi.client.drive.files.get({
                fileId: fileId,
                alt: 'media'
            });

            const backupData = response.result;
            StorageService.importAll(backupData);

            return { success: true };
        } catch (error) {
            console.error('Restore backup error:', error);
            return { success: false, error: error.message };
        }
    }
};
