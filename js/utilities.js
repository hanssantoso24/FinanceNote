/**
 * Hans Financial Note - Utilities Tracking Module
 * Handles electricity and water utility consumption tracking with Ongoing Reading feature
 */

const UtilitiesManager = {
    utilities: null,

    /**
     * Initialize utilities manager
     */
    init() {
        this.utilities = DataManager.getUtilities();

        // Ensure readings arrays exist
        if (!this.utilities) {
            this.utilities = {
                electricity: {
                    rate: CONFIG.utilities.electricity.defaultRate,
                    threshold: CONFIG.utilities.electricity.defaultThreshold,
                    readings: [],
                    pastReading: 0,
                    pastReadingDate: null,
                    ongoingReading: 0,
                    ongoingReadingDate: null
                },
                water: {
                    rate: CONFIG.utilities.water.defaultRate,
                    readings: [],
                    pastReading: 0,
                    pastReadingDate: null,
                    ongoingReading: 0,
                    ongoingReadingDate: null
                }
            };
            DataManager.saveUtilities(this.utilities);
        }

        // Ensure electricity structure exists
        if (!this.utilities.electricity) {
            this.utilities.electricity = {
                rate: CONFIG.utilities.electricity.defaultRate,
                threshold: CONFIG.utilities.electricity.defaultThreshold,
                readings: [],
                pastReading: 0,
                pastReadingDate: null,
                ongoingReading: 0,
                ongoingReadingDate: null
            };
        }
        if (!this.utilities.electricity.readings) {
            this.utilities.electricity.readings = [];
        }
        // Migrate from old structure if needed
        if (this.utilities.electricity.lastReading !== undefined && this.utilities.electricity.pastReading === undefined) {
            this.utilities.electricity.pastReading = this.utilities.electricity.lastReading;
            this.utilities.electricity.ongoingReading = this.utilities.electricity.lastReading;
        }
        if (this.utilities.electricity.pastReading === undefined) {
            this.utilities.electricity.pastReading = 0;
        }
        if (this.utilities.electricity.ongoingReading === undefined) {
            this.utilities.electricity.ongoingReading = 0;
        }

        // Ensure water structure exists
        if (!this.utilities.water) {
            this.utilities.water = {
                rate: CONFIG.utilities.water.defaultRate,
                readings: [],
                pastReading: 0,
                pastReadingDate: null,
                ongoingReading: 0,
                ongoingReadingDate: null
            };
        }
        if (!this.utilities.water.readings) {
            this.utilities.water.readings = [];
        }
        // Migrate from old structure if needed
        if (this.utilities.water.lastReading !== undefined && this.utilities.water.pastReading === undefined) {
            this.utilities.water.pastReading = this.utilities.water.lastReading;
            this.utilities.water.ongoingReading = this.utilities.water.lastReading;
        }
        if (this.utilities.water.pastReading === undefined) {
            this.utilities.water.pastReading = 0;
        }
        if (this.utilities.water.ongoingReading === undefined) {
            this.utilities.water.ongoingReading = 0;
        }

        DataManager.saveUtilities(this.utilities);
        this.updateUI();
    },

    /**
     * Set past reading (from configuration)
     */
    setElectricityPastReading(value, date) {
        this.utilities.electricity.pastReading = parseFloat(value) || 0;
        this.utilities.electricity.pastReadingDate = date || new Date().toISOString().split('T')[0];
        DataManager.saveUtilities(this.utilities);
        this.updateUI();
    },

    setWaterPastReading(value, date) {
        this.utilities.water.pastReading = parseFloat(value) || 0;
        this.utilities.water.pastReadingDate = date || new Date().toISOString().split('T')[0];
        DataManager.saveUtilities(this.utilities);
        this.updateUI();
    },

    /**
     * Set ongoing reading (from current reading input)
     */
    setElectricityOngoingReading(value, date) {
        this.utilities.electricity.ongoingReading = parseFloat(value) || 0;
        this.utilities.electricity.ongoingReadingDate = date || new Date().toISOString().split('T')[0];
        DataManager.saveUtilities(this.utilities);
        this.updateUI();
    },

    setWaterOngoingReading(value, date) {
        this.utilities.water.ongoingReading = parseFloat(value) || 0;
        this.utilities.water.ongoingReadingDate = date || new Date().toISOString().split('T')[0];
        DataManager.saveUtilities(this.utilities);
        this.updateUI();
    },

    /**
     * Calculate electricity estimation (does NOT add to expenses)
     */
    calculateElectricityEstimation(currentReading, currentDate) {
        const pastReading = this.utilities.electricity.pastReading || 0;
        const pastDate = this.utilities.electricity.pastReadingDate;
        const rate = this.utilities.electricity.rate || 8;
        const threshold = this.utilities.electricity.threshold || 3;

        const usage = currentReading - pastReading;

        // Calculate days between
        let daysBetween = 0;
        if (pastDate && currentDate) {
            const startDate = new Date(pastDate);
            const endDate = new Date(currentDate);
            daysBetween = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        }

        // Calculate average per day
        const averagePerDay = daysBetween > 0 ? usage / daysBetween : 0;

        // Calculate cost (estimation only, not added to expenses)
        let cost = 0;
        if (usage > threshold) {
            cost = (usage - threshold) * rate;
        }

        return {
            usage: usage,
            cost: cost,
            daysBetween: daysBetween,
            averagePerDay: averagePerDay,
            rate: rate,
            threshold: threshold
        };
    },

    /**
     * Calculate water estimation (does NOT add to expenses)
     */
    calculateWaterEstimation(currentReading, currentDate) {
        const pastReading = this.utilities.water.pastReading || 0;
        const pastDate = this.utilities.water.pastReadingDate;
        const rate = this.utilities.water.rate || 20;

        const usage = currentReading - pastReading;

        // Calculate days between
        let daysBetween = 0;
        if (pastDate && currentDate) {
            const startDate = new Date(pastDate);
            const endDate = new Date(currentDate);
            daysBetween = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        }

        // Calculate average per day
        const averagePerDay = daysBetween > 0 ? usage / daysBetween : 0;

        // Calculate cost (estimation only, not added to expenses)
        const cost = usage * rate;

        return {
            usage: usage,
            cost: cost,
            daysBetween: daysBetween,
            averagePerDay: averagePerDay,
            rate: rate
        };
    },

    /**
     * Add electricity reading (legacy function for actual consumption records)
     */
    addElectricityReading(date, previous, current) {
        const usage = current - previous;
        const rate = this.utilities.electricity.rate;
        const threshold = this.utilities.electricity.threshold;

        let cost;
        if (usage <= threshold) {
            cost = 0;
        } else {
            cost = (usage - threshold) * rate;
        }

        const reading = {
            id: Date.now().toString(),
            date: date,
            previous: previous,
            current: current,
            usage: usage,
            cost: cost,
            rate: rate,
            threshold: threshold
        };

        this.utilities.electricity.readings.unshift(reading);
        DataManager.saveUtilities(this.utilities);

        this.updateUI();
        return reading;
    },

    /**
     * Add water reading (legacy function for actual consumption records)
     */
    addWaterReading(date, previous, current) {
        const usage = current - previous;
        const rate = this.utilities.water.rate;
        const cost = usage * rate;

        const reading = {
            id: Date.now().toString(),
            date: date,
            previous: previous,
            current: current,
            usage: usage,
            cost: cost,
            rate: rate
        };

        this.utilities.water.readings.unshift(reading);
        DataManager.saveUtilities(this.utilities);

        this.updateUI();
        return reading;
    },

    /**
     * Update electricity rate
     */
    setElectricityRate(rate) {
        this.utilities.electricity.rate = rate;
        DataManager.saveUtilities(this.utilities);
    },

    /**
     * Update electricity threshold
     */
    setElectricityThreshold(threshold) {
        this.utilities.electricity.threshold = threshold;
        DataManager.saveUtilities(this.utilities);
    },

    /**
     * Update water rate
     */
    setWaterRate(rate) {
        this.utilities.water.rate = rate;
        DataManager.saveUtilities(this.utilities);
    },

    /**
     * Get electricity readings
     */
    getElectricityReadings() {
        return this.utilities.electricity.readings;
    },

    /**
     * Get water readings
     */
    getWaterReadings() {
        return this.utilities.water.readings;
    },

    /**
     * Delete electricity reading
     */
    deleteElectricityReading(id) {
        this.utilities.electricity.readings = this.utilities.electricity.readings.filter(r => r.id !== id);
        DataManager.saveUtilities(this.utilities);
        this.updateUI();
    },

    /**
     * Delete water reading
     */
    deleteWaterReading(id) {
        this.utilities.water.readings = this.utilities.water.readings.filter(r => r.id !== id);
        DataManager.saveUtilities(this.utilities);
        this.updateUI();
    },

    /**
     * Calculate monthly average for electricity
     */
    getElectricityMonthlyAverage() {
        const readings = this.utilities.electricity.readings;
        if (readings.length === 0) return 0;

        const total = readings.reduce((sum, r) => sum + r.cost, 0);
        return total / readings.length;
    },

    /**
     * Calculate monthly average for water
     */
    getWaterMonthlyAverage() {
        const readings = this.utilities.water.readings;
        if (readings.length === 0) return 0;

        const total = readings.reduce((sum, r) => sum + r.cost, 0);
        return total / readings.length;
    },

    /**
     * Get current month's usage
     */
    getCurrentMonthUsage() {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const electricityUsage = this.utilities.electricity.readings
            .filter(r => {
                const date = new Date(r.date);
                return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
            })
            .reduce((sum, r) => sum + r.usage, 0);

        const waterUsage = this.utilities.water.readings
            .filter(r => {
                const date = new Date(r.date);
                return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
            })
            .reduce((sum, r) => sum + r.usage, 0);

        return {
            electricity: electricityUsage,
            water: waterUsage
        };
    },

    /**
     * Get total costs for current month
     */
    getCurrentMonthCost() {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const electricityCost = this.utilities.electricity.readings
            .filter(r => {
                const date = new Date(r.date);
                return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
            })
            .reduce((sum, r) => sum + r.cost, 0);

        const waterCost = this.utilities.water.readings
            .filter(r => {
                const date = new Date(r.date);
                return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
            })
            .reduce((sum, r) => sum + r.cost, 0);

        return {
            electricity: electricityCost,
            water: waterCost,
            total: electricityCost + waterCost
        };
    },

    /**
     * Update UI with utility data
     */
    updateUI() {
        // Safety check - ensure utilities is initialized
        if (!this.utilities || !this.utilities.electricity || !this.utilities.water) {
            console.warn('Utilities not properly initialized');
            return;
        }

        // Update electricity displays
        const elecRateDisplay = document.getElementById('electricityRateDisplay');
        if (elecRateDisplay) elecRateDisplay.textContent = this.utilities.electricity.rate || 8;

        // Past Reading
        const elecPastReading = document.getElementById('electricityPastReading');
        const elecPastDate = document.getElementById('electricityPastDate');
        if (elecPastReading) elecPastReading.textContent = `${this.utilities.electricity.pastReading || 0} kWh`;
        if (elecPastDate) elecPastDate.textContent = this.utilities.electricity.pastReadingDate ?
            `Date: ${this.formatDate(this.utilities.electricity.pastReadingDate)}` : 'Date: Not set';

        // Ongoing Reading
        const elecOngoingReading = document.getElementById('electricityOngoingReading');
        const elecOngoingDate = document.getElementById('electricityOngoingDate');
        if (elecOngoingReading) elecOngoingReading.textContent = `${this.utilities.electricity.ongoingReading || 0} kWh`;
        if (elecOngoingDate) elecOngoingDate.textContent = this.utilities.electricity.ongoingReadingDate ?
            `Date: ${this.formatDate(this.utilities.electricity.ongoingReadingDate)}` : 'Date: Not set';

        // Update water displays
        const waterRateDisplay = document.getElementById('waterRateDisplay');
        if (waterRateDisplay) waterRateDisplay.textContent = this.utilities.water.rate || 20;

        // Past Reading
        const waterPastReading = document.getElementById('waterPastReading');
        const waterPastDate = document.getElementById('waterPastDate');
        if (waterPastReading) waterPastReading.textContent = `${this.utilities.water.pastReading || 0} units`;
        if (waterPastDate) waterPastDate.textContent = this.utilities.water.pastReadingDate ?
            `Date: ${this.formatDate(this.utilities.water.pastReadingDate)}` : 'Date: Not set';

        // Ongoing Reading
        const waterOngoingReading = document.getElementById('waterOngoingReading');
        const waterOngoingDate = document.getElementById('waterOngoingDate');
        if (waterOngoingReading) waterOngoingReading.textContent = `${this.utilities.water.ongoingReading || 0} units`;
        if (waterOngoingDate) waterOngoingDate.textContent = this.utilities.water.ongoingReadingDate ?
            `Date: ${this.formatDate(this.utilities.water.ongoingReadingDate)}` : 'Date: Not set';

        // Update last update timestamps
        const elecLastUpdate = document.getElementById('electricityLastUpdate');
        const waterLastUpdate = document.getElementById('waterLastUpdate');
        if (elecLastUpdate && this.utilities.electricity.ongoingReadingDate) {
            elecLastUpdate.textContent = this.formatDate(this.utilities.electricity.ongoingReadingDate);
        }
        if (waterLastUpdate && this.utilities.water.ongoingReadingDate) {
            waterLastUpdate.textContent = this.formatDate(this.utilities.water.ongoingReadingDate);
        }

        // Legacy update for settings modal if present
        const elecRate = document.getElementById('electricityRate');
        const elecThreshold = document.getElementById('electricityThreshold');
        const waterRate = document.getElementById('waterRate');

        if (elecRate) elecRate.value = this.utilities.electricity.rate;
        if (elecThreshold) elecThreshold.value = this.utilities.electricity.threshold;
        if (waterRate) waterRate.value = this.utilities.water.rate;

        // Update summary cards
        const monthCosts = this.getCurrentMonthCost();
        const elecCostDisplay = document.getElementById('electricityCost');
        const waterCostDisplay = document.getElementById('waterCost');
        const totalUtilCost = document.getElementById('totalUtilityCost');

        if (elecCostDisplay && typeof ExchangeRateService !== 'undefined') {
            elecCostDisplay.textContent = ExchangeRateService.format(monthCosts.electricity, 'THB');
        }
        if (waterCostDisplay && typeof ExchangeRateService !== 'undefined') {
            waterCostDisplay.textContent = ExchangeRateService.format(monthCosts.water, 'THB');
        }
        if (totalUtilCost && typeof ExchangeRateService !== 'undefined') {
            totalUtilCost.textContent = ExchangeRateService.format(monthCosts.total, 'THB');
        }
    },

    /**
     * Format date for display
     */
    formatDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    },

    /**
     * Handle electricity form submission (legacy)
     */
    handleElectricitySubmit(event) {
        event.preventDefault();
        const form = event.target;

        const date = form.elements['elecDate'].value;
        const previous = parseFloat(form.elements['elecPrevious'].value);
        const current = parseFloat(form.elements['elecCurrent'].value);

        if (!date || isNaN(previous) || isNaN(current)) {
            App.showToast('Please fill in all fields', 'error');
            return;
        }

        if (current < previous) {
            App.showToast('Current reading must be greater than previous', 'error');
            return;
        }

        this.addElectricityReading(date, previous, current);
        App.showToast('Electricity reading added', 'success');
        form.reset();
    },

    /**
     * Handle water form submission (legacy)
     */
    handleWaterSubmit(event) {
        event.preventDefault();
        const form = event.target;

        const date = form.elements['waterDate'].value;
        const previous = parseFloat(form.elements['waterPrevious'].value);
        const current = parseFloat(form.elements['waterCurrent'].value);

        if (!date || isNaN(previous) || isNaN(current)) {
            App.showToast('Please fill in all fields', 'error');
            return;
        }

        if (current < previous) {
            App.showToast('Current reading must be greater than previous', 'error');
            return;
        }

        this.addWaterReading(date, previous, current);
        App.showToast('Water reading added', 'success');
        form.reset();
    },

    /**
     * Save rate settings
     */
    saveRates() {
        const elecRate = parseFloat(document.getElementById('electricityRate').value);
        const elecThreshold = parseFloat(document.getElementById('electricityThreshold').value);
        const waterRate = parseFloat(document.getElementById('waterRate').value);

        if (!isNaN(elecRate)) this.setElectricityRate(elecRate);
        if (!isNaN(elecThreshold)) this.setElectricityThreshold(elecThreshold);
        if (!isNaN(waterRate)) this.setWaterRate(waterRate);

        App.showToast('Utility rates saved', 'success');
    }
};
