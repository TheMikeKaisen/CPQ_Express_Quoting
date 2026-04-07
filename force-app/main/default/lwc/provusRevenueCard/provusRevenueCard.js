import { LightningElement, api } from 'lwc';

export default class ProvusRevenueCard extends LightningElement {

    @api label      = '';
    @api icon       = '';
    @api revenue    = 0;
    @api cost       = 0;
    @api margin     = 0;
    @api percentage = 0;
    @api itemCount  = 0;
    @api countLabel = 'items';

    // ── Formatted values ──────────────────────────────────────────────────
    formatCurrency(value) {
        if (value == null) return '$0.00';
        return '$' + Number(value).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    get formattedRevenue() {
        return this.formatCurrency(this.revenue);
    }
    get formattedCost() {
        return this.formatCurrency(this.cost);
    }
    get formattedMargin() {
        return this.formatCurrency(this.margin);
    }
    get percentageDisplay() {
        const pct = Number(this.percentage || 0).toFixed(1);
        const arrow = this.percentage >= 0 ? '↗' : '↘';
        return arrow + ' ' + pct + '%';
    }
    get percentageClass() {
        return Number(this.percentage || 0) >= 0
            ? 'card-pct pct-positive'
            : 'card-pct pct-negative';
    }
}