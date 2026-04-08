import { LightningElement, api, track, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getResourceRoles from
    '@salesforce/apex/ResourceRoleController.getResourceRoles';
import getProducts from
    '@salesforce/apex/ProductController.getProducts';
import getAddons from
    '@salesforce/apex/AddonController.getAddons';
import addLineItems from
    '@salesforce/apex/QuoteLineItemController.addLineItems';

export default class ProvusAddItemsModal extends LightningElement {

    @api isOpen      = false;
    @api quoteId     = '';
    @api targetPhase = ''; // The phase items will be added to

    @track activeTab    = 'resourceRoles';
    @track searchTerm   = '';
    @track sortBy       = 'name';
    @track isAdding     = false;
    _hasRefreshed       = false;

    wiredRolesResult;
    wiredProductsResult;
    wiredAddonsResult;

    // Raw data from wire
    @track allRoles    = [];
    @track allProducts = [];
    @track allAddons   = [];

    // Selected IDs
    @track selectedRRIds    = new Set();
    @track selectedProdIds  = new Set();
    @track selectedAddonIds = new Set();

    // ── Wire data ─────────────────────────────────────────────────────────
    @wire(getResourceRoles, { statusFilter: 'Active' })
    wiredRoles(result) {
        this.wiredRolesResult = result;
        const { data, error } = result;
        if (data) {
            this.allRoles = data.map(r => ({
                ...r,
                displayName:     r.Name__c,
                descriptionText: 'No description available',
                isSelected: false,
                itemClass: 'item-row'
            }));
        }
        if (error) console.error('RR error:', error);
    }

    @wire(getProducts, { searchTerm: '', statusFilter: 'Active' })
    wiredProducts(result) {
        this.wiredProductsResult = result;
        const { data, error } = result;
        if (data) {
            this.allProducts = data.map(p => ({
                ...p,
                displayName:     p.Name__c,
                descriptionText: 'No description available',
                isSelected: false,
                itemClass: 'item-row'
            }));
        }
        if (error) console.error('Products error:', error);
    }

    @wire(getAddons, { searchTerm: '', statusFilter: 'Active' })
    wiredAddons(result) {
        this.wiredAddonsResult = result;
        const { data, error } = result;
        if (data) {
            this.allAddons = data.map(a => ({
                ...a,
                displayName:     a.Name__c,
                descriptionText: 'No description available',
                isSelected: false,
                itemClass: 'item-row'
            }));
        }
        if (error) console.error('Addons error:', error);
    }

    // ── Tab computed ──────────────────────────────────────────────────────
    get showRRTab()    { return this.activeTab === 'resourceRoles'; }
    get showProdTab()  { return this.activeTab === 'products'; }
    get showAddonTab() { return this.activeTab === 'addons'; }

    get rrTabClass() {
        return this.activeTab === 'resourceRoles'
            ? 'modal-tab modal-tab-active' : 'modal-tab';
    }
    get prodTabClass() {
        return this.activeTab === 'products'
            ? 'modal-tab modal-tab-active' : 'modal-tab';
    }
    get addonTabClass() {
        return this.activeTab === 'addons'
            ? 'modal-tab modal-tab-active' : 'modal-tab';
    }

    // ── Sort computed ─────────────────────────────────────────────────────
    get nameSortClass() {
        return this.sortBy === 'name'
            ? 'sort-btn sort-btn-active' : 'sort-btn';
    }
    get priceSortClass() {
        return this.sortBy === 'price'
            ? 'sort-btn sort-btn-active' : 'sort-btn';
    }

    // ── Selected counts ───────────────────────────────────────────────────
    get selectedRRCount()    { return this.selectedRRIds.size; }
    get selectedProdCount()  { return this.selectedProdIds.size; }
    get selectedAddonCount() { return this.selectedAddonIds.size; }
    get totalSelected() {
        return this.selectedRRIds.size +
               this.selectedProdIds.size +
               this.selectedAddonIds.size;
    }

    get isLoadingItems() { return false; }

    // ── Filtered lists ────────────────────────────────────────────────────
    filterAndSort(items, selectedIds) {
        let filtered = items;

        // Search filter
        if (this.searchTerm) {
            const term = this.searchTerm.toLowerCase();
            filtered = filtered.filter(i =>
                (i.displayName || '').toLowerCase().includes(term)
            );
        }

        // Sort
        filtered = [...filtered].sort((a, b) => {
            if (this.sortBy === 'price') {
                return (a.Price__c || 0) - (b.Price__c || 0);
            }
            return (a.displayName || '').localeCompare(b.displayName || '');
        });

        // Add selection state
        return filtered.map(i => ({
            ...i,
            isSelected: selectedIds.has(i.Id),
            itemClass: selectedIds.has(i.Id)
                ? 'item-row item-row-selected'
                : 'item-row'
        }));
    }

    get filteredRoles() {
        return this.filterAndSort(
            this.allRoles, this.selectedRRIds);
    }
    get filteredProducts() {
        return this.filterAndSort(
            this.allProducts, this.selectedProdIds);
    }
    get filteredAddons() {
        return this.filterAndSort(
            this.allAddons, this.selectedAddonIds);
    }

    get isListEmpty() {
        if (this.activeTab === 'resourceRoles') {
            return this.filteredRoles.length === 0;
        }
        if (this.activeTab === 'products') {
            return this.filteredProducts.length === 0;
        }
        return this.filteredAddons.length === 0;
    }

    renderedCallback() {
        if (this.isOpen && !this._hasRefreshed) {
            this.refreshAll();
            this._hasRefreshed = true;
        } else if (!this.isOpen && this._hasRefreshed) {
            this._hasRefreshed = false;
        }
    }

    refreshAll() {
        if (this.wiredRolesResult)    refreshApex(this.wiredRolesResult);
        if (this.wiredProductsResult) refreshApex(this.wiredProductsResult);
        if (this.wiredAddonsResult)   refreshApex(this.wiredAddonsResult);
    }

    // ── Handlers ──────────────────────────────────────────────────────────
    handleTabClick(event) {
        this.activeTab  = event.currentTarget.dataset.tab;
        this.searchTerm = '';
    }

    handleSearch(event) {
        this.searchTerm = event.target.value;
    }

    handleSort(event) {
        this.sortBy = event.currentTarget.dataset.sort;
    }

    handleItemClick(event) {
        const id   = event.currentTarget.dataset.id;
        const type = event.currentTarget.dataset.type;
        this.toggleSelection(id, type);
    }

    handleCheckboxClick(event) {
        event.stopPropagation();
        const id   = event.currentTarget.dataset.id;
        const type = event.currentTarget.dataset.type;
        this.toggleSelection(id, type);
    }

    toggleSelection(id, type) {
        if (type === 'resourceRole') {
            const newSet = new Set(this.selectedRRIds);
            newSet.has(id) ? newSet.delete(id) : newSet.add(id);
            this.selectedRRIds = newSet;
        } else if (type === 'product') {
            const newSet = new Set(this.selectedProdIds);
            newSet.has(id) ? newSet.delete(id) : newSet.add(id);
            this.selectedProdIds = newSet;
        } else if (type === 'addon') {
            const newSet = new Set(this.selectedAddonIds);
            newSet.has(id) ? newSet.delete(id) : newSet.add(id);
            this.selectedAddonIds = newSet;
        }
    }

    // ── Add items to quote ────────────────────────────────────────────────
    handleAddItems() {
        if (this.totalSelected === 0) return;

        this.isAdding = true;

        addLineItems({
            quoteId:         this.quoteId,
            resourceRoleIds: [...this.selectedRRIds],
            productIds:      [...this.selectedProdIds],
            addonIds:        [...this.selectedAddonIds],
            phaseName:       this.targetPhase
        })
        .then(() => {
            this.resetSelections();
            this.dispatchEvent(new CustomEvent('itemsadded'));
        })
        .catch(error => {
            console.error('Add items error:', error);
        })
        .finally(() => {
            this.isAdding = false;
        });
    }

    handleClose() {
        this.resetSelections();
        this.dispatchEvent(new CustomEvent('close'));
    }

    handleOverlayClick() {
        this.handleClose();
    }

    resetSelections() {
        this.selectedRRIds    = new Set();
        this.selectedProdIds  = new Set();
        this.selectedAddonIds = new Set();
        this.searchTerm       = '';
        this.activeTab        = 'resourceRoles';
    }
}