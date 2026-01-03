/**
 * Hans Financial Note - Firebase Service
 * Handles Firebase Authentication and Firestore cloud sync
 */

const FirebaseService = {
    app: null,
    auth: null,
    db: null,
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

            // Enable offline persistence
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
     */
    onUserSignedIn(user) {
        console.log('User signed in:', user.email);
        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('userSignedIn', { detail: { user } }));
    },

    /**
     * Handle user sign out
     */
    onUserSignedOut() {
        console.log('User signed out');
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
     */
    async syncToCloud() {
        if (!this.isSignedIn() || this.syncInProgress) return { success: false };

        this.syncInProgress = true;
        try {
            const userDoc = this.getUserDocRef();
            if (!userDoc) throw new Error('No user document');

            const data = StorageService.exportAll();
            data.lastSync = new Date().toISOString();
            data.syncedBy = this.currentUser.email;

            await userDoc.set({
                data: data,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                email: this.currentUser.email,
                displayName: this.currentUser.displayName
            }, { merge: true });

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
     */
    async syncFromCloud() {
        if (!this.isSignedIn() || this.syncInProgress) return { success: false };

        this.syncInProgress = true;
        try {
            const userDoc = this.getUserDocRef();
            if (!userDoc) throw new Error('No user document');

            const doc = await userDoc.get();
            if (!doc.exists) {
                this.syncInProgress = false;
                return { success: true, message: 'No cloud data found' };
            }

            const cloudData = doc.data().data;
            if (cloudData) {
                StorageService.importAll(cloudData);
                StorageService.save(CONFIG.storageKeys.lastSync, new Date().toISOString());
            }

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
     * Delete user data from cloud
     */
    async deleteCloudData() {
        if (!this.isSignedIn()) return { success: false };

        try {
            const userDoc = this.getUserDocRef();
            if (userDoc) {
                await userDoc.delete();
            }
            return { success: true };
        } catch (error) {
            console.error('Delete cloud data error:', error);
            return { success: false, error: error.message };
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
