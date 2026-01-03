/**
 * Hans Financial Note - Utilities Tracking Module
 * Handles electricity and water utility consumption tracking
 */

const UtilitiesManager = {
    utilities: null,

    /**
     * Initialize utilities manager
     */
    init() {
        this.utilities = DataManager.getUtilities();
        this.updateUI();
    },

    /**
     * Add electricity reading
     */
    addElectricityReading(date, previous, current) {
        const usage = current - previous;
        const rate = this.utilities.electricity.rate;
        const threshold = this.utilities.electricity.threshold;

        let cost;
        if (usage <= threshold) {
            cost = 0; // Free under threshold
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

        // Create automatic expense transaction if cost > 0
        if (cost > 0) {
            DataManager.addTransaction({
                type: 'expense',
                category: 'Utilities',
                amount: cost,
                currency: 'THB',
                description: `Electricity bill: ${usage} kWh`,
                date: date,
                utilityId: reading.id,
                utilityType: 'electricity'
            });
        }

        this.updateUI();
        return reading;
    },

    /**
     * Add water reading
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

        // Create automatic expense transaction
        if (cost > 0) {
            DataManager.addTransaction({
                type: 'expense',
                category: 'Utilities',
                amount: cost,
                currency: 'THB',
                description: `Water bill: ${usage} units`,
                date: date,
                utilityId: reading.id,
                utilityType: 'water'
            });
        }

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
        // Update electricity section
        const elecRate = document.getElementById('electricityRate');
        const elecThreshold = document.getElementById('electricityThreshold');
        const elecTable = document.getElementById('electricityReadings');

        if (elecRate) elecRate.value = this.utilities.electricity.rate;
        if (elecThreshold) elecThreshold.value = this.utilities.electricity.threshold;

        if (elecTable) {
            elecTable.innerHTML = this.utilities.electricity.readings
                .slice(0, 5)
                .map(r => `
                    <tr>
                        <td>${this.formatDate(r.date)}</td>
                        <td>${r.previous}</td>
                        <td>${r.current}</td>
                        <td>${r.usage} kWh</td>
                        <td>${ExchangeRateService.format(r.cost, 'THB')}</td>
                        <td>
                            <button class="btn btn-small btn-danger" onclick="UtilitiesManager.deleteElectricityReading('${r.id}')">
                                Delete
                            </button>
                        </td>
                    </tr>
                `).join('');
        }

        // Update water section
        const waterRate = document.getElementById('waterRate');
        const waterTable = document.getElementById('waterReadings');

        if (waterRate) waterRate.value = this.utilities.water.rate;

        if (waterTable) {
            waterTable.innerHTML = this.utilities.water.readings
                .slice(0, 5)
                .map(r => `
                    <tr>
                        <td>${this.formatDate(r.date)}</td>
                        <td>${r.previous}</td>
                        <td>${r.current}</td>
                        <td>${r.usage} units</td>
                        <td>${ExchangeRateService.format(r.cost, 'THB')}</td>
                        <td>
                            <button class="btn btn-small btn-danger" onclick="UtilitiesManager.deleteWaterReading('${r.id}')">
                                Delete
                            </button>
                        </td>
                    </tr>
                `).join('');
        }

        // Update summary cards
        const monthCosts = this.getCurrentMonthCost();
        const elecCostDisplay = document.getElementById('electricityCost');
        const waterCostDisplay = document.getElementById('waterCost');
        const totalUtilCost = document.getElementById('totalUtilityCost');

        if (elecCostDisplay) elecCostDisplay.textContent = ExchangeRateService.format(monthCosts.electricity, 'THB');
        if (waterCostDisplay) waterCostDisplay.textContent = ExchangeRateService.format(monthCosts.water, 'THB');
        if (totalUtilCost) totalUtilCost.textContent = ExchangeRateService.format(monthCosts.total, 'THB');
    },

    /**
     * Format date for display
     */
    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    },

    /**
     * Handle electricity form submission
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
     * Handle water form submission
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
