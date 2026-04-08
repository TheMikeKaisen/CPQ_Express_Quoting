import { LightningElement, track, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getAwaitingApproval from
    '@salesforce/apex/DashboardController.getAwaitingApproval';
import getLowMarginDrafts from
    '@salesforce/apex/DashboardController.getLowMarginDrafts';
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
    
    // Metrics
    @track awaitingCount     = 0;
    @track awaitingAmount    = '$0.00';
    @track lowMarginCount    = 0;
    @track draftCount        = 0;
    @track draftAmount       = '$0.00';
    @track highMarginCount   = 0;
    @track highMarginAmount  = '$0.00';
    @track wonCount          = 0;
    @track wonAmount         = '$0.00';

    // Right Panel
    @track activeFilter      = 'All';
    @track totalQuoteCount   = 0;
    @track recentQuotes      = [];

    userId = USER_ID;
    
    connectedCallback() {
        this.handleRefresh();
    }

    // Wire results for refreshApex
    wiredAwaitingResult;
    wiredLowMarginResult;
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

    get timeGreeting() {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    }

    get greetingEmoji() {
        const hour = new Date().getHours();
        if (hour < 12) return '🌅';
        if (hour < 18) return '☀️';
        return '🌆';
    }

    // ── Wire dashboard data ───────────────────────────────────────────────
    @wire(getAwaitingApproval)
    wiredAwaiting(result) {
        this.wiredAwaitingResult = result;
        if (result.data) {
            this.awaitingCount  = result.data.count || 0;
            this.awaitingAmount = this.formatCurrency(result.data.totalAmount);
        }
    }

    @wire(getLowMarginDrafts)
    wiredLowMargin(result) {
        this.wiredLowMarginResult = result;
        if (result.data) {
            this.lowMarginCount = result.data.count || 0;
        }
    }

    @wire(getDraftPipeline)
    wiredDraft(result) {
        this.wiredDraftResult = result;
        if (result.data) {
            this.draftCount  = result.data.count || 0;
            this.draftAmount = this.formatCurrency(result.data.totalAmount);
        }
    }

    @wire(getHighMarginDeals)
    wiredHighMargin(result) {
        this.wiredHighMarginResult = result;
        if (result.data) {
            this.highMarginCount  = result.data.count || 0;
            this.highMarginAmount = this.formatCurrency(result.data.totalAmount);
        }
    }

    @wire(getWonThisMonth)
    wiredWon(result) {
        this.wiredWonResult = result;
        if (result.data) {
            this.wonCount  = result.data.count || 0;
            this.wonAmount = this.formatCurrency(result.data.totalAmount);
        }
    }

    @wire(getRecentQuotes, { statusFilter: '$activeFilter' })
    wiredRecent(result) {
        this.wiredRecentResult = result;
        if (result.data) {
            this.recentQuotes = result.data.map(q => ({
                ...q,
                accountName: q.Account ? q.Account.Name : '-',
                formattedAmount: this.formatCurrency(q.Total_Amount__c),
                timeAgo: this.getTimeAgo(q.CreatedDate)
            }));
        }
    }

    @wire(getTotalQuoteCount, { statusFilter: '$activeFilter' })
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
            maximumFractionDigits: 0
        });
    }

    getTimeAgo(dateString) {
        const now = new Date();
        const past = new Date(dateString);
        const msPerMinute = 60 * 1000;
        const msPerHour = msPerMinute * 60;
        const msPerDay = msPerHour * 24;

        const elapsed = now - past;

        if (elapsed < msPerHour) {
            return Math.round(elapsed / msPerMinute) + 'm ago';
        } else if (elapsed < msPerDay) {
            return Math.round(elapsed / msPerHour) + 'h ago';
        } else if (elapsed < msPerDay * 7) {
            return Math.round(elapsed / msPerDay) + 'd ago';
        }
        return past.toLocaleDateString();
    }

    // Tab Classes
    get allTabClass()      { return this.getTabClass('All'); }
    get draftTabClass()    { return this.getTabClass('Draft'); }
    get pendingTabClass()  { return this.getTabClass('Pending'); }
    get approvedTabClass() { return this.getTabClass('Approved'); }
    get rejectedTabClass() { return this.getTabClass('Rejected'); }

    getTabClass(status) {
        return this.activeFilter === status ? 'tab active' : 'tab';
    }

    // ── Handlers ──────────────────────────────────────────────────────────
    handleFilterClick(event) {
        this.activeFilter = event.currentTarget.dataset.status;
    }

    handleRefresh() {
        const results = [
            this.wiredAwaitingResult,
            this.wiredLowMarginResult,
            this.wiredDraftResult,
            this.wiredHighMarginResult,
            this.wiredWonResult,
            this.wiredRecentResult,
            this.wiredCountResult
        ];
        results.forEach(res => {
            if (res) refreshApex(res);
        });
    }

    handleCreateQuote() {
        this.showCreateModal = true;
    }

    handleModalClose() {
        this.showCreateModal = false;
    }

    handleQuoteCreated(event) {
        this.showCreateModal = false;
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

    handleChipClick(event) {
        const action = event.currentTarget.dataset.action;
        if (action === 'createQuote') {
            this.showCreateModal = true;
        } else {
            const pageMap = {
                showQuotes: 'quotes',
                listAccounts: 'accounts',
                showRoles: 'resourceRoles'
            };
            this.dispatchEvent(new CustomEvent('navigation', {
                detail: { page: pageMap[action] }
            }));
        }
    }

    handleViewNav(event) {
        const page = event.currentTarget.dataset.page;
        this.dispatchEvent(new CustomEvent('navigation', {
            detail: { page: page }
        }));
    }
}