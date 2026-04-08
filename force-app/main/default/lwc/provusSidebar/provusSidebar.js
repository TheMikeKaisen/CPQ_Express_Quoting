import { LightningElement, api, track, wire } from 'lwc';
import getCurrentUserContext from
    '@salesforce/apex/UserContextController.getCurrentUserContext';

export default class ProvusSidebar extends LightningElement {

    // activePage is passed from the parent (provusExpressApp)
    @api activePage = 'dashboard';

    @track isManager = false;

    @wire(getCurrentUserContext)
    wiredContext({ data }) {
        if (data) {
            this.isManager = data.isManager;
        }
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