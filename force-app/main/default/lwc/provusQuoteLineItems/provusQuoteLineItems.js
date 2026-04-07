import { LightningElement, api, track, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getLineItems from
    '@salesforce/apex/QuoteLineItemController.getLineItems';
import updateLineItem from
    '@salesforce/apex/QuoteLineItemController.updateLineItem';
import deleteLineItem from
    '@salesforce/apex/QuoteLineItemController.deleteLineItem';

export default class ProvusQuoteLineItems extends LightningElement {

    @api quoteId;
    @api quoteStatus;

    @track showAddModal = false;
    @track lineItems    = [];

    wiredItemsResult = undefined;

    // ── Wire line items ───────────────────────────────────────────────────
    @wire(getLineItems, { quoteId: '$quoteId' })
    wiredItems(result) {
        this.wiredItemsResult = result;
        if (result.data) {
            this.lineItems = result.data.map(item => {
                return {
                    ...item,
                    typeIcon: this.getTypeIcon(item.Item_Type__c),
                    typeIconClass: this.getTypeIconClass(
                        item.Item_Type__c),
                    formattedBaseRate: this.formatCurrency(
                        item.Base_Rate__c),
                    formattedUnitPrice: this.formatCurrency(
                        item.Unit_Price__c),
                    formattedTotal: this.formatCurrency(
                        item.Total_Price__c)
                };
            });
        } else if (result.error) {
            console.error('Line items error:', result.error);
            this.lineItems = [];
        }
    }

    // ── Helper: type icon ─────────────────────────────────────────────────
    getTypeIcon(type) {
        if (type === 'Resource Role') return '👤';
        if (type === 'Product')       return '📦';
        if (type === 'Add-on')        return '✨';
        return '📋';
    }

    getTypeIconClass(type) {
        if (type === 'Resource Role') return 'type-icon icon-role';
        if (type === 'Product')       return 'type-icon icon-product';
        if (type === 'Add-on')        return 'type-icon icon-addon';
        return 'type-icon';
    }

    // ── Helper: format currency ───────────────────────────────────────────
    formatCurrency(value) {
        if (value == null) return '$0.00';
        return '$' + Number(value).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    // ── Computed ──────────────────────────────────────────────────────────
    get isEmpty() { return this.lineItems.length === 0; }

    get grandTotal() {
        const total = this.lineItems.reduce((sum, item) => {
            return sum + (item.Total_Price__c || 0);
        }, 0);
        return this.formatCurrency(total);
    }

    // ── Field change → update line item ──────────────────────────────────
    handleFieldChange(event) {
        const itemId = event.currentTarget.dataset.id;
        const field  = event.currentTarget.dataset.field;
        const value  = event.target.value;

        // Discount validation
        if (field === 'Discount_Percent__c') {
            const discount = parseFloat(value);
            if (discount < 0 || discount > 100) {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Invalid Discount',
                        message: 'Discount percentage must be between 0 and 100.',
                        variant: 'error'
                    })
                );
                
                // Revert input field visually to the last known valid state
                const item = this.lineItems.find(i => i.Id === itemId);
                if (item) {
                    event.target.value = item.Discount_Percent__c || 0;
                }
                return;
            }
        }

        updateLineItem({
            item: {
                Id:     itemId,
                [field]: value
            }
        })
        .then(() => {
            if (this.wiredItemsResult) {
                return refreshApex(this.wiredItemsResult);
            }
        })
        .then(() => {
            // Tell parent to refresh quote totals
            this.dispatchEvent(
                new CustomEvent('lineitemsupdated')
            );
        })
        .catch(error => {
            console.error('Update error:', error);
        });
    }

    // ── Unit price click ──────────────────────────────────────────────────
    handleUnitPriceClick(event) {
        const itemId = event.currentTarget.dataset.id;
        // eslint-disable-next-line no-alert
        const newPrice = prompt('Enter new Unit Price:');
        if (newPrice === null || newPrice === '') return;

        const price = parseFloat(newPrice);
        if (isNaN(price)) return;

        updateLineItem({
            item: {
                Id:            itemId,
                Unit_Price__c: price
            }
        })
        .then(() => {
            if (this.wiredItemsResult) {
                refreshApex(this.wiredItemsResult);
            }
            this.dispatchEvent(
                new CustomEvent('lineitemsupdated')
            );
        })
        .catch(error => {
            console.error('Unit price update error:', error);
        });
    }

    // ── Add Phase ─────────────────────────────────────────────────────────
    handleAddPhase() {
        // eslint-disable-next-line no-alert
        alert('Add Phase — coming soon!');
    }

    // ── Add Item modal ────────────────────────────────────────────────────
    handleAddItem() {
        this.showAddModal = true;
    }

    handleModalClose() {
        this.showAddModal = false;
    }

    handleItemsAdded() {
        this.showAddModal = false;
        if (this.wiredItemsResult) {
            refreshApex(this.wiredItemsResult);
        }
        this.dispatchEvent(new CustomEvent('lineitemsupdated'));
    }

    handleCollapseAll() {
        // stub for now
    }
}