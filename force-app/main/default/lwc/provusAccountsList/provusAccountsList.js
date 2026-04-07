import { LightningElement, track, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getAccounts from
    '@salesforce/apex/AccountController.getAccounts';
import getAccountTypes from
    '@salesforce/apex/AccountController.getAccountTypes';
import getAccountIndustries from
    '@salesforce/apex/AccountController.getAccountIndustries';
import createAccount from
    '@salesforce/apex/AccountController.createAccount';
import deleteAccount from
    '@salesforce/apex/AccountController.deleteAccount';

const PAGE_SIZE = 10;

export default class ProvusAccountsList extends LightningElement {

    @track allAccounts    = [];
    @track typeOptions    = [];
    @track industryOptions = [];
    @track typeFilter     = 'All';
    @track industryFilter = 'All';
    @track searchTerm     = '';
    @track currentPage    = 1;
    @track showModal      = false;
    @track isSaving       = false;
    @track errorMessage   = '';

    // Form fields
    @track formData = {
        name: '', type: '', industry: '',
        website: '', phone: ''
    };

    wiredAccountsResult = undefined;

    // ── Wire data ─────────────────────────────────────────────────────────
    @wire(getAccounts, {
        typeFilter:     '$typeFilter',
        industryFilter: '$industryFilter'
    })
    wiredAccounts(result) {
        this.wiredAccountsResult = result;
        if (result.data) {
            this.allAccounts = result.data.map((a, i) => ({
                ...a,
                rowNumber:      i + 1,
                websiteDisplay: a.Website || '-',
                phoneDisplay:   a.Phone   || '-'
            }));
        }
    }

    @wire(getAccountTypes)
    wiredTypes({ data }) {
        if (data) this.typeOptions = data;
    }

    @wire(getAccountIndustries)
    wiredIndustries({ data }) {
        if (data) this.industryOptions = data;
    }

    // ── Filtering ─────────────────────────────────────────────────────────
    get filteredAccounts() {
        if (!this.searchTerm) return this.allAccounts;
        const term = this.searchTerm.toLowerCase();
        return this.allAccounts.filter(a =>
            (a.Name    || '').toLowerCase().includes(term) ||
            (a.Phone   || '').toLowerCase().includes(term) ||
            (a.Website || '').toLowerCase().includes(term)
        );
    }

    // ── Pagination ────────────────────────────────────────────────────────
    get totalRecords() { return this.filteredAccounts.length; }
    get totalPages()   {
        return Math.max(1,
            Math.ceil(this.totalRecords / PAGE_SIZE));
    }
    get isFirstPage()  { return this.currentPage === 1; }
    get isLastPage()   {
        return this.currentPage >= this.totalPages;
    }
    get isEmpty()      { return this.filteredAccounts.length === 0; }
    get startRecord()  {
        return this.totalRecords === 0
            ? 0 : (this.currentPage - 1) * PAGE_SIZE + 1;
    }
    get endRecord() {
        return Math.min(
            this.currentPage * PAGE_SIZE, this.totalRecords);
    }
    get paginatedAccounts() {
        const start = (this.currentPage - 1) * PAGE_SIZE;
        return this.filteredAccounts.slice(
            start, start + PAGE_SIZE);
    }

    // ── Handlers ──────────────────────────────────────────────────────────
    handleSearch(event) {
        this.searchTerm  = event.target.value;
        this.currentPage = 1;
    }

    handleTypeFilter(event) {
        this.typeFilter  = event.target.value;
        this.currentPage = 1;
    }

    handleIndustryFilter(event) {
        this.industryFilter = event.target.value;
        this.currentPage    = 1;
    }

    handleRefresh() {
        if (this.wiredAccountsResult) {
            refreshApex(this.wiredAccountsResult);
        }
    }

    handleNew() { this.showModal = true; }

    handleModalClose() {
        this.showModal    = false;
        this.errorMessage = '';
        this.formData     = {
            name: '', type: '', industry: '',
            website: '', phone: ''
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
            this.errorMessage = 'Account Name is required.';
            return;
        }
        this.isSaving = true;

        createAccount({
            name:     this.formData.name,
            type:     this.formData.type,
            industry: this.formData.industry,
            website:  this.formData.website,
            phone:    this.formData.phone
        })
        .then(() => {
            this.handleModalClose();
            if (this.wiredAccountsResult) {
                refreshApex(this.wiredAccountsResult);
            }
        })
        .catch(error => {
            this.errorMessage = error.body
                ? error.body.message
                : 'Error creating account.';
        })
        .finally(() => {
            this.isSaving = false;
        });
    }

    handleDelete(event) {
        const accountId = event.currentTarget.dataset.id;
        // eslint-disable-next-line no-alert
        if (!confirm('Delete this account?')) return;

        deleteAccount({ accountId: accountId })
        .then(() => {
            if (this.wiredAccountsResult) {
                refreshApex(this.wiredAccountsResult);
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
}