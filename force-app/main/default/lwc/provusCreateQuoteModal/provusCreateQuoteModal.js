import { LightningElement, api, track, wire } from 'lwc';
import getOpportunities from
    '@salesforce/apex/OpportunityController.getOpportunities';
import getOpportunityById from
    '@salesforce/apex/OpportunityController.getOpportunityById';
import createQuote from
    '@salesforce/apex/QuoteController.createQuote';

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

    // Character count
    get descriptionLength() {
        return this.description ? this.description.length : 0;
    }

    // ── Opportunity selected → auto fill account ──────────────────────────
    handleOpportunityChange(event) {
        this.opportunityId = event.target.value;
        this.accountName   = '';
        this.accountId     = '';

        if (!this.opportunityId) return;

        // ── FIX: use oppId to match Apex param name ───────────────────
        getOpportunityById({ oppId: this.opportunityId })
            .then(opp => {
                if (opp && opp.Account) {
                    this.accountName = opp.Account.Name;
                    this.accountId   = opp.AccountId;
                } else if (opp) {
                    this.accountId   = opp.AccountId;
                    this.accountName = 'Account loaded';
                }
            })
            .catch(error => {
                console.error('Error fetching opportunity:', error);
            });
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
        if (!this.opportunityId) {
            this.errorMessage = 'Please select an Opportunity.';
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

        createQuote({
            opportunityId: this.opportunityId,
            description:   this.description   || '',
            startDate:     this.startDate,
            endDate:       this.endDate        || null,
            timePeriod:    this.timePeriod
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