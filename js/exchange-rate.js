/**
 * Hans Financial Note - Exchange Rate Service
 * Handles real-time currency exchange rate fetching and conversion
 */

const ExchangeRateService = {
    currentRate: CONFIG.exchangeRate.default,
    lastUpdate: null,
    refreshInterval: null,
    isRefreshing: false,

    /**
     * Initialize the service
     */
    init() {
        // Load saved rate
        const savedRates = DataManager.getExchangeRates();
        if (savedRates.rate) {
            this.currentRate = savedRates.rate;
            this.lastUpdate = savedRates.lastUpdate;
        }

        // Start auto-refresh if enabled
        if (CONFIG.exchangeRate.autoRefresh) {
            this.startAutoRefresh();
        }

        // Fetch fresh rate
        this.fetchRate();
    },

    /**
     * Fetch exchange rate from API
     */
    async fetchRate() {
        if (this.isRefreshing) return;
        this.isRefreshing = true;

        const providers = [
            { name: 'exchangerateapi', fetch: () => this.fetchFromExchangeRateAPI() },
            { name: 'frankfurter', fetch: () => this.fetchFromFrankfurter() }
        ];

        for (const provider of providers) {
            try {
                const result = await provider.fetch();
                if (result.success) {
                    this.currentRate = result.rate;
                    this.lastUpdate = new Date().toISOString();

                    DataManager.saveExchangeRates({
                        rate: this.currentRate,
                        lastUpdate: this.lastUpdate,
                        source: provider.name
                    });

                    this.updateUI();
                    this.isRefreshing = false;

                    window.dispatchEvent(new CustomEvent('exchangeRateUpdated', {
                        detail: { rate: this.currentRate, source: provider.name }
                    }));

                    return { success: true, rate: this.currentRate };
                }
            } catch (error) {
                console.warn(`${provider.name} failed:`, error);
            }
        }

        this.isRefreshing = false;
        return { success: false, rate: this.currentRate };
    },

    /**
     * Fetch from ExchangeRate-API
     */
    async fetchFromExchangeRateAPI() {
        const response = await fetch(CONFIG.exchangeRate.providers.exchangerateapi);
        if (!response.ok) throw new Error('API error');

        const data = await response.json();
        const rate = data.rates.IDR;

        if (!rate || isNaN(rate)) throw new Error('Invalid rate');

        return { success: true, rate: rate };
    },

    /**
     * Fetch from Frankfurter API
     */
    async fetchFromFrankfurter() {
        const response = await fetch(CONFIG.exchangeRate.providers.frankfurter);
        if (!response.ok) throw new Error('API error');

        const data = await response.json();
        const rate = data.rates.IDR;

        if (!rate || isNaN(rate)) throw new Error('Invalid rate');

        return { success: true, rate: rate };
    },

    /**
     * Get current rate
     */
    getRate() {
        return this.currentRate;
    },

    /**
     * Set manual rate
     */
    setRate(rate) {
        if (isNaN(rate) || rate <= 0) return false;

        this.currentRate = rate;
        this.lastUpdate = new Date().toISOString();

        DataManager.saveExchangeRates({
            rate: this.currentRate,
            lastUpdate: this.lastUpdate,
            source: 'manual'
        });

        this.updateUI();
        return true;
    },

    /**
     * Convert THB to IDR
     */
    thbToIdr(amount) {
        return amount * this.currentRate;
    },

    /**
     * Convert IDR to THB
     */
    idrToThb(amount) {
        return amount / this.currentRate;
    },

    /**
     * Convert between currencies
     */
    convert(amount, from, to) {
        if (from === to) return amount;
        if (from === 'THB' && to === 'IDR') return this.thbToIdr(amount);
        if (from === 'IDR' && to === 'THB') return this.idrToThb(amount);
        return amount;
    },

    /**
     * Format currency
     */
    format(amount, currency = 'THB') {
        const symbol = CONFIG.currencies.symbols[currency] || '';
        const formatted = this.formatNumber(amount);
        return currency === 'THB' ? `${symbol}${formatted}` : `${symbol} ${formatted}`;
    },

    /**
     * Format number with thousands separator
     */
    formatNumber(num) {
        if (isNaN(num)) return '0';
        return parseFloat(num).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    },

    /**
     * Start auto-refresh
     */
    startAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        this.refreshInterval = setInterval(() => {
            this.fetchRate();
        }, CONFIG.exchangeRate.refreshInterval);
    },

    /**
     * Stop auto-refresh
     */
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    },

    /**
     * Update UI with current rate
     */
    updateUI() {
        const rateDisplay = document.getElementById('exchangeRate');
        const lastUpdateDisplay = document.getElementById('rateLastUpdate');
        const exchangeInput = document.getElementById('exchangeRateInput');

        if (rateDisplay) {
            rateDisplay.textContent = this.formatNumber(this.currentRate);
        }

        if (lastUpdateDisplay && this.lastUpdate) {
            const date = new Date(this.lastUpdate);
            lastUpdateDisplay.textContent = `Last updated: ${date.toLocaleString()}`;
        }

        if (exchangeInput) {
            exchangeInput.value = this.currentRate;
        }

        // Update IDR equivalents across the app
        this.updateIdrEquivalents();
    },

    /**
     * Update IDR equivalent displays
     */
    updateIdrEquivalents() {
        // Update balance equivalent
        const balances = DataManager.getBalances();
        const thbBalance = balances.thb || 0;
        const idrEquiv = document.getElementById('idrEquivalent');
        if (idrEquiv) {
            idrEquiv.textContent = this.format(this.thbToIdr(thbBalance), 'IDR');
        }

        // Update budget equivalent
        const budget = DataManager.getBudget();
        const budgetEquiv = document.getElementById('budgetIdrEquivalent');
        if (budgetEquiv && budget.monthlyBudget) {
            budgetEquiv.textContent = `(${this.format(this.thbToIdr(budget.monthlyBudget), 'IDR')})`;
        }
    },

    /**
     * Get time since last update
     */
    getTimeSinceUpdate() {
        if (!this.lastUpdate) return 'Never';

        const now = new Date();
        const last = new Date(this.lastUpdate);
        const diff = now - last;

        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        return 'Just now';
    }
};
