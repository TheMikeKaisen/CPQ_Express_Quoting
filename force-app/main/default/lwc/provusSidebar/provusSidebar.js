import { LightningElement, api, track } from 'lwc';

export default class ProvusSidebar extends LightningElement {

    // activePage is passed from the parent (provusExpressApp)
    @api activePage = 'dashboard';

    // Nav items definition
    // icon, label, page name all defined here
    get navItems() {
        const items = [
            { id: 1, icon: '📊', label: 'Dashboard', page: 'dashboard' },
            { id: 2, icon: '📋', label: 'Quotes', page: 'quotes' },
            { id: 3, icon: '🏢', label: 'Accounts', page: 'accounts' },
            { id: 4, icon: '👤', label: 'Resource Roles', page: 'resourceRoles' },
            { id: 5, icon: '📦', label: 'Products', page: 'products' },
            { id: 6, icon: '➕', label: 'Add-ons', page: 'addons' },
            { id: 7, icon: '🤖', label: 'AI Assistant', page: 'ai' },
        ];

        // Add 'active' CSS class to the current page item
        return items.map(item => ({
            ...item,
            cssClass: item.page === this.activePage
                ? 'nav-item nav-item-active'
                : 'nav-item'
        }));
    }

    handleBottomNavClick(event) {
        const page = event.currentTarget.dataset.page;
        if (page) {
            this.dispatchEvent(new CustomEvent('navigation', {
                detail: { page: page },
                bubbles: true,
                composed: true
            }));
        }
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