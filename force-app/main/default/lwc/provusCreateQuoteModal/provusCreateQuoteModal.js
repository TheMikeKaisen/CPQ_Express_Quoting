import { LightningElement, api, track, wire } from 'lwc';
import getOpportunities from '@salesforce/apex/OpportunityController.getOpportunities';
import getOpportunityById from '@salesforce/apex/OpportunityController.getOpportunityById';
import getAccounts from '@salesforce/apex/AccountController.getAccounts';
import createQuote from '@salesforce/apex/QuoteController.createQuote';

export default class ProvusCreateQuoteModal extends LightningElement {

    @api isOpen = false;

    // Form values
    @track opportunityId  = '';
    @track accountName    = '';
    @track accountId      = '';
    @track description    = '';
    @track startDate      = new Date().toISOString().split('T')[0];
    @track endDate        = '';
    @track timePeriod     = 'Days';

    // UI state
    @track errorMessage   = '';
    @track isCreating     = false;

    // ── FIX: store opportunities as a tracked array ───────────────────────
    @track opportunityList = [];
    @track accountList = [];

    // ── FIX: wire result handled properly ────────────────────────────────
    @wire(getOpportunities)
    wiredOpportunities({ data, error }) {
        if (data) {
            this.opportunityList = data;
        } else if (error) {
            console.error('Error loading opportunities:', error);
            this.opportunityList = [];
        }
    }

    @wire(getAccounts, { typeFilter: 'All', industryFilter: 'All' })
    wiredAccounts({ data, error }) {
        if (data) {
            this.accountList = data;
        } else if (error) {
            console.error('Error loading accounts:', error);
            this.accountList = [];
        }
    }

    // Character count
    get descriptionLength() {
        return this.description ? this.description.length : 0;
    }

    get isAccountDisabled() {
        return !!this.opportunityId;
    }

    // ── Opportunity selected → auto fill account ──────────────────────────
    handleOpportunityChange(event) {
        this.opportunityId = event.target.value;

        if (!this.opportunityId) {
            this.accountId   = '';
            this.accountName = '';
            return;
        }

        // ── Try to find Account info in the already-loaded list first ──────
        const selectedOpp = this.opportunityList.find(opp => opp.Id === this.opportunityId);
        if (selectedOpp && selectedOpp.AccountId) {
            this.accountId   = selectedOpp.AccountId;
            this.accountName = selectedOpp.Account ? selectedOpp.Account.Name : 'Account loaded';
        } else {
            // Fallback to Apex if not found in list for some reason
            getOpportunityById({ oppId: this.opportunityId })
                .then(opp => {
                    if (opp) {
                        this.accountId   = opp.AccountId;
                        this.accountName = opp.Account ? opp.Account.Name : 'Account loaded';
                    }
                })
                .catch(error => {
                    console.error('Error fetching opportunity:', error);
                });
        }
    }

    handleAccountChange(event) {
        this.accountId = event.target.value;
    }

    handleDescriptionChange(event) {
        this.description = event.target.value;
    }

    handleStartDateChange(event) {
        this.startDate = event.target.value;
    }

    handleEndDateChange(event) {
        this.endDate = event.target.value;
    }

    handleTimePeriodChange(event) {
        this.timePeriod = event.target.value;
    }

    // ── Validation ────────────────────────────────────────────────────────
    validate() {
        if (!this.accountId) {
            this.errorMessage = 'Please select an Account.';
            return false;
        }
        if (!this.startDate) {
            this.errorMessage = 'Please select a Start Date.';
            return false;
        }
        if (!this.timePeriod) {
            this.errorMessage = 'Please select a Time Period.';
            return false;
        }
        this.errorMessage = '';
        return true;
    }

    // ── Create quote ──────────────────────────────────────────────────────
    handleCreate() {
        if (!this.validate()) return;

        this.isCreating = true;
        this.errorMessage = '';

        createQuote({
            opportunityId: this.opportunityId || null,
            accountId: this.accountId || null,
            description: this.description,
            startDate: this.startDate || null,
            endDate: this.endDate || null,
            timePeriod: this.timePeriod
        })
        .then(newQuoteId => {
            this.dispatchEvent(new CustomEvent('quotecreated', {
                detail: { quoteId: newQuoteId }
            }));
            this.resetForm();
        })
        .catch(error => {
            console.error('Create quote error:', error);
            this.errorMessage = error.body
                ? error.body.message
                : 'Error creating quote. Please try again.';
        })
        .finally(() => {
            this.isCreating = false;
        });
    }

    // ── Close modal ───────────────────────────────────────────────────────
    handleClose() {
        this.resetForm();
        this.dispatchEvent(new CustomEvent('close'));
    }

    handleOverlayClick() {
        this.handleClose();
    }

    // ── Reset all fields ──────────────────────────────────────────────────
    resetForm() {
        this.opportunityId = '';
        this.accountName   = '';
        this.accountId     = '';
        this.description   = '';
        this.startDate     = new Date().toISOString().split('T')[0];
        this.endDate       = '';
        this.timePeriod    = 'Days';
        this.errorMessage  = '';
    }
}