import { LightningElement, track, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getAddons from
    '@salesforce/apex/AddonController.getAddons';
import createAddon from
    '@salesforce/apex/AddonController.createAddon';
import toggleActiveStatus from
    '@salesforce/apex/AddonController.toggleActiveStatus';
import deleteAddon from
    '@salesforce/apex/AddonController.deleteAddon';
import getCurrentUserContext from
    '@salesforce/apex/UserContextController.getCurrentUserContext';

const PAGE_SIZE = 10;

export default class ProvusAddonsList extends LightningElement {

    @track allAddons    = [];
    @track isManager    = false;
    @track searchTerm   = '';
    @track currentPage  = 1;
    @track showModal    = false;
    @track isSaving     = false;
    @track errorMessage = '';
    @track formData     = {
        name: '', billingUnit: 'Each',
        price: 0, cost: 0, tags: ''
    };

    wiredAddonsResult = undefined;

    @wire(getCurrentUserContext)
    wiredContext({ data }) {
        if (data) {
            this.isManager = data.isManager;
        }
    }

    @wire(getAddons, { searchTerm: '' })
    wiredAddons(result) {
        this.wiredAddonsResult = result;
        if (result.data) {
            this.allAddons = result.data.map((a, i) => ({
                ...a,
                rowNumber:      i + 1,
                autoName:       a.Name,
                displayName:    a.Name__c,
                formattedPrice: this.fmt(a.Price__c),
                formattedCost:  a.Cost__c
                    ? this.fmt(a.Cost__c) : '—',
                tagsDisplay:    a.Tags__c || '-'
            }));
        }
    }

    fmt(value) {
        if (value == null) return '$0.00';
        return '$' + Number(value).toLocaleString('en-US', {
            minimumFractionDigits: 2
        });
    }

    get filteredAddons() {
        if (!this.searchTerm) return this.allAddons;
        const term = this.searchTerm.toLowerCase();
        return this.allAddons.filter(a =>
            (a.Name || '').toLowerCase().includes(term)
        );
    }

    get totalRecords() { return this.filteredAddons.length; }
    get totalPages() {
        return Math.max(1,
            Math.ceil(this.totalRecords / PAGE_SIZE));
    }
    get isFirstPage() { return this.currentPage === 1; }
    get isLastPage()  {
        return this.currentPage >= this.totalPages;
    }
    get isEmpty()     { return this.filteredAddons.length === 0; }
    get startRecord() {
        return this.totalRecords === 0
            ? 0 : (this.currentPage - 1) * PAGE_SIZE + 1;
    }
    get endRecord() {
        return Math.min(
            this.currentPage * PAGE_SIZE, this.totalRecords);
    }
    get paginatedAddons() {
        const start = (this.currentPage - 1) * PAGE_SIZE;
        return this.filteredAddons.slice(start, start + PAGE_SIZE);
    }

    handleSearch(event) {
        this.searchTerm  = event.target.value;
        this.currentPage = 1;
    }

    handleRefresh() {
        if (this.wiredAddonsResult) {
            refreshApex(this.wiredAddonsResult);
        }
    }

    handleNew() { this.showModal = true; }

    handleModalClose() {
        this.showModal    = false;
        this.errorMessage = '';
        this.formData     = {
            name: '', billingUnit: 'Each',
            price: 0, cost: 0, tags: ''
        };
    }

    handleFieldChange(event) {
        const field = event.currentTarget.dataset.field;
        this.formData = {
            ...this.formData,
            [field]: event.target.value
        };
    }

    handleSave() {
        if (!this.formData.name) {
            this.errorMessage = 'Name is required.';
            return;
        }
        this.isSaving = true;

        createAddon({
            name:        this.formData.name,
            billingUnit: this.formData.billingUnit,
            price:       parseFloat(this.formData.price) || 0,
            cost:        parseFloat(this.formData.cost)  || 0,
            tags:        this.formData.tags
        })
        .then(() => {
            this.handleModalClose();
            if (this.wiredAddonsResult) {
                refreshApex(this.wiredAddonsResult);
            }
        })
        .catch(error => {
            this.errorMessage = error.body
                ? error.body.message : 'Error saving.';
        })
        .finally(() => { this.isSaving = false; });
    }

    handleToggle(event) {
        const addonId  = event.currentTarget.dataset.id;
        const isActive = event.target.checked;

        toggleActiveStatus({
            addonId:  addonId,
            isActive: isActive
        })
        .then(() => {
            if (this.wiredAddonsResult) {
                refreshApex(this.wiredAddonsResult);
            }
        })
        .catch(error => console.error('Toggle error:', error));
    }

    handleDelete(event) {
        const addonId = event.currentTarget.dataset.id;
        // eslint-disable-next-line no-alert
        if (!confirm('Delete this add-on?')) return;

        deleteAddon({ addonId: addonId })
        .then(() => {
            if (this.wiredAddonsResult) {
                refreshApex(this.wiredAddonsResult);
            }
        })
        .catch(error => console.error('Delete error:', error));
    }

    handlePrevPage() {
        if (!this.isFirstPage) this.currentPage--;
    }
    handleNextPage() {
        if (!this.isLastPage) this.currentPage++;
    }
}