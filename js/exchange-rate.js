/**
 * Hans Financial Note - Exchange Rate Service
 * Handles real-time currency exchange rate fetching and conversion
 * with live updates, auto-refresh, and rate change indicators
 */

const ExchangeRateService = {
    currentRate: CONFIG.exchangeRate.default,
    previousRate: null,
    lastUpdate: null,
    refreshInterval: null,
    countdownInterval: null,
    isRefreshing: false,
    nextRefreshTime: null,
    rateHistory: [],
    retryCount: 0,
    maxRetries: 3,

    /**
     * Initialize the service
     */
    init() {
        // Load saved rate
        const savedRates = DataManager.getExchangeRates();
        if (savedRates.rate) {
            this.currentRate = savedRates.rate;
            this.previousRate = savedRates.previousRate || savedRates.rate;
            this.lastUpdate = savedRates.lastUpdate;
            this.rateHistory = savedRates.history || [];
        }

        // Update UI immediately with saved data
        this.updateUI();

        // Start auto-refresh if enabled
        if (CONFIG.exchangeRate.autoRefresh) {
            this.startAutoRefresh();
        }

        // Fetch fresh rate on init
        this.fetchRate();

        // Listen for online/offline events
        window.addEventListener('online', () => {
            console.log('Back online - refreshing exchange rate');
            this.fetchRate();
        });

        console.log('ExchangeRateService initialized with rate:', this.currentRate);
    },

    /**
     * Fetch exchange rate from API with multiple providers
     */
    async fetchRate() {
        if (this.isRefreshing) return;
        this.isRefreshing = true;
        this.showRefreshingIndicator(true);

        const providers = [
            { name: 'ExchangeRate-API', fetch: () => this.fetchFromExchangeRateAPI() },
            { name: 'Frankfurter', fetch: () => this.fetchFromFrankfurter() },
            { name: 'Open Exchange', fetch: () => this.fetchFromOpenExchangeRates() }
        ];

        for (const provider of providers) {
            try {
                const result = await provider.fetch();
                if (result.success) {
                    // Store previous rate for comparison
                    this.previousRate = this.currentRate;
                    this.currentRate = result.rate;
                    this.lastUpdate = luxon.DateTime.now().toISO();
                    this.retryCount = 0;

                    // Add to rate history (keep last 24 entries)
                    this.rateHistory.unshift({
                        rate: this.currentRate,
                        timestamp: this.lastUpdate,
                        source: provider.name
                    });
                    if (this.rateHistory.length > 24) {
                        this.rateHistory = this.rateHistory.slice(0, 24);
                    }

                    // Save to storage
                    DataManager.saveExchangeRates({
                        rate: this.currentRate,
                        previousRate: this.previousRate,
                        lastUpdate: this.lastUpdate,
                        source: provider.name,
                        history: this.rateHistory
                    });

                    this.updateUI();
                    this.isRefreshing = false;
                    this.showRefreshingIndicator(false);

                    // Dispatch event for other components
                    window.dispatchEvent(new CustomEvent('exchangeRateUpdated', {
                        detail: {
                            rate: this.currentRate,
                            previousRate: this.previousRate,
                            source: provider.name,
                            change: this.getRateChange()
                        }
                    }));

                    console.log(`Exchange rate updated from ${provider.name}: ${this.currentRate} IDR/THB`);
                    return { success: true, rate: this.currentRate, source: provider.name };
                }
            } catch (error) {
                console.warn(`${provider.name} failed:`, error.message);
            }
        }

        // All providers failed
        this.isRefreshing = false;
        this.showRefreshingIndicator(false);

        // Retry with exponential backoff
        if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            const delay = Math.pow(2, this.retryCount) * 1000;
            console.log(`Retrying in ${delay}ms (attempt ${this.retryCount}/${this.maxRetries})`);
            setTimeout(() => this.fetchRate(), delay);
        }

        return { success: false, rate: this.currentRate };
    },

    /**
     * Fetch from ExchangeRate-API (free tier)
     */
    async fetchFromExchangeRateAPI() {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch(CONFIG.exchangeRate.providers.exchangerateapi, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            const rate = data.rates?.IDR;

            if (!rate || isNaN(rate) || rate <= 0) {
                throw new Error('Invalid rate data');
            }

            return { success: true, rate: rate };
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    },

    /**
     * Fetch from Frankfurter API (European Central Bank data)
     */
    async fetchFromFrankfurter() {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch(CONFIG.exchangeRate.providers.frankfurter, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            const rate = data.rates?.IDR;

            if (!rate || isNaN(rate) || rate <= 0) {
                throw new Error('Invalid rate data');
            }

            return { success: true, rate: rate };
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    },

    /**
     * Fetch from Open Exchange Rates (fallback with free tier)
     */
    async fetchFromOpenExchangeRates() {
        // Note: This API requires an API key for full functionality
        // Using a workaround via ExchangeRate-API as alternative
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            // Alternative endpoint that works without API key
            const response = await fetch('https://api.exchangerate.host/latest?base=THB&symbols=IDR', {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            const rate = data.rates?.IDR;

            if (!rate || isNaN(rate) || rate <= 0) {
                throw new Error('Invalid rate data');
            }

            return { success: true, rate: rate };
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    },

    /**
     * Get current rate
     */
    getRate() {
        return this.currentRate;
    },

    /**
     * Get rate change information
     */
    getRateChange() {
        if (!this.previousRate || this.previousRate === this.currentRate) {
            return { direction: 'stable', amount: 0, percentage: 0 };
        }

        const change = this.currentRate - this.previousRate;
        const percentage = ((change / this.previousRate) * 100);

        return {
            direction: change > 0 ? 'up' : 'down',
            amount: Math.abs(change),
            percentage: Math.abs(percentage)
        };
    },

    /**
     * Set manual rate
     */
    setRate(rate) {
        if (isNaN(rate) || rate <= 0) return false;

        this.previousRate = this.currentRate;
        this.currentRate = rate;
        this.lastUpdate = luxon.DateTime.now().toISO();

        DataManager.saveExchangeRates({
            rate: this.currentRate,
            previousRate: this.previousRate,
            lastUpdate: this.lastUpdate,
            source: 'manual'
        });

        this.updateUI();

        window.dispatchEvent(new CustomEvent('exchangeRateUpdated', {
            detail: { rate: this.currentRate, source: 'manual' }
        }));

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
     * Start auto-refresh with countdown
     */
    startAutoRefresh() {
        // Clear existing intervals
        this.stopAutoRefresh();

        const refreshMs = CONFIG.exchangeRate.refreshInterval || 300000; // 5 minutes default

        // Set up main refresh interval
        this.refreshInterval = setInterval(() => {
            this.fetchRate();
            this.resetCountdown(refreshMs);
        }, refreshMs);

        // Start countdown
        this.resetCountdown(refreshMs);
    },

    /**
     * Reset countdown timer
     */
    resetCountdown(totalMs) {
        this.nextRefreshTime = Date.now() + totalMs;

        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }

        this.countdownInterval = setInterval(() => {
            this.updateCountdownUI();
        }, 1000);

        this.updateCountdownUI();
    },

    /**
     * Update countdown display
     */
    updateCountdownUI() {
        const countdownEl = document.getElementById('rateRefreshCountdown');
        if (!countdownEl || !this.nextRefreshTime) return;

        const remaining = Math.max(0, this.nextRefreshTime - Date.now());
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);

        countdownEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    },

    /**
     * Stop auto-refresh
     */
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
    },

    /**
     * Show/hide refreshing indicator
     */
    showRefreshingIndicator(show) {
        const refreshBtn = document.getElementById('refreshRateBtn');
        const refreshIcon = refreshBtn?.querySelector('i');
        const liveIndicator = document.getElementById('rateLiveIndicator');

        if (refreshIcon) {
            if (show) {
                refreshIcon.classList.add('fa-spin');
            } else {
                refreshIcon.classList.remove('fa-spin');
            }
        }

        if (liveIndicator) {
            if (show) {
                liveIndicator.classList.add('updating');
            } else {
                liveIndicator.classList.remove('updating');
            }
        }
    },

    /**
     * Update UI with current rate
     */
    updateUI() {
        const rate = this.currentRate;
        const change = this.getRateChange();

        // Main exchange rate display
        const rateDisplay = document.getElementById('exchangeRate');
        if (rateDisplay) {
            rateDisplay.textContent = this.formatNumber(rate);
        }

        // Header exchange rate
        const headerRate = document.getElementById('headerExchangeRate');
        if (headerRate) {
            headerRate.textContent = `1 THB = ${this.formatNumber(rate)} IDR`;
        }

        // Bank and Cash exchange rates
        const bankRate = document.getElementById('bankExchangeRate');
        const cashRate = document.getElementById('cashExchangeRate');
        if (bankRate) bankRate.textContent = `${this.formatNumber(rate)} IDR/THB`;
        if (cashRate) cashRate.textContent = `${this.formatNumber(rate)} IDR/THB`;

        // Rate change indicator
        const changeIndicator = document.getElementById('rateChangeIndicator');
        if (changeIndicator) {
            if (change.direction === 'up') {
                changeIndicator.innerHTML = `<i class="fas fa-arrow-up"></i> +${change.percentage.toFixed(2)}%`;
                changeIndicator.className = 'rate-change up';
            } else if (change.direction === 'down') {
                changeIndicator.innerHTML = `<i class="fas fa-arrow-down"></i> -${change.percentage.toFixed(2)}%`;
                changeIndicator.className = 'rate-change down';
            } else {
                changeIndicator.innerHTML = `<i class="fas fa-minus"></i> 0.00%`;
                changeIndicator.className = 'rate-change stable';
            }
        }

        // Last update time with relative format
        const lastUpdateDisplay = document.getElementById('rateLastUpdate');
        if (lastUpdateDisplay && this.lastUpdate) {
            const updateTime = luxon.DateTime.fromISO(this.lastUpdate);
            const now = luxon.DateTime.now();
            const diff = now.diff(updateTime, ['hours', 'minutes', 'seconds']);

            let timeText;
            if (diff.hours > 0) {
                timeText = `${Math.floor(diff.hours)}h ${Math.floor(diff.minutes)}m ago`;
            } else if (diff.minutes > 0) {
                timeText = `${Math.floor(diff.minutes)}m ago`;
            } else {
                timeText = 'Just now';
            }

            lastUpdateDisplay.textContent = timeText;
        }

        // Rate source
        const rateSource = document.getElementById('rateSource');
        if (rateSource) {
            const savedRates = DataManager.getExchangeRates();
            rateSource.textContent = savedRates.source || 'ExchangeRate-API';
        }

        // Exchange rate input (for settings)
        const exchangeInput = document.getElementById('exchangeRateInput');
        if (exchangeInput) {
            exchangeInput.value = rate;
        }

        // Update IDR equivalents across the app
        this.updateIdrEquivalents();

        // Update balance displays with new rate
        this.updateBalanceEquivalents();
    },

    /**
     * Update IDR equivalent displays
     */
    updateIdrEquivalents() {
        const balances = DataManager.getBalances();
        const thbBalance = balances.thb || 0;
        const idrEquiv = document.getElementById('idrEquivalent');
        if (idrEquiv) {
            idrEquiv.textContent = this.format(this.thbToIdr(thbBalance), 'IDR');
        }

        const budget = DataManager.getBudget();
        const budgetEquiv = document.getElementById('budgetIdrEquivalent');
        if (budgetEquiv && budget.monthlyBudget) {
            budgetEquiv.textContent = `(${this.format(this.thbToIdr(budget.monthlyBudget), 'IDR')})`;
        }
    },

    /**
     * Update balance card equivalents
     */
    updateBalanceEquivalents() {
        const balances = DataManager.getBalances();
        const rate = this.currentRate;

        // Bank balance IDR equivalent
        const bankIDRValue = document.getElementById('bankBalanceIDRValue');
        if (bankIDRValue) {
            bankIDRValue.textContent = this.formatNumber((balances.bank || 0) * rate);
        }

        // Cash balance IDR equivalent
        const cashIDRValue = document.getElementById('cashBalanceIDRValue');
        if (cashIDRValue) {
            cashIDRValue.textContent = this.formatNumber((balances.cash || 0) * rate);
        }
    },

    /**
     * Get time since last update (human readable)
     */
    getTimeSinceUpdate() {
        if (!this.lastUpdate) return 'Never';

        const updateTime = luxon.DateTime.fromISO(this.lastUpdate);
        const now = luxon.DateTime.now();

        return updateTime.toRelative();
    },

    /**
     * Get formatted last update time
     */
    getFormattedLastUpdate() {
        if (!this.lastUpdate) return 'Never';

        const updateTime = luxon.DateTime.fromISO(this.lastUpdate);
        return updateTime.toFormat("MMM d, yyyy 'at' h:mm:ss a");
    },

    /**
     * Get rate history for charts/display
     */
    getRateHistory() {
        return this.rateHistory;
    },

    /**
     * Force immediate refresh
     */
    async forceRefresh() {
        this.retryCount = 0;
        const result = await this.fetchRate();

        if (result.success) {
            // Reset the countdown after manual refresh
            const refreshMs = CONFIG.exchangeRate.refreshInterval || 300000;
            this.resetCountdown(refreshMs);
        }

        return result;
    }
};
