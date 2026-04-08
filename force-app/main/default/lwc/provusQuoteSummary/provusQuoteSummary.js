import { LightningElement, api, track, wire } from 'lwc';
import getLineItemSummary from
    '@salesforce/apex/QuoteLineItemController.getLineItemSummary';
import getLineItemsByPhase from
    '@salesforce/apex/QuoteLineItemController.getLineItemsByPhase';

export default class ProvusQuoteSummary extends LightningElement {

    @api quote   = null;
    @api quoteId = '';

    @track summaryData = {};
    @track phaseData   = [];
    @track isLoading   = true;
    @track showAuditHistory = false;

    // ── Wire summary data ─────────────────────────────────────────────────
    @wire(getLineItemSummary, { quoteId: '$quoteId' })
    wiredSummary({ data, error }) {
        this.isLoading = false;
        if (data)  this.summaryData = data;
        if (error) console.error('Summary error:', error);
    }

    // ── Wire phase data ───────────────────────────────────────────────────
    @wire(getLineItemsByPhase, { quoteId: '$quoteId' })
    wiredPhases({ data, error }) {
        if (data)  this.phaseData = data;
        if (error) console.error('Phase error:', error);
    }

    // ── Quote metadata getters ────────────────────────────────────────────
    get opportunityName() {
        return this.quote && this.quote.Opportunity
            ? this.quote.Opportunity.Name : 'Not selected';
    }
    get accountName() {
        if (!this.quote) return '-';
        if (this.quote.Account) return this.quote.Account.Name;
        if (this.quote.QuoteAccount) return this.quote.QuoteAccount.Name;
        return '-';
    }
    get createdByName() {
        return this.quote && this.quote.CreatedBy
            ? this.quote.CreatedBy.Name : '-';
    }
    get lastModifiedByName() {
        return this.quote && this.quote.LastModifiedBy
            ? this.quote.LastModifiedBy.Name : '-';
    }
    get formattedValidUntil() {
        if (!this.quote || !this.quote.ExpirationDate) return '-';
        return new Date(this.quote.ExpirationDate)
            .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    get formattedCreatedDate() {
        if (!this.quote || !this.quote.CreatedDate) return '-';
        return new Date(this.quote.CreatedDate)
            .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    get timePeriod() {
        return this.quote && this.quote.Time_Period__c
            ? this.quote.Time_Period__c : '-';
    }

    // ── Revenue card data ─────────────────────────────────────────────────
    getSummaryType(type) {
        return this.summaryData && this.summaryData[type]
            ? this.summaryData[type] : {};
    }

    get grandTotal() {
        return Number(this.summaryData.grandTotal || 0);
    }

    // Labor
    get laborRevenue()    { return this.getSummaryType('Resource Role').revenue || 0; }
    get laborCost()       { return this.getSummaryType('Resource Role').cost || 0; }
    get laborMargin()     { return this.getSummaryType('Resource Role').margin || 0; }
    get laborCount()      { return this.getSummaryType('Resource Role').count || 0; }
    get laborPercentage() { return this.getSummaryType('Resource Role').percentage || 0; }

    // Products
    get productRevenue()    { return this.getSummaryType('Product').revenue || 0; }
    get productCost()       { return this.getSummaryType('Product').cost || 0; }
    get productMargin()     { return this.getSummaryType('Product').margin || 0; }
    get productCount()      { return this.getSummaryType('Product').count || 0; }
    get productPercentage() { return this.getSummaryType('Product').percentage || 0; }

    // Add-ons
    get addonRevenue()    { return this.getSummaryType('Add-on').revenue || 0; }
    get addonCost()       { return this.getSummaryType('Add-on').cost || 0; }
    get addonMargin()     { return this.getSummaryType('Add-on').margin || 0; }
    get addonCount()      { return this.getSummaryType('Add-on').count || 0; }
    get addonPercentage() { return this.getSummaryType('Add-on').percentage || 0; }

    // ── Chart helpers ─────────────────────────────────────────────────────
    formatAxisLabel(val) {
        const abs = Math.abs(val);
        if (abs >= 1000) return (val / 1000).toFixed(0) + 'K';
        return val.toFixed(0);
    }

    generateYLabels(maxVal, minVal) {
        // Generate 4-5 nice labels spanning from min to max
        const range = maxVal - minVal;
        if (range === 0) return [{ key: '0', text: '0' }];

        // Round step to a "nice" number
        const rawStep = range / 4;
        const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
        const niceStep = Math.ceil(rawStep / magnitude) * magnitude;

        const labels = [];
        const adjustedMax = Math.ceil(maxVal / niceStep) * niceStep;
        const adjustedMin = Math.min(0, Math.floor(minVal / niceStep) * niceStep);

        for (let v = adjustedMax; v >= adjustedMin; v -= niceStep) {
            labels.push({ key: 'y-' + v, text: this.formatAxisLabel(v) });
        }
        return labels;
    }

    buildChartBar(label, cost, margin, chartMax) {
        const maxH = 200; // max pixel height in css
        const absMax = Math.max(Math.abs(chartMax), 1);

        // Calculate pixel heights (can be negative for margin)
        const costH   = Math.max(2, Math.round((Math.abs(cost) / absMax) * maxH));
        const marginH = Math.max(2, Math.round((Math.abs(margin) / absMax) * maxH));

        return {
            label,
            costStyle:   'height:' + costH + 'px',
            marginStyle: 'height:' + marginH + 'px',
            costLabel:   '$' + Number(cost).toLocaleString('en-US', { minimumFractionDigits: 2 }),
            marginLabel: '$' + Number(margin).toLocaleString('en-US', { minimumFractionDigits: 2 }),
            totalLabel:  '$' + Number(cost + margin).toFixed(0)
        };
    }

    // ── Item Type Chart ───────────────────────────────────────────────────
    get typeChartMax() {
        return Math.max(
            Math.abs(this.laborCost), Math.abs(this.laborMargin),
            Math.abs(this.productCost), Math.abs(this.productMargin),
            Math.abs(this.addonCost), Math.abs(this.addonMargin),
            1
        );
    }

    get typeChartMin() {
        return Math.min(
            0, this.laborCost, this.laborMargin,
            this.productCost, this.productMargin,
            this.addonCost, this.addonMargin
        );
    }

    get typeYLabels() {
        return this.generateYLabels(this.typeChartMax, this.typeChartMin);
    }

    get chartData() {
        const max = this.typeChartMax;
        return [
            this.buildChartBar('Labor', this.laborCost, this.laborMargin, max),
            this.buildChartBar('Products', this.productCost, this.productMargin, max),
            this.buildChartBar('Add-ons', this.addonCost, this.addonMargin, max)
        ];
    }

    // ── Phase Chart ───────────────────────────────────────────────────────
    get phaseChartMax() {
        if (!this.phaseData || !this.phaseData.length) return 1;
        return Math.max(
            ...this.phaseData.map(p => {
                const total = Number(p.total || 0);
                return Math.max(total * 0.55, total * 0.45);
            }),
            1
        );
    }

    get phaseYLabels() {
        return this.generateYLabels(this.phaseChartMax, 0);
    }

    get phaseChartData() {
        if (!this.phaseData || !this.phaseData.length) return [];
        const max = this.phaseChartMax;
        return this.phaseData.map(p => {
            const total  = Number(p.total || 0);
            const cost   = total * 0.45;
            const margin = total - cost;
            return this.buildChartBar(p.phase || 'Default', cost, margin, max);
        });
    }

    // ── Phase table ───────────────────────────────────────────────────────
    get hasPhases() {
        return this.phaseData && this.phaseData.length > 0;
    }

    get phaseRows() {
        return this.phaseData.map(p => ({
            phase:             p.phase || 'Default',
            laborFormatted:    this.fmt(p.labor),
            productsFormatted: this.fmt(p.products),
            addonsFormatted:   this.fmtDash(p.addons),
            totalFormatted:    this.fmtTotal(p.total),
            items:             p.items || 0
        }));
    }

    fmt(value) {
        if (!value || value === 0) return '—';
        return '$' + Number(value).toLocaleString('en-US', {
            minimumFractionDigits: 2, maximumFractionDigits: 2
        });
    }

    fmtDash(value) {
        if (!value || value === 0) return '—';
        return '$' + Number(value).toLocaleString('en-US', {
            minimumFractionDigits: 2, maximumFractionDigits: 2
        });
    }

    fmtTotal(value) {
        if (!value && value !== 0) return '$0.00';
        return '$' + Number(value).toLocaleString('en-US', {
            minimumFractionDigits: 2, maximumFractionDigits: 2
        });
    }

    // ── Cost Change Audit ─────────────────────────────────────────────────
    get auditCount() { return 0; }

    get auditChevronClass() {
        return this.showAuditHistory ? 'chevron chevron-up' : 'chevron';
    }

    toggleAuditHistory() {
        this.showAuditHistory = !this.showAuditHistory;
    }
}