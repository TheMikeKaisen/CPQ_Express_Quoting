import { LightningElement, api } from 'lwc';

export default class ProvusStatusBadge extends LightningElement {

    @api status = 'Draft'; // passed in from parent

    // Return CSS class based on status value
    get badgeClass() {
        const base = 'badge ';
        switch (this.status) {
            case 'Draft':            return base + 'badge-draft';
            case 'Pending Approval': return base + 'badge-pending';
            case 'Approved':         return base + 'badge-approved';
            case 'Rejected':         return base + 'badge-rejected';
            default:                 return base + 'badge-draft';
        }
    }
}