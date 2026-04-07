import { LightningElement, api, track, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getLineItems from '@salesforce/apex/QuoteLineItemController.getLineItems';
import getPhaseList from '@salesforce/apex/QuoteLineItemController.getPhaseList';
import savePhaseList from '@salesforce/apex/QuoteLineItemController.savePhaseList';
import updateLineItem from '@salesforce/apex/QuoteLineItemController.updateLineItem';

// Helper for generating unique IDs for drag payload
const generateId = () => Math.random().toString(36).substring(2, 10);

export default class ProvusQuoteLineItems extends LightningElement {

    @api quoteId;
    @api quoteStatus;

    @track showAddModal = false;
    @track lineItems = [];
    @track phases = []; // Extracted from comma separated Phase_List__c
    @track collapsedPhases = new Set();
    
    // Drag state
    draggedItemId = null;
    @track dragOverPhase = null;
    @track targetPhase = ''; // Phase for adding new items

    wiredItemsResult = undefined;
    wiredPhaseListResult = undefined;

    // ── Wire Phase List ───────────────────────────────────────────────────
    @wire(getPhaseList, { quoteId: '$quoteId' })
    wiredPhaseList(result) {
        this.wiredPhaseListResult = result;
        if (result.data) {
            try {
                this.phases = JSON.parse(result.data);
            } catch(e) {
                // simple comma separation fallback if not JSON
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
                Task__c: item.Task__c || '',
                Start_Date__c: item.Start_Date__c || '',
                End_Date__c: item.End_Date__c || '',
                typeIcon: this.getTypeIcon(item.Item_Type__c),
                typeIconClass: this.getTypeIconClass(item.Item_Type__c),
                formattedBaseRate: this.formatCurrency(item.Base_Rate__c),
                formattedUnitPrice: this.formatCurrency(item.Unit_Price__c),
                formattedTotal: this.formatCurrency(item.Total_Price__c)
            }));
        } else if (result.error) {
            console.error('Line items error:', result.error);
            this.lineItems = [];
        }
    }

    // ── Tree Data Logic ───────────────────────────────────────────────────
    get displayRows() {
        const rows = [];
        
        // 1. Root items (Phase__c == null)
        const rootItems = this.lineItems.filter(i => !i.Phase__c);
        rootItems.forEach(item => {
            rows.push({
                isItem: true,
                isPhase: false,
                record: item,
                rowClass: 'item-row root-item'
            });
        });

        // Collect all distinct phases
        const itemPhases = new Set(this.lineItems.filter(i => i.Phase__c).map(i => i.Phase__c));
        const allPhases = Array.from(new Set([...this.phases, ...itemPhases]));

        // 2. Loop through phases and insert headers/children
        allPhases.forEach(phaseName => {
            const children = this.lineItems.filter(i => i.Phase__c === phaseName);
            const isCollapsed = this.collapsedPhases.has(phaseName);
            const isDragOver = this.dragOverPhase === phaseName;
            
            // Phase row
            rows.push({
                isPhase: true,
                isItem: false,
                phaseName: phaseName,
                isCollapsed: isCollapsed,
                chevron: isCollapsed ? '›' : 'v',
                dragOverClass: isDragOver ? 'phase-row drop-target-active' : 'phase-row'
            });

            // Children rows
            if (!isCollapsed) {
                children.forEach(item => {
                    rows.push({
                        isItem: true,
                        isPhase: false,
                        record: item,
                        rowClass: 'item-row nested-item'
                    });
                });
            }
        });

        return rows;
    }

    get isEmpty() {
        return this.lineItems.length === 0 && this.phases.length === 0;
    }

    get grandTotal() {
        const total = this.lineItems.reduce((sum, item) => sum + (item.Total_Price__c || 0), 0);
        return this.formatCurrency(total);
    }

    // Toggle Phase Collapse
    handleTogglePhase(event) {
        const phase = event.currentTarget.dataset.phase;
        if (this.collapsedPhases.has(phase)) {
            this.collapsedPhases.delete(phase);
        } else {
            this.collapsedPhases.add(phase);
        }
        // Force reactivity since Set mutations aren't tracked
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

    // ── Drag and Drop Logic ──────────────────────────────────────────────
    handleDragStart(event) {
        this.draggedItemId = event.currentTarget.dataset.id;
        event.dataTransfer.effectAllowed = 'move';
        // Need to set data to make it draggable in Firefox
        event.dataTransfer.setData('text/plain', this.draggedItemId);
    }

    handleDragOver(event) {
        event.preventDefault(); // Necessary to allow dropping
        event.dataTransfer.dropEffect = 'move';
        
        const phase = event.currentTarget.dataset.phase || null;
        if (this.dragOverPhase !== phase) {
            this.dragOverPhase = phase;
        }
    }

    handleDragLeave(event) {
        this.dragOverPhase = null;
    }

    handleDrop(event) {
        event.preventDefault();
        const targetPhase = event.currentTarget.dataset.phase || null;
        this.dragOverPhase = null;

        if (!this.draggedItemId) return;

        // Immediately update local array for instant UI feedback
        const itemIndex = this.lineItems.findIndex(i => i.Id === this.draggedItemId);
        if (itemIndex > -1) {
            const currentPhase = this.lineItems[itemIndex].Phase__c || null;
            if (currentPhase === targetPhase) return; // Dropped in the same phase

            // Optimistic UI update
            this.lineItems[itemIndex] = { ...this.lineItems[itemIndex], Phase__c: targetPhase };
            this.lineItems = [...this.lineItems];

            // Persist to server
            updateLineItem({ item: { Id: this.draggedItemId, Phase__c: targetPhase } })
                .then(() => {
                    this.dispatchEvent(new CustomEvent('lineitemsupdated'));
                })
                .catch(error => {
                    console.error('Update phase error:', error);
                    refreshApex(this.wiredItemsResult); // Revert on failure
                });
        }
        this.draggedItemId = null;
    }


    // ── Field Editing & Standard Handlers ─────────────────────────────────
    handleFieldChange(event) {
        const itemId = event.currentTarget.dataset.id;
        const field  = event.currentTarget.dataset.field;
        let value    = event.target.value;

        if (field === 'Quantity__c') {
            const qty = parseFloat(value);
            if (!isNaN(qty)) {
                // Round to 1 decimal place
                value = Math.round(qty * 10) / 10;
                event.target.value = value;
            }
        }

        if (field === 'Discount_Percent__c') {
            const discount = parseFloat(value);
            if (discount < 0 || discount > 100) {
                this.dispatchEvent(new ShowToastEvent({ title: 'Invalid Discount', message: 'Discount percentage must be between 0 and 100.', variant: 'error' }));
                const item = this.lineItems.find(i => i.Id === itemId);
                if (item) event.target.value = item.Discount_Percent__c || 0;
                return;
            }
        }

        updateLineItem({ item: { Id: itemId, [field]: value } })
        .then(() => { if (this.wiredItemsResult) return refreshApex(this.wiredItemsResult); })
        .then(() => { this.dispatchEvent(new CustomEvent('lineitemsupdated')); })
        .catch(error => console.error('Update error:', error));
    }

    handleUnitPriceClick(event) {
        const itemId = event.currentTarget.dataset.id;
        // eslint-disable-next-line no-alert
        const newPrice = prompt('Enter new Unit Price:');
        if (newPrice === null || newPrice === '') return;
        const price = parseFloat(newPrice);
        if (isNaN(price)) return;

        updateLineItem({ item: { Id: itemId, Unit_Price__c: price } })
        .then(() => {
            if (this.wiredItemsResult) refreshApex(this.wiredItemsResult);
            this.dispatchEvent(new CustomEvent('lineitemsupdated'));
        })
        .catch(error => console.error('Unit price error:', error));
    }

    // ── Add Phase / Add Item ──────────────────────────────────────────────
    handleAddPhase() {
        // eslint-disable-next-line no-alert
        const phaseName = prompt('Enter new Phase Name:');
        if (!phaseName || !phaseName.trim()) return;
        
        const newPhase = phaseName.trim();
        if(!this.phases.includes(newPhase)) {
            const newPhases = [...this.phases, newPhase];
            savePhaseList({ quoteId: this.quoteId, phaseList: JSON.stringify(newPhases) })
                .then(() => {
                    return refreshApex(this.wiredPhaseListResult);
                })
                .catch(err => console.error('Error saving phase', err));
        }
    }

    handleAddItem(event) {
        this.targetPhase = event.currentTarget.dataset.phase || '';
        this.showAddModal = true;
    }

    handleModalClose() {
        this.showAddModal = false;
    }

    handleItemsAdded() {
        this.showAddModal = false;
        if (this.wiredItemsResult) refreshApex(this.wiredItemsResult);
        this.dispatchEvent(new CustomEvent('lineitemsupdated'));
    }

    // ── Formatters ────────────────────────────────────────────────────────
    getTypeIcon(type) {
        if (type === 'Resource Role') return '👤';
        if (type === 'Product')       return '📦';
        if (type === 'Add-on')        return '✨';
        return '📋';
    }
    getTypeIconClass(type) { return 'type-icon icon-' + (type ? type.toLowerCase().replace(' ', '') : 'default'); }
    formatCurrency(value) {
        if (value == null) return '$0.00';
        return '$' + Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
}