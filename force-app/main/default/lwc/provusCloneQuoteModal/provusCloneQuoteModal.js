import { LightningElement, api, track, wire } from 'lwc';
import getAccountsForFilter from '@salesforce/apex/QuoteController.getAccountsForFilter';
import cloneQuote from '@salesforce/apex/QuoteController.cloneQuote';

export default class ProvusCloneQuoteModal extends LightningElement {
    @api isOpen = false;
    @api quoteId;
    @api quoteNumber;

    @track selectedAccountId = null;
    @track isCloning = false;
    @track errorMessage = '';
    @track accountOptions = [];

    @wire(getAccountsForFilter)
    wiredAccounts({ data, error }) {
        if (data) {
            this.accountOptions = data;
        } else if (error) {
            console.error('Error fetching accounts:', error);
        }
    }

    get cloneButtonLabel() {
        return this.isCloning ? 'Cloning...' : 'Clone Quote';
    }

    handleAccountChange(event) {
        this.selectedAccountId = event.target.value;
    }

    handleClose() {
        if (this.isCloning) return;
        this.dispatchEvent(new CustomEvent('close'));
    }

    handleClone() {
        if (!this.quoteId) return;

        this.isCloning = true;
        this.errorMessage = '';

        cloneQuote({ 
            quoteId: this.quoteId, 
            accountId: this.selectedAccountId 
        })
        .then(clonedQuoteId => {
            this.dispatchEvent(new CustomEvent('cloned', {
                detail: { quoteId: clonedQuoteId }
            }));
            this.handleClose();
        })
        .catch(error => {
            console.error('Clone error:', error);
            this.errorMessage = error.body ? error.body.message : 'Error cloning quote.';
        })
        .finally(() => {
            this.isCloning = false;
        });
    }
}
