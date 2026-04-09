import { LightningElement, api, track, wire } from 'lwc';
import getCurrentUserContext from
    '@salesforce/apex/UserContextController.getCurrentUserContext';

export default class ProvusSidebar extends LightningElement {

    // activePage is passed from the parent (provusExpressApp)
    @api activePage = 'dashboard';

    @track isManager = false;
    @track userName = '';
    @track userRole = '';

    @wire(getCurrentUserContext)
    wiredContext({ data }) {
        if (data) {
            this.isManager = data.isManager;
            this.userName = data.userName;
            
            if (data.profileName === 'System Administrator') {
                this.userRole = 'Admin';
            } else if (data.isManager) {
                this.userRole = 'Manager';
            } else {
                this.userRole = 'Salesperson';
            }
        }
    }

    get userInitials() {
        if (!this.userName) return '??';
        return this.userName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    }

    get roleBadgeClass() {
        if (this.userRole === 'Admin') return 'user-role-badge badge-admin';
        if (this.userRole === 'Manager') return 'user-role-badge badge-manager';
        return 'user-role-badge badge-sales';
    }


    get dashboardClass() { return this.getItemClass('dashboard'); }
    get quotesClass() { return this.getItemClass('quotes'); }
    get accountsClass() { return this.getItemClass('accounts'); }
    get resourceRolesClass() { return this.getItemClass('resourceRoles'); }
    get productsClass() { return this.getItemClass('products'); }
    get addonsClass() { return this.getItemClass('addons'); }
    get aiClass() { return this.getItemClass('ai'); }
    get settingsClass() { return this.getItemClass('settings'); }

    getItemClass(page) {
        return this.activePage === page ? 'nav-item nav-item-active' : 'nav-item';
    }

    // When user clicks a nav item → fire event to parent
    handleNavClick(event) {
        // Get the page name from data-page attribute
        const page = event.currentTarget.dataset.page;

        // Fire custom event — parent (provusExpressApp) listens to this
        this.dispatchEvent(new CustomEvent('navigation', {
            detail: { page: page },
            bubbles: true,
            composed: true
        }));
    }
}