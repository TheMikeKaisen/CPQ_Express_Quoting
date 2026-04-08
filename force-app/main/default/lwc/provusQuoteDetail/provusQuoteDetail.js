import { LightningElement, api, track, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getQuoteById from '@salesforce/apex/QuoteController.getQuoteById';
import getLineItemSummary from '@salesforce/apex/QuoteLineItemController.getLineItemSummary';
import getQuoteDocuments from '@salesforce/apex/QuotePdfController.getQuoteDocuments';
import getDocumentHtml from '@salesforce/apex/QuotePdfController.getDocumentHtml';
import deleteQuoteDocument from '@salesforce/apex/QuotePdfController.deleteQuoteDocument';
import updateQuote from '@salesforce/apex/QuoteController.updateQuote';
import submitForApproval from '@salesforce/apex/QuoteController.submitForApproval';
import approveQuote from '@salesforce/apex/QuoteController.approveQuote';
import rejectQuote from '@salesforce/apex/QuoteController.rejectQuote';
import recallQuote from '@salesforce/apex/QuoteController.recallQuote';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class ProvusQuoteDetail extends LightningElement {

    @api quoteId;

    @track quote           = null;
    @track isLoading       = true;
    @track isEditingName   = false;
    @track activeTab       = 'lineItems';
    @track errorMessage    = '';
    @track editedName      = '';
    @track showPdfModal    = false;
    @track savedDocuments  = [];

    wiredQuoteResult   = undefined;
    wiredSummaryResult = undefined;
    wiredDocsResult    = undefined;

    @track dynamicSubtotal = 0;
    @track dynamicTotal    = 0;

    // ── Wire: quote ───────────────────────────────────────────────────────
    @wire(getQuoteById, { quoteId: '$quoteId' })
    wiredQuote(result) {
        this.wiredQuoteResult = result;
        this.isLoading = false;
        if (result.data) {
            this.quote      = result.data;
            this.editedName = result.data.Name;
            this.errorMessage = '';
        } else if (result.error) {
            this.errorMessage = 'Error loading quote.';
            console.error('Quote error:', result.error);
        }
    }

    // ── Wire: line item summary ───────────────────────────────────────────
    @wire(getLineItemSummary, { quoteId: '$quoteId' })
    wiredSummary(result) {
        this.wiredSummaryResult = result;
        if (result.data) {
            this.dynamicSubtotal = result.data.subtotal  || 0;
            this.dynamicTotal    = result.data.grandTotal || 0;
        }
    }

    // ── Wire: saved PDF documents ─────────────────────────────────────────
    @wire(getQuoteDocuments, { quoteId: '$quoteId' })
    wiredDocs(result) {
        this.wiredDocsResult = result;
        if (result.data) {
            this.savedDocuments = result.data.map(doc => ({
                ...doc,
                formattedDate: doc.Generated_Date__c
                    ? new Date(doc.Generated_Date__c).toLocaleString('en-US', {
                        month: 'short', day: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })
                    : ''
            }));
        }
    }

    // ── Status computed ───────────────────────────────────────────────────
    get isDraft()    { return this.quote && this.quote.Status === 'Draft'; }
    get isPending()  { return this.quote && this.quote.Status === 'Pending Approval'; }
    get isApproved() { return this.quote && this.quote.Status === 'Approved'; }
    get isRejected() { return this.quote && this.quote.Status === 'Rejected'; }

    // ── Tab CSS ───────────────────────────────────────────────────────────
    get summaryTabClass()   { return this.activeTab === 'summary'   ? 'tab-btn tab-btn-active' : 'tab-btn'; }
    get lineItemsTabClass() { return this.activeTab === 'lineItems' ? 'tab-btn tab-btn-active' : 'tab-btn'; }
    get timelineTabClass()  { return this.activeTab === 'timeline'  ? 'tab-btn tab-btn-active' : 'tab-btn'; }
    get pdfsTabClass()      { return this.activeTab === 'pdfs'      ? 'tab-btn tab-btn-active' : 'tab-btn'; }

    // ── Tab visibility ────────────────────────────────────────────────────
    get showSummary()   { return this.activeTab === 'summary';   }
    get showLineItems() { return this.activeTab === 'lineItems'; }
    get showTimeline()  { return this.activeTab === 'timeline';  }
    get showPdfs()      { return this.activeTab === 'pdfs';      }

    get hasSavedDocuments() { return this.savedDocuments && this.savedDocuments.length > 0; }

    // ── Formatted values ──────────────────────────────────────────────────
    get formattedTotal() { return this.formatCurrency(this.dynamicTotal); }
    get formattedSubtotal() { return this.formatCurrency(this.dynamicSubtotal); }

    get formattedMargin() {
        if (!this.quote) return '$0.00 (0%)';
        const amt = this.quote.Margin_Amount__c || 0;
        const pct = this.quote.Margin_Percent__c || 0;
        return '$' + Number(amt).toLocaleString('en-US', { minimumFractionDigits: 2 }) +
               ' (' + Number(pct).toFixed(1) + '%)';
    }

    get formattedDiscount() {
        const amt = this.dynamicSubtotal - this.dynamicTotal;
        const pct = this.dynamicSubtotal > 0 ? (amt / this.dynamicSubtotal) * 100 : 0;
        if (amt === 0) return '$0.00 (0%)';
        return '-' + this.formatCurrency(amt) + ' (-' + Number(pct).toFixed(1) + '%)';
    }

    get formattedStartDate() {
        if (!this.quote || !this.quote.Start_Date__c) return '-';
        return this.formatDate(new Date(this.quote.Start_Date__c));
    }

    get formattedEndDate() {
        if (!this.quote || !this.quote.End_Date__c) return '-';
        return this.formatDate(new Date(this.quote.End_Date__c));
    }

    formatCurrency(value) {
        return '$' + Number(value).toLocaleString('en-US', {
            minimumFractionDigits: 2, maximumFractionDigits: 2
        });
    }

    formatDate(date) {
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        return `${d}-${m}-${date.getFullYear()}`;
    }

    // ── Tab click ─────────────────────────────────────────────────────────
    handleTabClick(event) {
        this.activeTab = event.currentTarget.dataset.tab;
    }

    // ── Back ──────────────────────────────────────────────────────────────
    handleBack() {
        this.dispatchEvent(new CustomEvent('back'));
    }

    // ── Name editing ──────────────────────────────────────────────────────
    handleEditName()     { this.isEditingName = true; }
    handleNameChange(e)  { this.editedName    = e.target.value; }

    handleNameKeyDown(event) {
        if (event.key === 'Enter')  this.handleNameSave();
        if (event.key === 'Escape') { this.isEditingName = false; this.editedName = this.quote.Name; }
    }

    handleNameSave() {
        this.isEditingName = false;
        if (this.editedName === this.quote.Name) return;
        updateQuote({ quote: { Id: this.quoteId, Name: this.editedName } })
            .then(() => refreshApex(this.wiredQuoteResult))
            .catch(err => { console.error('Name update error:', err); this.editedName = this.quote.Name; });
    }

    // ── Save / Refresh ────────────────────────────────────────────────────
    handleSave()    { refreshApex(this.wiredQuoteResult); }
    handleRefresh() { if (this.wiredQuoteResult) refreshApex(this.wiredQuoteResult); }

    // ── Line items updated ────────────────────────────────────────────────
    handleLineItemsUpdated() {
        if (this.wiredQuoteResult)   refreshApex(this.wiredQuoteResult);
        if (this.wiredSummaryResult) refreshApex(this.wiredSummaryResult);
    }

    // ── Approval actions ──────────────────────────────────────────────────
    handleSubmit() {
        submitForApproval({ quoteId: this.quoteId, comment: 'Submitted for approval' })
            .then(() => refreshApex(this.wiredQuoteResult))
            .catch(err => console.error('Submit error:', err));
    }

    handleApprove() {
        approveQuote({ quoteId: this.quoteId })
            .then(() => refreshApex(this.wiredQuoteResult))
            .catch(err => console.error('Approve error:', err));
    }

    handleReject() {
        rejectQuote({ quoteId: this.quoteId, reason: 'Rejected by manager' })
            .then(() => refreshApex(this.wiredQuoteResult))
            .catch(err => console.error('Reject error:', err));
    }

    handleApprove() {
        approveQuote({ quoteId: this.quoteId })
            .then(() => refreshApex(this.wiredQuoteResult))
            .catch(err => console.error('Approve error:', err));
    }

    handleReject() {
        rejectQuote({ quoteId: this.quoteId, reason: 'Rejected by manager' })
            .then(() => refreshApex(this.wiredQuoteResult))
            .catch(err => console.error('Reject error:', err));
    }

    handleRecall() {
        recallQuote({ quoteId: this.quoteId })
            .then(() => refreshApex(this.wiredQuoteResult))
            .catch(err => console.error('Recall error:', err));
    }

    // ── PDF modal ─────────────────────────────────────────────────────────
    handleGeneratePdf() {
        this.showPdfModal = true;
    }

    handlePdfModalClose() {
        this.showPdfModal = false;
    }

    handlePdfSaved() {
        this.showPdfModal = false;
        if (this.wiredDocsResult) refreshApex(this.wiredDocsResult);
        // Switch to Generated PDFs tab so user sees their saved doc
        this.activeTab = 'pdfs';
    }

    // ── Download a previously saved document ──────────────────────────────
    handleDownloadSavedDoc(event) {
        const docId   = event.currentTarget.dataset.id;
        const docName = event.currentTarget.dataset.name;

        getDocumentHtml({ documentId: docId })
            .then(html => {
                const blob = new Blob([html], { type: 'text/html' });
                const url  = URL.createObjectURL(blob);
                const a    = document.createElement('a');
                a.href     = url;
                a.download = (docName || 'Quote') + '.html';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            })
            .catch(err => {
                console.error('Download error:', err);
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Error', message: 'Could not load document.', variant: 'error'
                }));
            });
    }

    // ── Delete a saved document ───────────────────────────────────────────
    handleDeleteSavedDoc(event) {
        const docId = event.currentTarget.dataset.id;
        // eslint-disable-next-line no-alert
        if (!confirm('Delete this saved document?')) return;

        deleteQuoteDocument({ documentId: docId })
            .then(() => {
                if (this.wiredDocsResult) refreshApex(this.wiredDocsResult);
            })
            .catch(err => console.error('Delete doc error:', err));
    }
}