import { LightningElement, track, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getProducts from
    '@salesforce/apex/ProductController.getProducts';
import createProduct from
    '@salesforce/apex/ProductController.createProduct';
import toggleActiveStatus from
    '@salesforce/apex/ProductController.toggleActiveStatus';
import deleteProduct from
    '@salesforce/apex/ProductController.deleteProduct';

const PAGE_SIZE = 10;

export default class ProvusProductsList extends LightningElement {

    @track allProducts  = [];
    @track searchTerm   = '';
    @track currentPage  = 1;
    @track showModal    = false;
    @track isSaving     = false;
    @track errorMessage = '';
    @track formData     = {
        name: '', billingUnit: 'Each',
        price: 0, cost: 0, tags: ''
    };

    wiredProductsResult = undefined;

    @wire(getProducts, { searchTerm: '' })
    wiredProducts(result) {
        this.wiredProductsResult = result;
        if (result.data) {
            this.allProducts = result.data.map((p, i) => ({
                ...p,
                rowNumber:      i + 1,
                formattedPrice: this.fmt(p.Price__c),
                formattedCost:  p.Cost__c
                    ? this.fmt(p.Cost__c) : '—',
                tagsDisplay:    p.Tags__c || '-'
            }));
        }
    }

    fmt(value) {
        if (value == null) return '$0.00';
        return '$' + Number(value).toLocaleString('en-US', {
            minimumFractionDigits: 2
        });
    }

    get filteredProducts() {
        if (!this.searchTerm) return this.allProducts;
        const term = this.searchTerm.toLowerCase();
        return this.allProducts.filter(p =>
            (p.Name || '').toLowerCase().includes(term)
        );
    }

    get totalRecords() { return this.filteredProducts.length; }
    get totalPages() {
        return Math.max(1,
            Math.ceil(this.totalRecords / PAGE_SIZE));
    }
    get isFirstPage() { return this.currentPage === 1; }
    get isLastPage()  {
        return this.currentPage >= this.totalPages;
    }
    get isEmpty()     { return this.filteredProducts.length === 0; }
    get startRecord() {
        return this.totalRecords === 0
            ? 0 : (this.currentPage - 1) * PAGE_SIZE + 1;
    }
    get endRecord() {
        return Math.min(
            this.currentPage * PAGE_SIZE, this.totalRecords);
    }
    get paginatedProducts() {
        const start = (this.currentPage - 1) * PAGE_SIZE;
        return this.filteredProducts.slice(
            start, start + PAGE_SIZE);
    }

    handleSearch(event) {
        this.searchTerm  = event.target.value;
        this.currentPage = 1;
    }

    handleRefresh() {
        if (this.wiredProductsResult) {
            refreshApex(this.wiredProductsResult);
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

        createProduct({
            name:        this.formData.name,
            billingUnit: this.formData.billingUnit,
            price:       parseFloat(this.formData.price) || 0,
            cost:        parseFloat(this.formData.cost)  || 0,
            tags:        this.formData.tags
        })
        .then(() => {
            this.handleModalClose();
            if (this.wiredProductsResult) {
                refreshApex(this.wiredProductsResult);
            }
        })
        .catch(error => {
            this.errorMessage = error.body
                ? error.body.message : 'Error saving.';
        })
        .finally(() => { this.isSaving = false; });
    }

    handleToggle(event) {
        const productId = event.currentTarget.dataset.id;
        const isActive  = event.target.checked;

        toggleActiveStatus({
            productId: productId,
            isActive:  isActive
        })
        .then(() => {
            if (this.wiredProductsResult) {
                refreshApex(this.wiredProductsResult);
            }
        })
        .catch(error => console.error('Toggle error:', error));
    }

    handleDelete(event) {
        const productId = event.currentTarget.dataset.id;
        // eslint-disable-next-line no-alert
        if (!confirm('Delete this product?')) return;

        deleteProduct({ productId: productId })
        .then(() => {
            if (this.wiredProductsResult) {
                refreshApex(this.wiredProductsResult);
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