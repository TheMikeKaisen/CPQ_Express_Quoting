import { LightningElement, api, track, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getQuoteById from
    '@salesforce/apex/QuoteController.getQuoteById';
import getLineItemSummary from
    '@salesforce/apex/QuoteLineItemController.getLineItemSummary';
import updateQuote from
    '@salesforce/apex/QuoteController.updateQuote';
import submitForApproval from
    '@salesforce/apex/QuoteController.submitForApproval';
import approveQuote from
    '@salesforce/apex/QuoteController.approveQuote';
import rejectQuote from
    '@salesforce/apex/QuoteController.rejectQuote';
import recallQuote from
    '@salesforce/apex/QuoteController.recallQuote';

export default class ProvusQuoteDetail extends LightningElement {

    @api quoteId;

    @track quote = null;
    @track isLoading = true;
    @track isEditingName = false;
    @track activeTab = 'lineItems'; // default tab
    @track errorMessage = '';
    @track editedName = '';

    wiredQuoteResult = undefined;
    wiredSummaryResult = undefined;
    @track dynamicSubtotal = 0;
    @track dynamicTotal = 0;

    // ── Wire quote data ───────────────────────────────────────────────────
    @wire(getQuoteById, { quoteId: '$quoteId' })
    wiredQuote(result) {
        this.wiredQuoteResult = result;
        this.isLoading = false;
        if (result.data) {
            this.quote = result.data;
            this.editedName = result.data.Name;
            this.errorMessage = '';
        } else if (result.error) {
            this.errorMessage = 'Error loading quote.';
            console.error('Quote error:', result.error);
        }
    }

    // ── Wire line item summary ────────────────────────────────────────────
    @wire(getLineItemSummary, { quoteId: '$quoteId' })
    wiredSummary(result) {
        this.wiredSummaryResult = result;
        if (result.data) {
            this.dynamicSubtotal = result.data.subtotal || 0;
            this.dynamicTotal = result.data.grandTotal || 0;
        } else if (result.error) {
            console.error('Summary error:', result.error);
        }
    }

    // ── Status computed booleans ──────────────────────────────────────────
    get isDraft() {
        return this.quote && this.quote.Status === 'Draft';
    }
    get isPending() {
        return this.quote &&
            this.quote.Status === 'Pending Approval';
    }
    get isApproved() {
        return this.quote && this.quote.Status === 'Approved';
    }
    get isRejected() {
        return this.quote && this.quote.Status === 'Rejected';
    }

    // ── Tab CSS classes ───────────────────────────────────────────────────
    get summaryTabClass() {
        return this.activeTab === 'summary'
            ? 'tab-btn tab-btn-active' : 'tab-btn';
    }
    get lineItemsTabClass() {
        return this.activeTab === 'lineItems'
            ? 'tab-btn tab-btn-active' : 'tab-btn';
    }
    get timelineTabClass() {
        return this.activeTab === 'timeline'
            ? 'tab-btn tab-btn-active' : 'tab-btn';
    }
    get pdfsTabClass() {
        return this.activeTab === 'pdfs'
            ? 'tab-btn tab-btn-active' : 'tab-btn';
    }

    // ── Tab visibility ────────────────────────────────────────────────────
    get showSummary() { return this.activeTab === 'summary'; }
    get showLineItems() { return this.activeTab === 'lineItems'; }
    get showTimeline() { return this.activeTab === 'timeline'; }
    get showPdfs() { return this.activeTab === 'pdfs'; }

    get formattedTotal() {
        return this.formatCurrency(this.dynamicTotal);
    }

    // Helper for currency
    formatCurrency(value) {
        return '$' + Number(value).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    get formattedSubtotal() {
        return this.formatCurrency(this.dynamicSubtotal);
    }

    get formattedMargin() {
        if (!this.quote) return '$0.00 (0%)';
        const amt = this.quote.Margin_Amount__c || 0;
        const pct = this.quote.Margin_Percent__c || 0;
        return '$' + Number(amt).toLocaleString('en-US', {
            minimumFractionDigits: 2
        }) + ' (' + Number(pct).toFixed(1) + '%)';
    }

    get formattedDiscount() {
        const amt = this.dynamicSubtotal - this.dynamicTotal;
        const pct = this.dynamicSubtotal > 0 ? (amt / this.dynamicSubtotal) * 100 : 0;
        if (amt === 0) return '$0.00 (0%)';
        return '-' + this.formatCurrency(amt) + ' (-' + Number(pct).toFixed(1) + '%)';
    }

    get formattedStartDate() {
        if (!this.quote || !this.quote.Start_Date__c) return '-';
        return new Date(this.quote.Start_Date__c)
            .toLocaleDateString('en-US');
    }

    get formattedEndDate() {
        if (!this.quote || !this.quote.End_Date__c) return '-';
        return new Date(this.quote.End_Date__c)
            .toLocaleDateString('en-US');
    }

    // ── Tab click ─────────────────────────────────────────────────────────
    handleTabClick(event) {
        this.activeTab = event.currentTarget.dataset.tab;
    }

    // ── Back to quotes list ───────────────────────────────────────────────
    handleBack() {
        this.dispatchEvent(new CustomEvent('back'));
    }

    // ── Name editing ──────────────────────────────────────────────────────
    handleEditName() {
        this.isEditingName = true;
    }

    handleNameChange(event) {
        this.editedName = event.target.value;
    }

    handleNameKeyDown(event) {
        // Save on Enter key
        if (event.key === 'Enter') {
            this.handleNameSave();
        }
        // Cancel on Escape key
        if (event.key === 'Escape') {
            this.isEditingName = false;
            this.editedName = this.quote.Name;
        }
    }

    handleNameSave() {
        this.isEditingName = false;
        if (this.editedName === this.quote.Name) return;

        updateQuote({
            quote: {
                Id: this.quoteId,
                Name: this.editedName
            }
        })
            .then(() => {
                refreshApex(this.wiredQuoteResult);
            })
            .catch(error => {
                console.error('Name update error:', error);
                this.editedName = this.quote.Name;
            });
    }

    // ── Save button ───────────────────────────────────────────────────────
    handleSave() {
        refreshApex(this.wiredQuoteResult);
    }

    // ── Refresh ───────────────────────────────────────────────────────────
    handleRefresh() {
        if (this.wiredQuoteResult) {
            refreshApex(this.wiredQuoteResult);
        }
    }

    // ── Line items updated → refresh quote totals ─────────────────────────
    handleLineItemsUpdated() {
        if (this.wiredQuoteResult) refreshApex(this.wiredQuoteResult);
        if (this.wiredSummaryResult) refreshApex(this.wiredSummaryResult);
    }

    // ── Submit for approval ───────────────────────────────────────────────
    handleSubmit() {
        submitForApproval({
            quoteId: this.quoteId,
            comment: 'Submitted for approval'
        })
            .then(() => {
                refreshApex(this.wiredQuoteResult);
            })
            .catch(error => {
                console.error('Submit error:', error);
            });
    }

    // ── Approve ───────────────────────────────────────────────────────────
    handleApprove() {
        approveQuote({ quoteId: this.quoteId })
            .then(() => {
                refreshApex(this.wiredQuoteResult);
            })
            .catch(error => {
                console.error('Approve error:', error);
            });
    }

    // ── Reject ────────────────────────────────────────────────────────────
    handleReject() {
        rejectQuote({
            quoteId: this.quoteId,
            reason: 'Rejected by manager'
        })
            .then(() => {
                refreshApex(this.wiredQuoteResult);
            })
            .catch(error => {
                console.error('Reject error:', error);
            });
    }

    // ── Recall ────────────────────────────────────────────────────────────
    handleRecall() {
        recallQuote({ quoteId: this.quoteId })
            .then(() => {
                refreshApex(this.wiredQuoteResult);
            })
            .catch(error => {
                console.error('Recall error:', error);
            });
    }
}