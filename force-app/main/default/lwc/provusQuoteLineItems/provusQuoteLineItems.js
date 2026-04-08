import { LightningElement, api, track, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getLineItems from '@salesforce/apex/QuoteLineItemController.getLineItems';
import getPhaseList from '@salesforce/apex/QuoteLineItemController.getPhaseList';
import savePhaseList from '@salesforce/apex/QuoteLineItemController.savePhaseList';
import updateLineItem from '@salesforce/apex/QuoteLineItemController.updateLineItem';
import deleteLineItems from '@salesforce/apex/QuoteLineItemController.deleteLineItems';

export default class ProvusQuoteLineItems extends LightningElement {

    @api quoteId;
    @api quoteStatus;

    @track showAddModal = false;
    @track lineItems = [];
    @track phases = [];
    @track collapsedPhases = new Set();

    // Selection state
    @track selectedItemIds = new Set();

    // Drag state
    draggedItemId = null;
    @track dragOverPhase = null;
    @track targetPhase = '';

    wiredItemsResult = undefined;
    wiredPhaseListResult = undefined;

    // ── Getters for UI ─────────────────────────────────────────────────────
    get selectedCount() { return this.selectedItemIds.size; }
    get hasSelection()  { return this.selectedItemIds.size > 0; }
    get isAllSelected() {
        return this.lineItems.length > 0 && this.selectedItemIds.size === this.lineItems.length;
    }

    // ── Wire Phase List ───────────────────────────────────────────────────
    @wire(getPhaseList, { quoteId: '$quoteId' })
    wiredPhaseList(result) {
        this.wiredPhaseListResult = result;
        if (result.data) {
            try {
                this.phases = JSON.parse(result.data);
            } catch(e) {
                this.phases = result.data.split(',').map(s => s.trim()).filter(x => x);
            }
        } else if (result.error) {
            this.phases = [];
        }
    }

    // ── Wire Line Items ───────────────────────────────────────────────────
    @wire(getLineItems, { quoteId: '$quoteId' })
    wiredItems(result) {
        this.wiredItemsResult = result;
        if (result.data) {
            this.lineItems = result.data.map(item => ({
                ...item,
                Task__c:                item.Task__c || '',
                Start_Date__c:          item.Start_Date__c || '',
                End_Date__c:            item.End_Date__c || '',
                Duration__c:            item.Duration__c != null ? item.Duration__c : 1,
                Quantity__c:            item.Quantity__c != null ? item.Quantity__c : 1,
                typeIcon:               this.getTypeIcon(item.Item_Type__c),
                typeIconClass:          this.getTypeIconClass(item.Item_Type__c),
                billingBadgeClass:      this.getBillingBadgeClass(item.Billing_Unit__c),
                // Duration is only applicable for time-based billing (Hour, Day)
                durationDisabled:       item.Billing_Unit__c === 'Each',
                showEndDate:            item.Billing_Unit__c !== 'Each',
                formattedBaseRate:      this.formatCurrency(item.Base_Rate__c),
                formattedUnitPrice:     this.formatCurrency(item.Unit_Price__c),
                formattedTotal:         this.formatCurrency(item.Line_Total__c),
                selected:               this.selectedItemIds.has(item.Id)
            }));
        } else if (result.error) {
            console.error('Line items error:', result.error);
            this.lineItems = [];
        }
    }

    // ── Tree Data Logic ───────────────────────────────────────────────────
    get displayRows() {
        const rows = [];

        // Root items (no phase)
        const rootItems = this.lineItems.filter(i => !i.Phase__c);
        rootItems.forEach(item => {
            rows.push({
                isItem: true,
                isPhase: false,
                record: { ...item, selected: this.selectedItemIds.has(item.Id) },
                rowClass: 'item-row root-item'
            });
        });

        // All distinct phases
        const itemPhases = new Set(this.lineItems.filter(i => i.Phase__c).map(i => i.Phase__c));
        const allPhases  = Array.from(new Set([...this.phases, ...itemPhases]));

        allPhases.forEach(phaseName => {
            const children   = this.lineItems.filter(i => i.Phase__c === phaseName);
            const isCollapsed = this.collapsedPhases.has(phaseName);
            const isDragOver  = this.dragOverPhase === phaseName;
            const phaseSelected = children.length > 0 && children.every(c => this.selectedItemIds.has(c.Id));

            rows.push({
                isPhase: true,
                isItem: false,
                phaseName:    phaseName,
                isCollapsed:  isCollapsed,
                phaseSelected: phaseSelected,
                chevron:      isCollapsed ? '›' : 'v',
                dragOverClass: isDragOver ? 'phase-row drop-target-active' : 'phase-row'
            });

            if (!isCollapsed) {
                children.forEach(item => {
                    rows.push({
                        isItem: true,
                        isPhase: false,
                        record: { ...item, selected: this.selectedItemIds.has(item.Id) },
                        rowClass: 'item-row nested-item'
                    });
                });
            }
        });

        return rows;
    }

    get isEmpty()    { return this.lineItems.length === 0 && this.phases.length === 0; }
    get grandTotal() {
        const total = this.lineItems.reduce((sum, item) => sum + (item.Line_Total__c || 0), 0);
        return this.formatCurrency(total);
    }

    // ── Phase Collapse ────────────────────────────────────────────────────
    handleTogglePhase(event) {
        const phase = event.currentTarget.dataset.phase;
        if (this.collapsedPhases.has(phase)) {
            this.collapsedPhases.delete(phase);
        } else {
            this.collapsedPhases.add(phase);
        }
        this.collapsedPhases = new Set(this.collapsedPhases);
    }

    handleCollapseAll() {
        const allPhases = new Set([...this.phases, ...this.lineItems.map(i => i.Phase__c).filter(x => x)]);
        if (this.collapsedPhases.size === allPhases.size) {
            this.collapsedPhases = new Set();
        } else {
            this.collapsedPhases = allPhases;
        }
    }

    // ── Selection Logic ──────────────────────────────────────────────────
    handleSelectItem(event) {
        const itemId  = event.target.dataset.id;
        const checked = event.target.checked;
        if (checked) {
            this.selectedItemIds.add(itemId);
        } else {
            this.selectedItemIds.delete(itemId);
        }
        this.selectedItemIds = new Set(this.selectedItemIds);
    }

    handleSelectAll(event) {
        const checked = event.target.checked;
        this.selectedItemIds = checked
            ? new Set(this.lineItems.map(i => i.Id))
            : new Set();
    }

    handleSelectPhase(event) {
        const phaseName   = event.target.dataset.phase;
        const checked     = event.target.checked;
        const phaseItemIds = this.lineItems.filter(i => i.Phase__c === phaseName).map(i => i.Id);

        if (checked) {
            phaseItemIds.forEach(id => this.selectedItemIds.add(id));
        } else {
            phaseItemIds.forEach(id => this.selectedItemIds.delete(id));
        }
        this.selectedItemIds = new Set(this.selectedItemIds);
    }

    handleClearSelection() { this.selectedItemIds = new Set(); }

    handleBulkDelete() {
        if (this.selectedItemIds.size === 0) return;
        const idsToDelete = Array.from(this.selectedItemIds);

        // eslint-disable-next-line no-alert
        if (!confirm(`Are you sure you want to delete ${idsToDelete.length} selected item(s)?`)) return;

        deleteLineItems({ itemIds: idsToDelete })
            .then(() => {
                this.selectedItemIds = new Set();
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Success',
                    message: `${idsToDelete.length} item(s) deleted successfully`,
                    variant: 'success'
                }));
                if (this.wiredItemsResult) refreshApex(this.wiredItemsResult);
                this.dispatchEvent(new CustomEvent('lineitemsupdated'));
            })
            .catch(error => {
                console.error('Delete error:', error);
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Error',
                    message: 'Failed to delete items: ' + (error.body ? error.body.message : error.message),
                    variant: 'error'
                }));
            });
    }

    // ── Drag and Drop Logic ──────────────────────────────────────────────
    handleDragStart(event) {
        this.draggedItemId = event.currentTarget.dataset.id;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', this.draggedItemId);
    }

    handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        const phase = event.currentTarget.dataset.phase || null;
        if (this.dragOverPhase !== phase) this.dragOverPhase = phase;
    }

    handleDragLeave() { this.dragOverPhase = null; }

    handleDrop(event) {
        event.preventDefault();
        const targetPhase = event.currentTarget.dataset.phase || null;
        this.dragOverPhase = null;
        if (!this.draggedItemId) return;

        const itemIndex = this.lineItems.findIndex(i => i.Id === this.draggedItemId);
        if (itemIndex > -1) {
            const currentPhase = this.lineItems[itemIndex].Phase__c || null;
            if (currentPhase === targetPhase) return;

            this.lineItems[itemIndex] = { ...this.lineItems[itemIndex], Phase__c: targetPhase };
            this.lineItems = [...this.lineItems];

            updateLineItem({ item: { Id: this.draggedItemId, Phase__c: targetPhase } })
                .then(() => { if (this.wiredItemsResult) return refreshApex(this.wiredItemsResult); })
                .then(() => { this.dispatchEvent(new CustomEvent('lineitemsupdated')); })
                .catch(error => {
                    console.error('Update phase error:', error);
                    refreshApex(this.wiredItemsResult);
                });
        }
        this.draggedItemId = null;
    }

    // ── Field Editing ─────────────────────────────────────────────────────
    handleFieldChange(event) {
        const itemId = event.currentTarget.dataset.id;
        const field  = event.currentTarget.dataset.field;
        let   value  = event.target.value;

        // Validate Quantity — whole numbers only
        if (field === 'Quantity__c') {
            const qty = parseInt(value, 10);
            if (!isNaN(qty) && qty >= 0) {
                value = qty;
                event.target.value = value;
            } else {
                event.target.value = 1;
                value = 1;
            }
        }

        // Validate Duration — 2 decimal places, positive
        if (field === 'Duration__c') {
            const dur = parseFloat(value);
            if (!isNaN(dur) && dur >= 0) {
                value = Math.round(dur * 100) / 100;
                event.target.value = value;
            } else {
                event.target.value = 1;
                value = 1;
            }
        }

        // Validate Discount — 0 to 100 (whole percentage, e.g. 10 = 10%)
        if (field === 'Discount_Percent__c') {
            const discount = parseFloat(value);
            if (isNaN(discount) || discount < 0 || discount > 100) {
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Invalid Discount',
                    message: 'Discount must be between 0 and 100 (e.g. enter 10 for 10% off).',
                    variant: 'error'
                }));
                const item = this.lineItems.find(i => i.Id === itemId);
                if (item) event.target.value = item.Discount_Percent__c || 0;
                return;
            }
        }

        // Validate Unit Price
        if (field === 'Unit_Price__c') {
            const price = parseFloat(value);
            if (price < 0) {
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Invalid Price',
                    message: 'Price cannot be negative.',
                    variant: 'error'
                }));
                const item = this.lineItems.find(i => i.Id === itemId);
                if (item) event.target.value = item.Unit_Price__c || 0;
                return;
            }
        }

        updateLineItem({ item: { Id: itemId, [field]: value } })
            .then(() => { if (this.wiredItemsResult) return refreshApex(this.wiredItemsResult); })
            .then(() => { this.dispatchEvent(new CustomEvent('lineitemsupdated')); })
            .catch(error => console.error('Update error:', error));
    }

    // ── Add Phase / Add Item ──────────────────────────────────────────────
    handleAddPhase() {
        // eslint-disable-next-line no-alert
        const phaseName = prompt('Enter new Phase Name:');
        if (!phaseName || !phaseName.trim()) return;

        const newPhase = phaseName.trim();
        if (!this.phases.includes(newPhase)) {
            const newPhases = [...this.phases, newPhase];
            savePhaseList({ quoteId: this.quoteId, phaseList: JSON.stringify(newPhases) })
                .then(() => refreshApex(this.wiredPhaseListResult))
                .catch(err => console.error('Error saving phase', err));
        }
    }

    handleAddItem(event) {
        this.targetPhase = event.currentTarget.dataset.phase || '';
        this.showAddModal = true;
    }

    handleModalClose() { this.showAddModal = false; }

    handleItemsAdded() {
        this.showAddModal = false;
        if (this.wiredItemsResult) refreshApex(this.wiredItemsResult);
        this.dispatchEvent(new CustomEvent('lineitemsupdated'));
    }

    // ── Formatters & Helpers ──────────────────────────────────────────────
    getTypeIcon(type) {
        if (type === 'Resource Role') return '👤';
        if (type === 'Product')       return '📦';
        if (type === 'Add-on')        return '✨';
        return '📋';
    }

    getTypeIconClass(type) {
        return 'type-icon icon-' + (type ? type.toLowerCase().replace(' ', '') : 'default');
    }

    getBillingBadgeClass(billingUnit) {
        if (billingUnit === 'Hour') return 'billing-badge billing-badge-hour';
        if (billingUnit === 'Day')  return 'billing-badge billing-badge-day';
        return 'billing-badge billing-badge-each';
    }

    formatCurrency(value) {
        if (value == null) return '$0.00';
        return '$' + Number(value).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }
}