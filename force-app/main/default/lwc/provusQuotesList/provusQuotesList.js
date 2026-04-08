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
import getCurrentUserContext from
    '@salesforce/apex/UserContextController.getCurrentUserContext';

const PAGE_SIZE = 10;

export default class ProvusQuotesList extends LightningElement {

    @track showCreateModal = false;
    @track statusFilter = 'All';
    @track accountFilter = 'All';
    @track searchTerm = '';
    @track currentPage = 1;

    // ── IMPORTANT: initialize to undefined ───────────────────────────────
    wiredQuotesResult = undefined;
    @track allQuotes = [];
    @track accountOptions = [];
    @track canCreateData = false;

    @wire(getCurrentUserContext)
    wiredContext({ data }) {
        if (data) {
            this.canCreateData = data.canCreateData;
        }
    }

    connectedCallback() {
        // Refresh the list every time we navigate back to it
        if (this.wiredQuotesResult) {
            refreshApex(this.wiredQuotesResult);
        }
    }

    // ── Wire accounts for filter ──────────────────────────────────────────
    @wire(getAccountsForFilter)
    wiredAccounts({ data, error }) {
        if (data) this.accountOptions = data;
        if (error) console.error('Accounts error:', error);
    }

    // ── Wire quotes ───────────────────────────────────────────────────────
    @wire(getQuotes, {
        statusFilter: '$statusFilter',
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
                        ? q.Opportunity.Name : 'Not selected',
                    accountName: q.Account
                        ? q.Account.Name : (q.QuoteAccount ? q.QuoteAccount.Name : '-'),
                    createdByName: q.CreatedBy
                        ? q.CreatedBy.Name : '-',
                    formattedDate: q.CreatedDate
                        ? new Date(q.CreatedDate)
                            .toLocaleDateString('en-US')
                        : '-',
                    formattedAmount: q.Total_Amount__c != null
                        ? '$' + Number(q.Total_Amount__c)
                            .toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                            })
                        : '$0.00',
                    formattedDiscount: (q.Subtotal__c > 0 && q.Total_Amount__c != null)
                        ? (Number((q.Subtotal__c - q.Total_Amount__c) / q.Subtotal__c * 100).toFixed(1) + '%')
                        : '-',
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
    get isLastPage() { return this.currentPage >= this.totalPages; }
    get isEmpty() { return this.filteredQuotes.length === 0; }

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
        const end = start + PAGE_SIZE;
        return this.filteredQuotes.slice(start, end);
    }

    // ── Handlers ──────────────────────────────────────────────────────────
    handleSearch(event) {
        this.searchTerm = event.target.value;
        this.currentPage = 1;
    }

    handleStatusFilter(event) {
        this.statusFilter = event.target.value;
        this.currentPage = 1;
    }

    handleAccountFilter(event) {
        this.accountFilter = event.target.value;
        this.currentPage = 1;
    }

    handleNew() {
        this.showCreateModal = true;
    }

    handleModalClose() {
        this.showCreateModal = false;
    }

    handleQuoteCreated(event) {
        this.showCreateModal = false;
        // ── Refresh cache so the list is ready when we come back ──────
        if (this.wiredQuotesResult) {
            refreshApex(this.wiredQuotesResult);
        }
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

    @track showCloneModal = false;
    @track cloneQuoteId;
    @track cloneQuoteNumber;

    handleClone(event) {
        event.stopPropagation();
        this.cloneQuoteId = event.currentTarget.dataset.id;
        const quote = this.allQuotes.find(q => q.Id === this.cloneQuoteId);
        this.cloneQuoteNumber = quote ? quote.QuoteNumber : '';
        this.showCloneModal = true;
    }

    handleCloneModalClose() {
        this.showCloneModal = false;
    }

    handleQuoteCloned(event) {
        const newQuoteId = event.detail.quoteId;
        if (this.wiredQuotesResult) {
            refreshApex(this.wiredQuotesResult);
        }
        // Optionally navigate to the new quote
        this.dispatchEvent(new CustomEvent('viewquote', {
            detail: { quoteId: newQuoteId }
        }));
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