/**
 * Hans Financial Note - Firebase Service
 * Handles Firebase Authentication, Firestore, and Realtime Database cloud sync
 */

const FirebaseService = {
    app: null,
    auth: null,
    db: null,
    rtdb: null, // Realtime Database reference
    currentUser: null,
    initialized: false,
    syncInProgress: false,

    /**
     * Initialize Firebase
     */
    async init() {
        if (this.initialized) return true;

        try {
            // Check if Firebase SDK is loaded
            if (typeof firebase === 'undefined') {
                console.warn('Firebase SDK not loaded');
                return false;
            }

            // Initialize Firebase app
            if (!firebase.apps.length) {
                this.app = firebase.initializeApp(CONFIG.firebase);
            } else {
                this.app = firebase.apps[0];
            }

            this.auth = firebase.auth();
            this.db = firebase.firestore();

            // Initialize Realtime Database
            if (CONFIG.firebase.databaseURL) {
                this.rtdb = firebase.database();
                console.log('Firebase Realtime Database initialized');
            }

            // Enable offline persistence for Firestore
            try {
                await this.db.enablePersistence({ synchronizeTabs: true });
            } catch (err) {
                if (err.code === 'failed-precondition') {
                    console.warn('Firestore persistence failed: multiple tabs open');
                } else if (err.code === 'unimplemented') {
                    console.warn('Firestore persistence not available');
                }
            }

            // Listen for auth state changes
            this.auth.onAuthStateChanged((user) => {
                this.currentUser = user;
                if (user) {
                    this.onUserSignedIn(user);
                } else {
                    this.onUserSignedOut();
                }
            });

            this.initialized = true;
            return true;
        } catch (error) {
            console.error('Firebase init error:', error);
            return false;
        }
    },

    /**
     * Sign in with Google
     */
    async signInWithGoogle() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.addScope('email');
            provider.addScope('profile');

            const result = await this.auth.signInWithPopup(provider);
            return { success: true, user: result.user };
        } catch (error) {
            console.error('Google sign-in error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Sign in with email and password
     */
    async signInWithEmail(email, password) {
        try {
            const result = await this.auth.signInWithEmailAndPassword(email, password);
            return { success: true, user: result.user };
        } catch (error) {
            console.error('Email sign-in error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Sign up with email and password
     */
    async signUpWithEmail(email, password) {
        try {
            const result = await this.auth.createUserWithEmailAndPassword(email, password);
            return { success: true, user: result.user };
        } catch (error) {
            console.error('Email sign-up error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Sign out
     */
    async signOut() {
        try {
            await this.auth.signOut();
            return { success: true };
        } catch (error) {
            console.error('Sign-out error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Get current user
     */
    getUser() {
        return this.currentUser;
    },

    /**
     * Check if user is signed in
     */
    isSignedIn() {
        return this.currentUser !== null;
    },

    /**
     * Handle user sign in
     * Automatically syncs data from cloud and sets up real-time listeners
     * If user has existing data in cloud, skip setup wizard and load their data
     */
    async onUserSignedIn(user) {
        console.log('User signed in:', user.email);

        // Sync data from cloud immediately after sign-in
        try {
            const result = await this.syncFromCloud();
            if (result.success && result.data) {
                console.log('Data synced from cloud');

                // Check if cloud data has setup complete - skip wizard if so
                if (result.data.setupComplete === true) {
                    console.log('User has existing data in cloud - skipping setup wizard');
                    DataManager.setSetupComplete(true);
                }

                // Reload all managers with synced data
                if (typeof TransactionsManager !== 'undefined') TransactionsManager.init();
                if (typeof BudgetManager !== 'undefined') BudgetManager.init();
                if (typeof InvestmentsManager !== 'undefined') InvestmentsManager.init();
                if (typeof UtilitiesManager !== 'undefined') {
                    try { UtilitiesManager.init(); } catch (e) { console.warn('Could not init UtilitiesManager:', e); }
                }

                // If setup is complete, show main app directly
                if (DataManager.isSetupComplete()) {
                    if (typeof App !== 'undefined') {
                        App.isSetupComplete = true;
                        if (App.showApp) App.showApp();
                    }
                } else {
                    // Refresh UI
                    if (typeof App !== 'undefined' && App.showApp) {
                        App.showApp();
                    }
                }
            }
        } catch (error) {
            console.warn('Could not sync from cloud on sign-in:', error);
        }

        // Set up real-time listeners for cross-device sync
        this.setupRealtimeSync();

        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('userSignedIn', { detail: { user } }));
    },

    /**
     * Set up real-time sync listener for cross-device synchronization
     * Uses Firebase Realtime Database for instant updates
     */
    realtimeUnsubscribe: null,
    setupRealtimeSync() {
        // Remove existing listener if any
        if (this.realtimeUnsubscribe) {
            if (typeof this.realtimeUnsubscribe === 'function') {
                this.realtimeUnsubscribe();
            }
            this.realtimeUnsubscribe = null;
        }

        if (!this.isSignedIn()) return;

        // Use Realtime Database if available, otherwise fallback to Firestore
        if (this.rtdb) {
            this.setupRealtimeDatabaseSync();
        } else {
            this.setupFirestoreSync();
        }
    },

    /**
     * Set up Firebase Realtime Database sync (preferred for instant cross-device updates)
     */
    setupRealtimeDatabaseSync() {
        if (!this.rtdb || !this.currentUser) return;

        const userRef = this.rtdb.ref(`users/${this.currentUser.uid}/data`);

        const listener = userRef.on('value', (snapshot) => {
            if (!this.syncInProgress && snapshot.exists()) {
                const cloudData = snapshot.val();
                const cloudTimestamp = cloudData?.lastSync ? new Date(cloudData.lastSync) : new Date(0);
                const localTimestamp = new Date(StorageService.load(CONFIG.storageKeys.lastSync, '1970-01-01'));

                // Only import if cloud data is newer (avoid loop)
                if (cloudTimestamp > localTimestamp) {
                    console.log('Received newer data from Realtime Database, updating local...');

                    // Import data
                    StorageService.importAll(cloudData);

                    // Refresh managers without triggering another sync
                    if (typeof TransactionsManager !== 'undefined') TransactionsManager.init();
                    if (typeof BudgetManager !== 'undefined') BudgetManager.init();
                    if (typeof InvestmentsManager !== 'undefined') InvestmentsManager.init();
                    if (typeof UtilitiesManager !== 'undefined') {
                        try { UtilitiesManager.init(); } catch (e) { }
                    }

                    // Update UI
                    if (typeof App !== 'undefined') {
                        if (App.showApp) App.showApp();
                        if (App.updateCategorySpendingDisplay) App.updateCategorySpendingDisplay();
                    }

                    App?.showToast?.('Data synced from another device', 'success');
                }
            }
        }, (error) => {
            console.error('Realtime Database sync error:', error);
        });

        // Store unsubscribe function
        this.realtimeUnsubscribe = () => userRef.off('value', listener);
        console.log('Realtime Database sync listener set up');
    },

    /**
     * Set up Firestore sync (fallback)
     */
    setupFirestoreSync() {
        const userDoc = this.getUserDocRef();
        if (!userDoc) return;

        this.realtimeUnsubscribe = userDoc.onSnapshot((doc) => {
            if (doc.exists && !this.syncInProgress) {
                const data = doc.data();
                const cloudTimestamp = data.updatedAt?.toDate?.() || new Date(data.data?.lastSync || 0);
                const localTimestamp = new Date(StorageService.load(CONFIG.storageKeys.lastSync, '1970-01-01'));

                // Only import if cloud data is newer (avoid loop)
                if (cloudTimestamp > localTimestamp) {
                    console.log('Received newer data from Firestore, updating local...');
                    const cloudData = data.data;
                    if (cloudData) {
                        StorageService.importAll(cloudData);
                        // Refresh managers without triggering another sync
                        if (typeof TransactionsManager !== 'undefined') TransactionsManager.init();
                        if (typeof BudgetManager !== 'undefined') BudgetManager.init();
                        if (typeof InvestmentsManager !== 'undefined') InvestmentsManager.init();
                        // Update UI
                        if (typeof App !== 'undefined') {
                            if (App.showApp) App.showApp();
                            if (App.updateCategorySpendingDisplay) App.updateCategorySpendingDisplay();
                        }
                        App?.showToast?.('Data synced from another device', 'success');
                    }
                }
            }
        }, (error) => {
            console.error('Firestore sync error:', error);
        });

        console.log('Firestore sync listener set up');
    },

    /**
     * Auto-sync local changes to cloud (call this after any data change)
     * Uses Realtime Database for instant sync, with Firestore backup
     */
    async autoSyncToCloud() {
        if (!this.isSignedIn()) return;

        // Debounce sync to avoid too many writes
        if (this.autoSyncTimeout) {
            clearTimeout(this.autoSyncTimeout);
        }

        this.autoSyncTimeout = setTimeout(async () => {
            const result = await this.syncToCloud();
            if (result.success) {
                console.log('Auto-synced to cloud');
            }
        }, 1000); // Wait 1 second before syncing (faster for better cross-device experience)
    },

    /**
     * Handle user sign out
     */
    onUserSignedOut() {
        console.log('User signed out');

        // Clean up real-time listener
        if (this.realtimeUnsubscribe) {
            this.realtimeUnsubscribe();
            this.realtimeUnsubscribe = null;
        }

        // Clear auto-sync timeout
        if (this.autoSyncTimeout) {
            clearTimeout(this.autoSyncTimeout);
            this.autoSyncTimeout = null;
        }

        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('userSignedOut'));
    },

    /**
     * Get user document reference
     */
    getUserDocRef() {
        if (!this.currentUser) return null;
        return this.db.collection('users').doc(this.currentUser.uid);
    },

    /**
     * Sync data to cloud
     * Uses Realtime Database for instant sync, with Firestore as backup
     */
    async syncToCloud() {
        if (!this.isSignedIn() || this.syncInProgress) return { success: false };

        this.syncInProgress = true;
        try {
            const data = StorageService.exportAll();
            data.lastSync = new Date().toISOString();
            data.syncedBy = this.currentUser.email;

            // Sync to Realtime Database (primary - instant updates)
            if (this.rtdb) {
                const userRef = this.rtdb.ref(`users/${this.currentUser.uid}`);
                await userRef.set({
                    data: data,
                    updatedAt: firebase.database.ServerValue.TIMESTAMP,
                    email: this.currentUser.email,
                    displayName: this.currentUser.displayName
                });
                console.log('Synced to Realtime Database');
            }

            // Also sync to Firestore (backup)
            const userDoc = this.getUserDocRef();
            if (userDoc) {
                await userDoc.set({
                    data: data,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    email: this.currentUser.email,
                    displayName: this.currentUser.displayName
                }, { merge: true });
            }

            StorageService.save(CONFIG.storageKeys.lastSync, data.lastSync);

            this.syncInProgress = false;
            return { success: true, timestamp: data.lastSync };
        } catch (error) {
            console.error('Sync to cloud error:', error);
            this.syncInProgress = false;
            return { success: false, error: error.message };
        }
    },

    /**
     * Sync data from cloud
     * Tries Realtime Database first, falls back to Firestore
     */
    async syncFromCloud() {
        if (!this.isSignedIn() || this.syncInProgress) return { success: false };

        this.syncInProgress = true;
        try {
            let cloudData = null;

            // Try Realtime Database first (preferred for real-time sync)
            if (this.rtdb) {
                try {
                    const userRef = this.rtdb.ref(`users/${this.currentUser.uid}/data`);
                    const snapshot = await userRef.once('value');
                    if (snapshot.exists()) {
                        cloudData = snapshot.val();
                        console.log('Loaded data from Realtime Database');
                    }
                } catch (rtdbError) {
                    console.warn('Realtime Database read failed, trying Firestore:', rtdbError);
                }
            }

            // Fall back to Firestore if Realtime Database didn't have data
            if (!cloudData) {
                const userDoc = this.getUserDocRef();
                if (userDoc) {
                    const doc = await userDoc.get();
                    if (doc.exists) {
                        cloudData = doc.data().data;
                        console.log('Loaded data from Firestore');
                    }
                }
            }

            if (!cloudData) {
                this.syncInProgress = false;
                return { success: true, message: 'No cloud data found' };
            }

            StorageService.importAll(cloudData);
            StorageService.save(CONFIG.storageKeys.lastSync, new Date().toISOString());

            this.syncInProgress = false;
            return { success: true, data: cloudData };
        } catch (error) {
            console.error('Sync from cloud error:', error);
            this.syncInProgress = false;
            return { success: false, error: error.message };
        }
    },

    /**
     * Get last sync timestamp
     */
    getLastSync() {
        return StorageService.load(CONFIG.storageKeys.lastSync, null);
    },

    /**
     * Delete user data from cloud (both Realtime Database and Firestore)
     */
    async deleteCloudData() {
        if (!this.isSignedIn()) return { success: false };

        try {
            // Delete from Realtime Database
            if (this.rtdb) {
                const userRef = this.rtdb.ref(`users/${this.currentUser.uid}`);
                await userRef.remove();
                console.log('Deleted from Realtime Database');
            }

            // Delete from Firestore
            const userDoc = this.getUserDocRef();
            if (userDoc) {
                await userDoc.delete();
                console.log('Deleted from Firestore');
            }

            return { success: true };
        } catch (error) {
            console.error('Delete cloud data error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Check if user has existing data in cloud
     * Returns true if user has setup complete data
     */
    async hasExistingCloudData() {
        if (!this.isSignedIn()) return false;

        try {
            // Check Realtime Database first
            if (this.rtdb) {
                const userRef = this.rtdb.ref(`users/${this.currentUser.uid}/data/setupComplete`);
                const snapshot = await userRef.once('value');
                if (snapshot.exists() && snapshot.val() === true) {
                    return true;
                }
            }

            // Check Firestore as fallback
            const userDoc = this.getUserDocRef();
            if (userDoc) {
                const doc = await userDoc.get();
                if (doc.exists && doc.data()?.data?.setupComplete === true) {
                    return true;
                }
            }

            return false;
        } catch (error) {
            console.warn('Error checking for existing cloud data:', error);
            return false;
        }
    },

    /**
     * Listen for real-time updates
     */
    listenForUpdates(callback) {
        if (!this.isSignedIn()) return null;

        const userDoc = this.getUserDocRef();
        if (!userDoc) return null;

        return userDoc.onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data();
                callback(data);
            }
        }, (error) => {
            console.error('Real-time listener error:', error);
        });
    },

    /**
     * Send password reset email
     */
    async sendPasswordReset(email) {
        try {
            await this.auth.sendPasswordResetEmail(email);
            return { success: true };
        } catch (error) {
            console.error('Password reset error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Update user profile
     */
    async updateProfile(displayName, photoURL) {
        if (!this.currentUser) return { success: false };

        try {
            await this.currentUser.updateProfile({
                displayName: displayName || this.currentUser.displayName,
                photoURL: photoURL || this.currentUser.photoURL
            });
            return { success: true };
        } catch (error) {
            console.error('Update profile error:', error);
            return { success: false, error: error.message };
        }
    }
};
