/**
 * Hans Financial Note - Charts Module
 * Handles all Chart.js visualizations
 */

const ChartsManager = {
    charts: {},

    /**
     * Initialize all charts
     */
    init() {
        // Wait for Chart.js to load
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js not loaded');
            return;
        }

        this.initExpenseChart();
        this.initIncomeChart();
        this.initTrendChart();
        this.initInvestmentChart();
    },

    /**
     * Destroy a chart if it exists
     */
    destroyChart(name) {
        if (this.charts[name]) {
            this.charts[name].destroy();
            this.charts[name] = null;
        }
    },

    /**
     * Initialize expense breakdown chart
     */
    initExpenseChart() {
        const canvas = document.getElementById('expenseChart');
        if (!canvas) return;

        this.destroyChart('expense');

        const stats = TransactionsManager.getCategoryStats('expense', 'month');
        const categories = Object.keys(stats);
        const amounts = categories.map(c => stats[c].total);

        const colors = this.generateColors(categories.length);

        this.charts.expense = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: categories,
                datasets: [{
                    data: amounts,
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const value = context.raw;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${context.label}: ${ExchangeRateService.format(value, 'THB')} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    },

    /**
     * Initialize income breakdown chart
     */
    initIncomeChart() {
        const canvas = document.getElementById('incomeChart');
        if (!canvas) return;

        this.destroyChart('income');

        const stats = TransactionsManager.getCategoryStats('income', 'month');
        const categories = Object.keys(stats);
        const amounts = categories.map(c => stats[c].total);

        const colors = this.generateColors(categories.length, 120); // Green hue

        this.charts.income = new Chart(canvas, {
            type: 'pie',
            data: {
                labels: categories,
                datasets: [{
                    data: amounts,
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const value = context.raw;
                                return `${context.label}: ${ExchangeRateService.format(value, 'THB')}`;
                            }
                        }
                    }
                }
            }
        });
    },

    /**
     * Initialize spending trend chart
     */
    initTrendChart() {
        const canvas = document.getElementById('trendChart');
        if (!canvas) return;

        this.destroyChart('trend');

        const trendData = BudgetManager.getSpendingTrend();
        const labels = trendData.map(d => d.label);
        const spending = trendData.map(d => d.spending);
        const budgetLine = trendData.map(() => DataManager.getBudget().monthlyBudget);

        this.charts.trend = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Spending',
                        data: spending,
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231, 76, 60, 0.1)',
                        fill: true,
                        tension: 0.3
                    },
                    {
                        label: 'Budget',
                        data: budgetLine,
                        borderColor: '#3498db',
                        borderDash: [5, 5],
                        fill: false,
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return `${context.dataset.label}: ${ExchangeRateService.format(context.raw, 'THB')}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => ExchangeRateService.format(value, 'THB')
                        }
                    }
                }
            }
        });
    },

    /**
     * Initialize investment projection chart
     */
    initInvestmentChart() {
        const canvas = document.getElementById('investmentChart');
        if (!canvas) return;

        this.destroyChart('investment');

        const projectionData = InvestmentsManager.getProjectionData();
        const labels = projectionData.map(d => `${d.year}Y`);
        const values = projectionData.map(d => d.value);
        const invested = projectionData.map(d => d.invested);

        this.charts.investment = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Invested',
                        data: invested,
                        backgroundColor: '#3498db',
                        stack: 'stack'
                    },
                    {
                        label: 'Returns',
                        data: values.map((v, i) => v - invested[i]),
                        backgroundColor: '#2ecc71',
                        stack: 'stack'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            afterBody: (context) => {
                                const index = context[0].dataIndex;
                                return `Total: ${ExchangeRateService.format(values[index], 'THB')}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        stacked: true
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => {
                                if (value >= 1000000) {
                                    return (value / 1000000).toFixed(1) + 'M';
                                } else if (value >= 1000) {
                                    return (value / 1000).toFixed(0) + 'K';
                                }
                                return value;
                            }
                        }
                    }
                }
            }
        });
    },

    /**
     * Generate colors for charts
     */
    generateColors(count, startHue = 0) {
        const colors = [];
        for (let i = 0; i < count; i++) {
            const hue = (startHue + (i * 360 / count)) % 360;
            colors.push(`hsl(${hue}, 70%, 60%)`);
        }
        return colors;
    },

    /**
     * Update all charts
     */
    updateAll() {
        this.initExpenseChart();
        this.initIncomeChart();
        this.initTrendChart();
        this.initInvestmentChart();
    },

    /**
     * Resize charts (call on window resize)
     */
    resize() {
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.resize();
        });
    }
};

// Listen for window resize
window.addEventListener('resize', () => {
    ChartsManager.resize();
});
