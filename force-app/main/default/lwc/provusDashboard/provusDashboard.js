import { LightningElement, track, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { CurrentPageReference } from 'lightning/navigation';
import getDraftPipeline from
    '@salesforce/apex/DashboardController.getDraftPipeline';
import getHighMarginDeals from
    '@salesforce/apex/DashboardController.getHighMarginDeals';
import getWonThisMonth from
    '@salesforce/apex/DashboardController.getWonThisMonth';
import getRecentQuotes from
    '@salesforce/apex/DashboardController.getRecentQuotes';
import getTotalQuoteCount from
    '@salesforce/apex/DashboardController.getTotalQuoteCount';
import USER_ID from '@salesforce/user/Id';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import NAME_FIELD from '@salesforce/schema/User.Name';

export default class ProvusDashboard extends LightningElement {

    @track showCreateModal   = false;
    @track draftCount        = 0;
    @track draftAmount       = '$0.00';
    @track highMarginCount   = 0;
    @track highMarginAmount  = '$0.00';
    @track wonCount          = 0;
    @track wonAmount         = '$0.00';
    @track totalQuoteCount   = 0;
    @track recentQuotes      = [];

    userId = USER_ID;
    
    connectedCallback() {
        // Refresh all dashboard metrics whenever we navigate to this tab
        this.handleRefresh();
    }

    // Wire results for refreshApex
    wiredDraftResult;
    wiredHighMarginResult;
    wiredWonResult;
    wiredRecentResult;
    wiredCountResult;

    // ── Get current user name ─────────────────────────────────────────────
    @wire(getRecord, {
        recordId: '$userId',
        fields: [NAME_FIELD]
    })
    currentUser;

    get currentUserName() {
        return this.currentUser && this.currentUser.data
            ? getFieldValue(this.currentUser.data, NAME_FIELD)
            : 'User';
    }

    // ── Wire dashboard data ───────────────────────────────────────────────
    @wire(getDraftPipeline)
    wiredDraft(result) {
        this.wiredDraftResult = result;
        if (result.data) {
            this.draftCount  = result.data.count  || 0;
            this.draftAmount = this.formatCurrency(
                result.data.totalAmount);
        }
    }

    @wire(getHighMarginDeals)
    wiredHighMargin(result) {
        this.wiredHighMarginResult = result;
        if (result.data) {
            this.highMarginCount  = result.data.count || 0;
            this.highMarginAmount = this.formatCurrency(
                result.data.totalAmount);
        }
    }

    @wire(getWonThisMonth)
    wiredWon(result) {
        this.wiredWonResult = result;
        if (result.data) {
            this.wonCount  = result.data.count || 0;
            this.wonAmount = this.formatCurrency(
                result.data.totalAmount);
        }
    }

    @wire(getRecentQuotes)
    wiredRecent(result) {
        this.wiredRecentResult = result;
        if (result.data) {
            this.recentQuotes = result.data.map(q => ({
                ...q,
                accountName: q.Account
                    ? q.Account.Name : '-',
                formattedAmount: this.formatCurrency(q.Total_Amount__c)
            }));
        }
    }

    @wire(getTotalQuoteCount)
    wiredCount(result) {
        this.wiredCountResult = result;
        if (result.data != null) {
            this.totalQuoteCount = result.data;
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────
    get hasRecentQuotes() {
        return this.recentQuotes && this.recentQuotes.length > 0;
    }

    formatCurrency(value) {
        if (value == null) return '$0.00';
        return '$' + Number(value).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    // ── Handlers ──────────────────────────────────────────────────────────
    handleRefresh() {
        if (this.wiredDraftResult) {
            refreshApex(this.wiredDraftResult);
        }
        if (this.wiredHighMarginResult) {
            refreshApex(this.wiredHighMarginResult);
        }
        if (this.wiredWonResult) {
            refreshApex(this.wiredWonResult);
        }
        if (this.wiredRecentResult) {
            refreshApex(this.wiredRecentResult);
        }
        if (this.wiredCountResult) {
            refreshApex(this.wiredCountResult);
        }
    }

    handleCreateQuote() {
        this.showCreateModal = true;
    }

    handleModalClose() {
        this.showCreateModal = false;
    }

    handleQuoteCreated(event) {
        this.showCreateModal = false;
        // Navigate to the new quote
        this.dispatchEvent(new CustomEvent('viewquote', {
            detail: { quoteId: event.detail.quoteId }
        }));
        this.handleRefresh();
    }

    handleRecentQuoteClick(event) {
        const quoteId = event.currentTarget.dataset.id;
        this.dispatchEvent(new CustomEvent('viewquote', {
            detail: { quoteId: quoteId }
        }));
    }

    // Chip clicks → navigate to relevant pages
    handleChipClick(event) {
        const action = event.currentTarget.dataset.action;
        if (action === 'createQuote') {
            this.showCreateModal = true;
        } else if (action === 'showQuotes') {
            this.dispatchEvent(new CustomEvent('navigation', {
                detail: { page: 'quotes' }
            }));
        } else if (action === 'listAccounts') {
            this.dispatchEvent(new CustomEvent('navigation', {
                detail: { page: 'accounts' }
            }));
        } else if (action === 'showRoles') {
            this.dispatchEvent(new CustomEvent('navigation', {
                detail: { page: 'resourceRoles' }
            }));
        }
    }

    handleViewDrafts() {
        this.dispatchEvent(new CustomEvent('navigation', {
            detail: { page: 'quotes' }
        }));
    }

    handleViewHighMargin() {
        this.dispatchEvent(new CustomEvent('navigation', {
            detail: { page: 'quotes' }
        }));
    }

    handleViewWon() {
        this.dispatchEvent(new CustomEvent('navigation', {
            detail: { page: 'quotes' }
        }));
    }
}