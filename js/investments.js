/**
 * Hans Financial Note - Investments Module
 * Handles investment portfolio tracking and projections
 */

const InvestmentsManager = {
    investments: null,

    /**
     * Initialize investments manager
     */
    init() {
        this.investments = DataManager.getInvestments();
        this.updateUI();
    },

    /**
     * Set investment allocation percentage
     */
    setAllocation(percentage) {
        this.investments.allocation = parseFloat(percentage);
        DataManager.saveInvestments(this.investments);
        this.updateUI();
    },

    /**
     * Set stock percentage
     */
    setStockPercentage(percentage) {
        this.investments.stockPercentage = parseFloat(percentage);
        this.investments.cryptoPercentage = 100 - this.investments.stockPercentage;
        DataManager.saveInvestments(this.investments);
        this.updateUI();
    },

    /**
     * Set crypto percentage
     */
    setCryptoPercentage(percentage) {
        this.investments.cryptoPercentage = parseFloat(percentage);
        this.investments.stockPercentage = 100 - this.investments.cryptoPercentage;
        DataManager.saveInvestments(this.investments);
        this.updateUI();
    },

    /**
     * Set expected stock return
     */
    setStockReturn(percentage) {
        this.investments.stockReturn = parseFloat(percentage);
        DataManager.saveInvestments(this.investments);
        this.updateUI();
    },

    /**
     * Set expected crypto return
     */
    setCryptoReturn(percentage) {
        this.investments.cryptoReturn = parseFloat(percentage);
        DataManager.saveInvestments(this.investments);
        this.updateUI();
    },

    /**
     * Get monthly investment amount
     */
    getMonthlyInvestment() {
        const budget = DataManager.getBudget();
        const monthlyIncome = budget.annualIncome / 12;
        return (monthlyIncome * this.investments.allocation) / 100;
    },

    /**
     * Get stock investment amount
     */
    getStockInvestment() {
        const monthly = this.getMonthlyInvestment();
        return (monthly * this.investments.stockPercentage) / 100;
    },

    /**
     * Get crypto investment amount
     */
    getCryptoInvestment() {
        const monthly = this.getMonthlyInvestment();
        return (monthly * this.investments.cryptoPercentage) / 100;
    },

    /**
     * Calculate weighted average return
     */
    getWeightedReturn() {
        const stockWeight = this.investments.stockPercentage / 100;
        const cryptoWeight = this.investments.cryptoPercentage / 100;
        return (stockWeight * this.investments.stockReturn) + (cryptoWeight * this.investments.cryptoReturn);
    },

    /**
     * Project future value
     */
    projectValue(years) {
        const monthlyInvestment = this.getMonthlyInvestment();
        const monthlyRate = this.getWeightedReturn() / 100 / 12;
        const months = years * 12;

        // Future Value of Annuity formula
        if (monthlyRate === 0) {
            return monthlyInvestment * months;
        }

        const fv = monthlyInvestment * (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate;
        return fv;
    },

    /**
     * Get projection data for chart
     */
    getProjectionData() {
        const data = [];
        const years = [1, 5, 10, 15, 20, 25, 30];

        years.forEach(year => {
            data.push({
                year: year,
                value: this.projectValue(year),
                invested: this.getMonthlyInvestment() * year * 12
            });
        });

        return data;
    },

    /**
     * Calculate FIRE number
     */
    getFIRENumber() {
        const budget = DataManager.getBudget();
        const annualExpenses = budget.monthlyBudget * 12;
        // Using 4% rule
        return annualExpenses * 25;
    },

    /**
     * Calculate years to FIRE
     */
    getYearsToFIRE() {
        const fireNumber = this.getFIRENumber();
        const monthlyInvestment = this.getMonthlyInvestment();
        const monthlyRate = this.getWeightedReturn() / 100 / 12;

        if (monthlyRate <= 0 || monthlyInvestment <= 0) {
            return Infinity;
        }

        // Solve for n in FV formula
        // fireNumber = monthlyInvestment * ((1 + r)^n - 1) / r
        const n = Math.log(1 + (fireNumber * monthlyRate / monthlyInvestment)) / Math.log(1 + monthlyRate);
        return n / 12; // Convert months to years
    },

    /**
     * Update UI with investment data
     */
    updateUI() {
        const monthlyInvestment = this.getMonthlyInvestment();
        const stockAmount = this.getStockInvestment();
        const cryptoAmount = this.getCryptoInvestment();
        const weightedReturn = this.getWeightedReturn();
        const fireNumber = this.getFIRENumber();
        const yearsToFire = this.getYearsToFIRE();

        // Update displays
        const monthlyDisplay = document.getElementById('monthlyInvestment');
        const stockDisplay = document.getElementById('stockInvestment');
        const cryptoDisplay = document.getElementById('cryptoInvestment');
        const returnDisplay = document.getElementById('weightedReturn');
        const fireDisplay = document.getElementById('fireNumber');
        const yearsDisplay = document.getElementById('yearsToFire');

        if (monthlyDisplay) {
            monthlyDisplay.textContent = ExchangeRateService.format(monthlyInvestment, 'THB');
        }

        if (stockDisplay) {
            stockDisplay.textContent = ExchangeRateService.format(stockAmount, 'THB');
        }

        if (cryptoDisplay) {
            cryptoDisplay.textContent = ExchangeRateService.format(cryptoAmount, 'THB');
        }

        if (returnDisplay) {
            returnDisplay.textContent = `${weightedReturn.toFixed(2)}%`;
        }

        if (fireDisplay) {
            fireDisplay.textContent = ExchangeRateService.format(fireNumber, 'THB');
        }

        if (yearsDisplay) {
            if (yearsToFire === Infinity || isNaN(yearsToFire)) {
                yearsDisplay.textContent = 'N/A';
            } else {
                yearsDisplay.textContent = `${yearsToFire.toFixed(1)} years`;
            }
        }

        // Update input fields
        const allocationInput = document.getElementById('investmentAllocation');
        const stockInput = document.getElementById('stockPercentage');
        const cryptoInput = document.getElementById('cryptoPercentage');
        const stockReturnInput = document.getElementById('stockReturn');
        const cryptoReturnInput = document.getElementById('cryptoReturn');

        if (allocationInput) allocationInput.value = this.investments.allocation;
        if (stockInput) stockInput.value = this.investments.stockPercentage;
        if (cryptoInput) cryptoInput.value = this.investments.cryptoPercentage;
        if (stockReturnInput) stockReturnInput.value = this.investments.stockReturn;
        if (cryptoReturnInput) cryptoReturnInput.value = this.investments.cryptoReturn;

        // Update projection table
        this.updateProjectionTable();
    },

    /**
     * Update projection table
     */
    updateProjectionTable() {
        const tbody = document.getElementById('projectionTableBody');
        if (!tbody) return;

        const data = this.getProjectionData();

        tbody.innerHTML = data.map(row => `
            <tr>
                <td>${row.year} year${row.year > 1 ? 's' : ''}</td>
                <td>${ExchangeRateService.format(row.invested, 'THB')}</td>
                <td>${ExchangeRateService.format(row.value, 'THB')}</td>
                <td class="text-success">+${ExchangeRateService.format(row.value - row.invested, 'THB')}</td>
            </tr>
        `).join('');
    },

    /**
     * Handle form submission
     */
    handleSubmit(event) {
        event.preventDefault();
        const form = event.target;

        const allocation = parseFloat(form.elements['investmentAllocation'].value);
        const stockPercentage = parseFloat(form.elements['stockPercentage'].value);
        const stockReturn = parseFloat(form.elements['stockReturn'].value);
        const cryptoReturn = parseFloat(form.elements['cryptoReturn'].value);

        if (!isNaN(allocation)) this.investments.allocation = allocation;
        if (!isNaN(stockPercentage)) {
            this.investments.stockPercentage = stockPercentage;
            this.investments.cryptoPercentage = 100 - stockPercentage;
        }
        if (!isNaN(stockReturn)) this.investments.stockReturn = stockReturn;
        if (!isNaN(cryptoReturn)) this.investments.cryptoReturn = cryptoReturn;

        DataManager.saveInvestments(this.investments);
        this.updateUI();

        App.showToast('Investment settings saved', 'success');
    },

    /**
     * Get portfolio summary
     */
    getPortfolioSummary() {
        return {
            monthlyInvestment: this.getMonthlyInvestment(),
            stockAmount: this.getStockInvestment(),
            cryptoAmount: this.getCryptoInvestment(),
            stockPercentage: this.investments.stockPercentage,
            cryptoPercentage: this.investments.cryptoPercentage,
            expectedReturn: this.getWeightedReturn(),
            projection5Year: this.projectValue(5),
            projection10Year: this.projectValue(10),
            fireNumber: this.getFIRENumber(),
            yearsToFire: this.getYearsToFIRE()
        };
    }
};
