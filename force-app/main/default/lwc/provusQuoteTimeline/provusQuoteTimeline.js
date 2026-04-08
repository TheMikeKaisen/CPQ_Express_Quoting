import { LightningElement, api, wire, track } from 'lwc';
import getLineItems from '@salesforce/apex/QuoteLineItemController.getLineItems';

export default class ProvusQuoteTimeline extends LightningElement {
    @api quoteId;

    @track timelineItems = [];
    @track timelineHeaders = [];
    @track granularity = '';

    wiredItemsResult;
    hasItems = false;
    
    // Scale properties
    minDate;
    maxDate;
    totalMs;

    @wire(getLineItems, { quoteId: '$quoteId' })
    wiredItems(result) {
        this.wiredItemsResult = result;
        if (result.data) {
            this.processData(result.data);
        } else if (result.error) {
            console.error('Timeline error:', result.error);
        }
    }

    processData(data) {
        const validItems = data.filter(i => i.Start_Date__c && i.End_Date__c);
        if (validItems.length === 0) {
            this.hasItems = false;
            return;
        }
        this.hasItems = true;

        const startDates = validItems.map(i => new Date(i.Start_Date__c).getTime());
        const endDates = validItems.map(i => new Date(i.End_Date__c).getTime());

        let minD = new Date(Math.min(...startDates));
        let maxD = new Date(Math.max(...endDates));

        const totalDays = (maxD - minD) / (1000 * 60 * 60 * 24);

        if (totalDays <= 31) {
            this.granularity = 'Days';
        } else if (totalDays <= 90) {
            this.granularity = 'Weeks';
            minD = new Date(minD.setDate(minD.getDate() - minD.getDay()));
            maxD = new Date(maxD.setDate(maxD.getDate() + (6 - maxD.getDay())));
        } else {
            this.granularity = 'Months';
            minD = new Date(minD.getFullYear(), minD.getMonth(), 1);
            maxD = new Date(maxD.getFullYear(), maxD.getMonth() + 1, 0);
        }

        // Add small padding to dates so bars aren't visually pressed against walls
        this.minDate = minD;
        this.maxDate = maxD;
        this.totalMs = maxD.getTime() - minD.getTime();

        // Handle case where totalMs is 0 (very rare if valid dates exist but safe)
        if (this.totalMs === 0) this.totalMs = 86400000;

        this.generateHeaders();
        this.generateItems(validItems);
    }

    generateHeaders() {
        this.timelineHeaders = [];
        let current = new Date(this.minDate.getTime());
        const msPerDay = 1000 * 60 * 60 * 24;

        if (this.granularity === 'Days') {
            while (current <= this.maxDate) {
                this.timelineHeaders.push({
                    label: current.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
                    style: `width: ${(msPerDay / this.totalMs) * 100}%;`
                });
                current.setDate(current.getDate() + 1);
            }
        } else if (this.granularity === 'Weeks') {
            while (current <= this.maxDate) {
                let next = new Date(current.getTime());
                next.setDate(next.getDate() + 7);
                let durationMs = next.getTime() - current.getTime();
                this.timelineHeaders.push({
                    label: current.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
                    style: `width: ${(durationMs / this.totalMs) * 100}%;`
                });
                current = next;
            }
        } else {
            while (current <= this.maxDate) {
                let next = new Date(current.getFullYear(), current.getMonth() + 1, 1);
                let durationMs = next.getTime() - current.getTime();
                this.timelineHeaders.push({
                    label: current.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                    style: `width: ${(durationMs / this.totalMs) * 100}%;`
                });
                current = next;
            }
        }
    }

    generateItems(data) {
        this.timelineItems = data.map((item) => {
            const startMs = new Date(item.Start_Date__c).getTime();
            const endMs = new Date(item.End_Date__c).getTime();
            
            let leftPct = ((startMs - this.minDate.getTime()) / this.totalMs) * 100;
            let widthPct = ((endMs - startMs) / this.totalMs) * 100;

            // Ensure tiny bars are visible
            if (widthPct < 2) widthPct = 2;
            if (leftPct + widthPct > 100) widthPct = 100 - leftPct;

            const days = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24));
            let durationText = '';
            if (days <= 31) durationText = days + ' days';
            else if (days <= 60) durationText = 'about 1 month';
            else durationText = 'about ' + Math.round(days/30) + ' months';

            let typeClass = 'bar-default';
            if (item.Item_Type__c === 'Product') typeClass = 'bar-product';
            else if (item.Item_Type__c === 'Add-on') typeClass = 'bar-addon';
            else if (item.Item_Type__c === 'Resource Role') typeClass = 'bar-role';

            let dotClass = 'dot-default';
            if (item.Item_Type__c === 'Product') dotClass = 'dot-product';
            else if (item.Item_Type__c === 'Add-on') dotClass = 'dot-addon';
            else if (item.Item_Type__c === 'Resource Role') dotClass = 'dot-role';

            let icon = '📋';
            if (item.Item_Type__c === 'Product') icon = '📦';
            else if (item.Item_Type__c === 'Add-on') icon = '✨';
            else if (item.Item_Type__c === 'Resource Role') icon = '👤';

            return {
                ...item,
                durationText,
                cssStyle: `left: ${leftPct}%; width: ${widthPct}%;`,
                typeClass: `timeline-bar ${typeClass}`,
                dotClass: `type-dot ${dotClass}`,
                icon: icon
            };
        });
    }
}