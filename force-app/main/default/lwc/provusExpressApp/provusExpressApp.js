import { LightningElement, track, wire } from 'lwc';
import getCurrentUserContext from '@salesforce/apex/UserContextController.getCurrentUserContext';

export default class ProvusExpressApp extends LightningElement {

    @track activePage = 'dashboard';
    @track selectedQuoteId = null;
    @track isManager = false;

    @wire(getCurrentUserContext)
    wiredContext({ data }) {
        if (data) {
            this.isManager = data.isManager;
        }
    }

    // ── Page visibility getters ───────────────────────────────────────────
    get showDashboard() {
        return this.activePage === 'dashboard';
    }
    get showQuotes() {
        return this.activePage === 'quotes';
    }
    get showQuoteDetail() {
        return this.activePage === 'quoteDetail';
    }
    get showAccounts() {
        return this.activePage === 'accounts';
    }
    get showResourceRoles() {
        return this.activePage === 'resourceRoles';
    }
    get showProducts() {
        return this.activePage === 'products';
    }
    get showAddons() {
        return this.activePage === 'addons';
    }
    get showSettings() {
        return this.activePage === 'settings';
    }

    // ── Sidebar navigation ────────────────────────────────────────────────
    handleNavigation(event) {
        // Guard: make sure event.detail exists
        if (!event || !event.detail || !event.detail.page) {
            return;
        }

        const targetPage = event.detail.page;

        // Security Guard: Prevent non-managers from accessing settings
        if (targetPage === 'settings' && !this.isManager) {
            this.activePage = 'dashboard';
            return;
        }

        this.activePage = targetPage;
        this.selectedQuoteId = null;
    }

    // ── Quote row clicked → go to detail ─────────────────────────────────
    handleViewQuote(event) {
        // Guard: make sure quoteId exists
        if (!event || !event.detail || !event.detail.quoteId) {
            return;
        }
        this.selectedQuoteId = event.detail.quoteId;
        this.activePage = 'quoteDetail';
    }

    // ── Back button on detail → go back to list ───────────────────────────
    handleBackToQuotes() {
        this.activePage = 'quotes';
        this.selectedQuoteId = null;
    }
}