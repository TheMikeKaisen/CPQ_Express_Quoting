import { LightningElement, track, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getQuotes from
    '@salesforce/apex/QuoteController.getQuotes';
import getAccountsForFilter from
    '@salesforce/apex/QuoteController.getAccountsForFilter';
import deleteQuote from
    '@salesforce/apex/QuoteController.deleteQuote';
import cloneQuote from
    '@salesforce/apex/QuoteController.cloneQuote';

const PAGE_SIZE = 10;

export default class ProvusQuotesList extends LightningElement {

    @track showCreateModal = false;
    @track statusFilter    = 'All';
    @track accountFilter   = 'All';
    @track searchTerm      = '';
    @track currentPage     = 1;

    // ── IMPORTANT: initialize to undefined ───────────────────────────────
    wiredQuotesResult      = undefined;
    @track allQuotes       = [];
    @track accountOptions  = [];

    // ── Wire accounts for filter ──────────────────────────────────────────
    @wire(getAccountsForFilter)
    wiredAccounts({ data, error }) {
        if (data)  this.accountOptions = data;
        if (error) console.error('Accounts error:', error);
    }

    // ── Wire quotes ───────────────────────────────────────────────────────
    @wire(getQuotes, {
        statusFilter:  '$statusFilter',
        accountFilter: '$accountFilter'
    })
    wiredQuotes(result) {
        // Store the full result for refreshApex
        this.wiredQuotesResult = result;

        if (result.data) {
            this.allQuotes = result.data.map((q, index) => {
                return {
                    ...q,
                    rowNumber: index + 1,
                    opportunityName: q.Opportunity
                        ? q.Opportunity.Name : 'N/A',
                    accountName: q.Account
                        ? q.Account.Name : '-',
                    createdByName: q.CreatedBy
                        ? q.CreatedBy.Name : '-',
                    formattedDate: q.CreatedDate
                        ? new Date(q.CreatedDate)
                            .toLocaleDateString('en-US')
                        : '-',
                    formattedAmount: q.TotalPrice != null
                        ? '$' + Number(q.TotalPrice)
                            .toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                            })
                        : '$0.00',
                    formattedDiscount: q.Discount
                        ? q.Discount + '%' : '-',
                    formattedMargin: q.Margin_Percent__c != null
                        ? Number(q.Margin_Percent__c)
                            .toFixed(2) + '%'
                        : '-'
                };
            });
        } else if (result.error) {
            console.error('Quotes wire error:', result.error);
            this.allQuotes = [];
        }
    }

    // ── Computed: filtered quotes ─────────────────────────────────────────
    get filteredQuotes() {
        if (!this.searchTerm) return this.allQuotes;
        const term = this.searchTerm.toLowerCase();
        return this.allQuotes.filter(q =>
            (q.QuoteNumber || '').toLowerCase().includes(term) ||
            (q.accountName || '').toLowerCase().includes(term) ||
            (q.opportunityName || '').toLowerCase().includes(term)
        );
    }

    // ── Pagination getters ────────────────────────────────────────────────
    get totalRecords() { return this.filteredQuotes.length; }

    get totalPages() {
        return Math.max(1,
            Math.ceil(this.totalRecords / PAGE_SIZE));
    }

    get isFirstPage() { return this.currentPage === 1; }
    get isLastPage()  { return this.currentPage >= this.totalPages; }
    get isEmpty()     { return this.filteredQuotes.length === 0; }

    get startRecord() {
        return this.totalRecords === 0
            ? 0
            : (this.currentPage - 1) * PAGE_SIZE + 1;
    }

    get endRecord() {
        return Math.min(
            this.currentPage * PAGE_SIZE,
            this.totalRecords
        );
    }

    get paginatedQuotes() {
        const start = (this.currentPage - 1) * PAGE_SIZE;
        const end   = start + PAGE_SIZE;
        return this.filteredQuotes.slice(start, end);
    }

    // ── Handlers ──────────────────────────────────────────────────────────
    handleSearch(event) {
        this.searchTerm  = event.target.value;
        this.currentPage = 1;
    }

    handleStatusFilter(event) {
        this.statusFilter = event.target.value;
        this.currentPage  = 1;
    }

    handleAccountFilter(event) {
        this.accountFilter = event.target.value;
        this.currentPage   = 1;
    }

    handleNew() {
        this.showCreateModal = true;
    }

    handleModalClose() {
        this.showCreateModal = false;
    }

    handleQuoteCreated(event) {
        this.showCreateModal = false;
        // ── FIX: NO bubbles/composed ──────────────────────────────────
        this.dispatchEvent(new CustomEvent('viewquote', {
            detail: { quoteId: event.detail.quoteId }
        }));
    }

    // Click on quote ID link OR row
    handleQuoteClick(event) {
        event.stopPropagation();
        const quoteId = event.currentTarget.dataset.id;
        // ── FIX: NO bubbles/composed ──────────────────────────────────
        this.dispatchEvent(new CustomEvent('viewquote', {
            detail: { quoteId: quoteId }
        }));
    }

    handleRowClick(event) {
        const quoteId = event.currentTarget.dataset.id;
        // ── FIX: NO bubbles/composed ──────────────────────────────────
        this.dispatchEvent(new CustomEvent('viewquote', {
            detail: { quoteId: quoteId }
        }));
    }

    handleRefresh() {
        // ── FIX: only refresh if wire result exists ────────────────────
        if (this.wiredQuotesResult) {
            refreshApex(this.wiredQuotesResult);
        }
    }

    handleClone(event) {
        event.stopPropagation();
        const quoteId = event.currentTarget.dataset.id;
        // eslint-disable-next-line no-alert
        if (!confirm('Clone this quote?')) return;

        cloneQuote({ quoteId: quoteId })
            .then(() => {
                if (this.wiredQuotesResult) {
                    return refreshApex(this.wiredQuotesResult);
                }
            })
            .catch(error => {
                console.error('Clone error:', error);
            });
    }

    handleDelete(event) {
        event.stopPropagation();
        const quoteId = event.currentTarget.dataset.id;
        // eslint-disable-next-line no-alert
        if (!confirm('Delete this quote? This cannot be undone.')) {
            return;
        }

        deleteQuote({ quoteId: quoteId })
            .then(() => {
                if (this.wiredQuotesResult) {
                    return refreshApex(this.wiredQuotesResult);
                }
            })
            .catch(error => {
                console.error('Delete error:', error);
            });
    }

    handlePrevPage() {
        if (!this.isFirstPage) this.currentPage--;
    }

    handleNextPage() {
        if (!this.isLastPage) this.currentPage++;
    }

    stopPropagation(event) {
        event.stopPropagation();
    }
}