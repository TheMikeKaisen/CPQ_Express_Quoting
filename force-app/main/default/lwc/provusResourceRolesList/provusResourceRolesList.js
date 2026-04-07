import { LightningElement, track, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getResourceRoles from
    '@salesforce/apex/ResourceRoleController.getResourceRoles';
import createResourceRole from
    '@salesforce/apex/ResourceRoleController.createResourceRole';
import toggleActiveStatus from
    '@salesforce/apex/ResourceRoleController.toggleActiveStatus';
import deleteResourceRole from
    '@salesforce/apex/ResourceRoleController.deleteResourceRole';
import getCurrentUserContext from
    '@salesforce/apex/UserContextController.getCurrentUserContext';

const PAGE_SIZE = 10;

export default class ProvusResourceRolesList
    extends LightningElement {

    @track allRoles     = [];
    @track isManager    = false;
    @track statusFilter = 'All';
    @track searchTerm   = '';
    @track currentPage  = 1;
    @track showModal    = false;
    @track isSaving     = false;
    @track errorMessage = '';
    @track formData     = {
        name: '', location: '', billingUnit: 'Hour',
        price: 0, cost: 0, tags: ''
    };

    wiredRolesResult = undefined;

    @wire(getCurrentUserContext)
    wiredContext({ data }) {
        if (data) {
            this.isManager = data.isManager;
        }
    }

    @wire(getResourceRoles, { statusFilter: '$statusFilter' })
    wiredRoles(result) {
        this.wiredRolesResult = result;
        if (result.data) {
            this.allRoles = result.data.map((r, i) => ({
                ...r,
                rowNumber:       i + 1,
                displayName:     r.Name__c,
                locationDisplay: r.Location__c || '—',
                formattedPrice:  this.fmt(r.Price__c),
                formattedCost:   r.Cost__c
                    ? this.fmt(r.Cost__c) : '—'
            }));
        }
    }

    fmt(value) {
        if (value == null) return '$0.00';
        return '$' + Number(value).toLocaleString('en-US', {
            minimumFractionDigits: 2
        });
    }

    // ── Filtering + Pagination ────────────────────────────────────────────
    get filteredRoles() {
        if (!this.searchTerm) return this.allRoles;
        const term = this.searchTerm.toLowerCase();
        return this.allRoles.filter(r =>
            (r.Name     || '').toLowerCase().includes(term) ||
            (r.Location__c || '').toLowerCase().includes(term)
        );
    }

    get totalRecords() { return this.filteredRoles.length; }
    get totalPages()   {
        return Math.max(1,
            Math.ceil(this.totalRecords / PAGE_SIZE));
    }
    get isFirstPage()  { return this.currentPage === 1; }
    get isLastPage()   {
        return this.currentPage >= this.totalPages;
    }
    get isEmpty()      { return this.filteredRoles.length === 0; }
    get startRecord()  {
        return this.totalRecords === 0
            ? 0 : (this.currentPage - 1) * PAGE_SIZE + 1;
    }
    get endRecord() {
        return Math.min(
            this.currentPage * PAGE_SIZE, this.totalRecords);
    }
    get paginatedRoles() {
        const start = (this.currentPage - 1) * PAGE_SIZE;
        return this.filteredRoles.slice(start, start + PAGE_SIZE);
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

    handleRefresh() {
        if (this.wiredRolesResult) {
            refreshApex(this.wiredRolesResult);
        }
    }

    handleNew() { this.showModal = true; }

    handleModalClose() {
        this.showModal    = false;
        this.errorMessage = '';
        this.formData     = {
            name: '', location: '', billingUnit: 'Hour',
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

        createResourceRole({
            name:        this.formData.name,
            location:    this.formData.location,
            billingUnit: this.formData.billingUnit,
            price:       parseFloat(this.formData.price) || 0,
            cost:        parseFloat(this.formData.cost)  || 0,
            tags:        this.formData.tags
        })
        .then(() => {
            this.handleModalClose();
            if (this.wiredRolesResult) {
                refreshApex(this.wiredRolesResult);
            }
        })
        .catch(error => {
            this.errorMessage = error.body
                ? error.body.message : 'Error saving.';
        })
        .finally(() => { this.isSaving = false; });
    }

    handleToggle(event) {
        const roleId   = event.currentTarget.dataset.id;
        const isActive = event.target.checked;

        toggleActiveStatus({
            roleId:   roleId,
            isActive: isActive
        })
        .then(() => {
            if (this.wiredRolesResult) {
                refreshApex(this.wiredRolesResult);
            }
        })
        .catch(error => {
            console.error('Toggle error:', error);
        });
    }

    handleDelete(event) {
        const roleId = event.currentTarget.dataset.id;
        // eslint-disable-next-line no-alert
        if (!confirm('Delete this resource role?')) return;

        deleteResourceRole({ roleId: roleId })
        .then(() => {
            if (this.wiredRolesResult) {
                refreshApex(this.wiredRolesResult);
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