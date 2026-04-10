import { LightningElement, api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getLineItems from '@salesforce/apex/QuoteLineItemController.getLineItems';
import getCompanySettings from '@salesforce/apex/QuoteController.getCompanySettings';
import saveQuoteDocument from '@salesforce/apex/QuotePdfController.saveQuoteDocument';

export default class ProvusGeneratePdfModal extends LightningElement {

    @api 
    get isOpen() { return this._isOpen; }
    set isOpen(value) {
        this._isOpen = value;
        if (value) {
            this.fetchBranding();
        }
    }
    _isOpen = false;
    @api quoteId;
    @api quote;

    @track lineItems   = [];
    @track isSaving    = false;
    @track zoomLevel   = 100;

    // ── Wire: line items ──────────────────────────────────────────────────
    @wire(getLineItems, { quoteId: '$quoteId' })
    wiredItems({ data, error }) {
        if (data)  this.lineItems = data;
        if (error) console.error('PDF modal - line items error:', error);
    }

    companyData = {};
    isBrandingLoading = false;

    fetchBranding() {
        this.isBrandingLoading = true;
        getCompanySettings()
            .then(data => {
                this.companyData = data || {};
                this.isBrandingLoading = false;
            })
            .catch(error => {
                console.error('PDF Branding Error:', error);
                this.isBrandingLoading = false;
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Error Loading Branding',
                    message: 'Could not fetch company logo/address. Please check permissions.',
                    variant: 'error'
                }));
            });
    }

    // ── Company computed values ───────────────────────────────────────────
    get companyName() { return this.companyData.companyName || ''; }

    get hasLogo() { return !!(this.companyData.logoBase64); }
    get logoSrc() { return this.companyData.logoBase64 || ''; }

    get companyAddressLine() {
        const city    = this.companyData.city    || '';
        const state   = this.companyData.state   || '';
        const zipCode = this.companyData.zipCode || '';
        const cityLine = [city, state, zipCode].filter(Boolean).join(', ');
        return [this.companyData.address, cityLine].filter(Boolean).join(', ');
    }

    get companyCountry() { return this.companyData.country || ''; }

    get companyContact() {
        return [this.companyData.email, this.companyData.phone]
            .filter(Boolean).join(' • ');
    }

    get companyWebsite() { return this.companyData.website || ''; }

    // ── Quote computed values ─────────────────────────────────────────────
    get quoteNumber() {
        return this.quote ? this.quote.QuoteNumber : '';
    }

    get quoteDate() {
        if (!this.quote || !this.quote.CreatedDate) return '';
        return new Date(this.quote.CreatedDate)
            .toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    }

    get validUntil() {
        if (!this.quote || !this.quote.ExpirationDate) return 'N/A';
        return new Date(this.quote.ExpirationDate)
            .toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    }

    get preparedBy() {
        return (this.quote && this.quote.CreatedBy)
            ? this.quote.CreatedBy.Name : '';
    }

    get accountName() {
        if (!this.quote) return '';
        
        let name = '';
        if (this.quote.Account && this.quote.Account.Name) {
            name = this.quote.Account.Name;
        } else if (this.quote.QuoteAccount && this.quote.QuoteAccount.Name) {
            name = this.quote.QuoteAccount.Name;
        } else if (this.quote.Opportunity && this.quote.Opportunity.Account && this.quote.Opportunity.Account.Name) {
            name = this.quote.Opportunity.Account.Name;
        }

        if (!name) {
            console.warn('PDF Diagnostic - Account Name not found. Quote Data:', JSON.parse(JSON.stringify(this.quote)));
        }
        return name;
    }

    get quoteDescription() {
        return (this.quote && this.quote.Description)
            ? this.quote.Description
            : 'Professional Services Project';
    }

    // ── Line item computed values ─────────────────────────────────────────
    get hasLineItems() {
        return this.lineItems && this.lineItems.length > 0;
    }

    get lineItemRows() {
        return (this.lineItems || []).map(item => ({
            id:        item.Id,
            name:      item.Name || '',
            phase:     item.Phase__c || '—',
            qty:       Number(item.Quantity__c || 1),
            unitPrice: this.fmt(item.Unit_Price__c),
            discount:  Number(item.Discount_Percent__c || 0) + '%',
            total:     this.fmt(item.Line_Total__c)
        }));
    }

    get grandTotal() {
        return (this.lineItems || [])
            .reduce((s, i) => s + Number(i.Line_Total__c || 0), 0);
    }

    get subtotal() {
        return (this.lineItems || []).reduce((s, item) => {
            const u   = Number(item.Unit_Price__c || 0);
            const qty = Number(item.Quantity__c || 1);
            const dur = Number(item.Duration__c || 1);
            const bu  = item.Billing_Unit__c;
            const tp  = item.Quote__r ? item.Quote__r.Time_Period__c : 'Days';
            let hrs = 8;
            if (tp === 'Weeks') hrs = 40;
            else if (tp === 'Months') hrs = 160;
            else if (tp === 'Quarters') hrs = 480;

            if (bu === 'Hour') return s + (u * hrs * dur * qty);
            if (bu === 'Day') return s + (u * dur * qty);
            return s + (u * qty);
        }, 0);
    }

    get discountTotal() {
        const disc = this.subtotal - this.grandTotal;
        return disc > 0 ? disc : 0;
    }

    get formattedTotal()    { return this.fmt(this.grandTotal); }
    get formattedSubtotal() { return this.fmt(this.subtotal);   }
    get formattedDiscountTotal() { return this.fmt(this.discountTotal); }

    // ── Zoom ─────────────────────────────────────────────────────────────
    get pageStyle() {
        return `transform: scale(${this.zoomLevel / 100}); transform-origin: top center; transition: transform 0.2s;`;
    }

    handleZoomIn()  { if (this.zoomLevel < 150) this.zoomLevel += 10; }
    handleZoomOut() { if (this.zoomLevel > 50)  this.zoomLevel -= 10; }

    get saveLabel() { return this.isSaving ? 'Saving...' : '💾 Save'; }

    // ── Format helpers ────────────────────────────────────────────────────
    fmt(value) {
        if (value == null) return '$0.00';
        return '$' + Number(value).toLocaleString('en-US', {
            minimumFractionDigits: 2, maximumFractionDigits: 2
        });
    }

    // ── Generate printable HTML document string ───────────────────────────
    generateHtmlString() {
        const co = this.companyData || {};
        const q  = this.quote       || {};

        const logoHtml = co.logoBase64
            ? `<img src="${co.logoBase64}" style="max-height:56px;max-width:180px;display:block;margin-bottom:10px;" alt="Company Logo"/>`
            : '';

        const addrParts = [co.address, [co.city, co.state, co.zipCode].filter(Boolean).join(', ')].filter(Boolean);
        const addrHtml  = addrParts.map(p => `<div>${p}</div>`).join('');

        const contactParts = [co.email, co.phone].filter(Boolean);
        const contactHtml  = contactParts.length ? `<div>${contactParts.join(' &bull; ')}</div>` : '';
        const websiteHtml  = co.website ? `<div>${co.website}</div>` : '';

        const quoteDate = q.CreatedDate
            ? new Date(q.CreatedDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
            : '';
        const validUntil = q.ExpirationDate
            ? new Date(q.ExpirationDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
            : 'N/A';
        const preparedBy  = q.CreatedBy ? q.CreatedBy.Name : '';
        
        // Account Name Fallback (Multi-layer)
        let accountName = '';
        if (q.Account && q.Account.Name) {
            accountName = q.Account.Name;
        } else if (q.QuoteAccount && q.QuoteAccount.Name) {
            accountName = q.QuoteAccount.Name;
        } else if (q.Opportunity && q.Opportunity.Account && q.Opportunity.Account.Name) {
            accountName = q.Opportunity.Account.Name;
        }

        const description = q.Description || 'Professional Services Project';

        // ── Grouping & Totals Calculation ────────────────────────────────────
        let total    = 0;
        let subtotal = 0;
        const phaseGroups = {};

        (this.lineItems || []).forEach(item => {
            const phase = item.Phase__c || 'General';
            if (!phaseGroups[phase]) {
                phaseGroups[phase] = { items: [], total: 0 };
            }

            const t   = Number(item.Line_Total__c   || 0);
            const u   = Number(item.Unit_Price__c    || 0);
            const qty = Number(item.Quantity__c      || 1);
            const dur = Number(item.Duration__c      || 1);
            const bu  = item.Billing_Unit__c;
            const tp  = item.Quote__r ? item.Quote__r.Time_Period__c : 'Days';
            
            let hrs = 8;
            if (tp === 'Weeks') hrs = 40;
            else if (tp === 'Months') hrs = 160;
            else if (tp === 'Quarters') hrs = 480;

            total += t;
            if (bu === 'Hour') subtotal += (u * hrs * dur * qty);
            else if (bu === 'Day') subtotal += (u * dur * qty);
            else subtotal += (u * qty);

            phaseGroups[phase].items.push(item);
            phaseGroups[phase].total += t;
        });

        // ── Build Sectioned Rows HTML ────────────────────────────────────────
        let itemRowsHtml = '';
        const phases = Object.keys(phaseGroups).sort();

        if (phases.length === 0) {
            itemRowsHtml = `<tr><td colspan="6" style="padding:24px;text-align:center;color:#9ca3af;">No line items added to this quote.</td></tr>`;
        } else {
            phases.forEach(phase => {
                // Phase Header Row
                itemRowsHtml += `
                    <tr style="background:#f9fafb;">
                        <td colspan="6" style="padding:12px 14px;font-weight:700;color:#1d4ed8;border-bottom:2px solid #e5e7eb;text-transform:uppercase;font-size:11px;letter-spacing:1px;">
                            Phase: ${phase}
                        </td>
                    </tr>`;

                // Phase Items
                phaseGroups[phase].items.forEach(item => {
                    const t = Number(item.Line_Total__c || 0);
                    const u = Number(item.Unit_Price__c  || 0);
                    const q_item = Number(item.Quantity__c    || 1);
                    const d = Number(item.Discount_Percent__c || 0);
                    
                    itemRowsHtml += `
                        <tr>
                            <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;">${item.Name || ''}</td>
                            <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:12px;">${item.Phase__c || 'General'}</td>
                            <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;text-align:center;">${q_item}</td>
                            <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;text-align:right;">${this.fmt(u)}</td>
                            <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;text-align:center;">${d}%</td>
                            <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;color:#111;">${this.fmt(t)}</td>
                        </tr>`;
                });

                // Phase Subtotal Row
                itemRowsHtml += `
                    <tr style="background:#fff;">
                        <td colspan="5" style="padding:10px 14px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;">Subtotal for ${phase}</td>
                        <td style="padding:10px 14px;text-align:right;font-weight:700;color:#111;border-top:1px solid #e5e7eb;">${this.fmt(phaseGroups[phase].total)}</td>
                    </tr>
                    <tr><td colspan="6" style="height:12px;border:none;"></td></tr> <!-- Spacer -->`;
            });
        }

        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Quote ${q.QuoteNumber || ''}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f0f2f5;padding:40px 20px;color:#1a1a1a;color-scheme:light;}
.page{background:white !important;color:#1a1a1a !important;max-width:800px;margin:0 auto;padding:48px;border-radius:6px;box-shadow:0 4px 24px rgba(0,0,0,.1);min-height:1000px;}
@media print{body{background:white;padding:0}.page{box-shadow:none;border-radius:0;max-width:100%}}
h2{font-size:18px;font-weight:700;color:#111827;border-bottom:3px solid #1d4ed8;padding-bottom:8px;margin-bottom:16px}
</style>
</head>
<body>
<div class="page">
  <!-- HEADER -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;gap:24px">
    <div>
      ${logoHtml}
      <div style="font-size:22px;font-weight:700;color:#111827;margin-bottom:10px">${co.companyName || ''}</div>
      <div style="font-size:13px;color:#6b7280;line-height:1.9">
        ${addrHtml}
        <div>${co.country || ''}</div>
        ${contactHtml}
        ${websiteHtml}
      </div>
    </div>
    <div style="border-left:5px solid #1d4ed8;padding-left:24px;text-align:right;min-width:200px">
      <div style="font-size:30px;font-weight:900;color:#1d4ed8;letter-spacing:4px;margin-bottom:14px">QUOTE</div>
      <div style="font-size:13px;line-height:2.3;color:#374151">
        Quote #: <strong>${q.QuoteNumber || ''}</strong><br>
        Date: ${quoteDate}<br>
        Valid Until: ${validUntil}<br>
        Prepared By: ${preparedBy}
      </div>
    </div>
  </div>

  <hr style="border:none;border-top:2px solid #e5e7eb;margin-bottom:28px">

  <!-- BILL TO -->
  <div style="background:#f8f9fa;border-radius:8px;padding:16px 20px;margin-bottom:28px;display:inline-block;min-width:220px">
    <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:6px">Bill To</div>
    <div style="font-size:16px;font-weight:600;color:#111827">${accountName}</div>
  </div>

  <!-- PROJECT OVERVIEW -->
  <div style="margin-bottom:28px">
    <h2>Project Overview</h2>
    <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">DESCRIPTION</div>
    <div style="font-size:14px;color:#374151;line-height:1.6">${description}</div>
  </div>

  <!-- PRICE BREAKDOWN -->
  <div style="margin-bottom:28px">
    <h2>Detailed Price Breakdown</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="background:#f9fafb">
          <th style="padding:12px 14px;text-align:left;font-weight:600;color:#374151;border-bottom:2px solid #e5e7eb">Name</th>
          <th style="padding:12px 14px;text-align:left;font-weight:600;color:#374151;border-bottom:2px solid #e5e7eb">Phase</th>
          <th style="padding:12px 14px;text-align:center;font-weight:600;color:#374151;border-bottom:2px solid #e5e7eb">Qty</th>
          <th style="padding:12px 14px;text-align:right;font-weight:600;color:#374151;border-bottom:2px solid #e5e7eb">Unit Price</th>
          <th style="padding:12px 14px;text-align:center;font-weight:600;color:#374151;border-bottom:2px solid #e5e7eb">Disc.</th>
          <th style="padding:12px 14px;text-align:right;font-weight:600;color:#374151;border-bottom:2px solid #e5e7eb">Total</th>
        </tr>
      </thead>
      <tbody>${itemRowsHtml}</tbody>
    </table>
    <div style="display:flex;justify-content:flex-end;margin-top:20px">
      <div style="min-width:280px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
        <div style="display:flex;justify-content:space-between;padding:13px 20px;background:#f9fafb;font-size:14px">
          <span style="color:#6b7280">Subtotal:</span>
          <span style="font-weight:600">${this.fmt(subtotal)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:13px 20px;background:#f9fafb;font-size:14px;border-top:1px solid #eee;">
          <span style="color:#6b7280">Total Discount:</span>
          <span style="font-weight:600;color:#ef4444">-${this.fmt(subtotal - total).replace('$', '')}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:16px 20px;background:#1d4ed8;color:white">
          <span style="font-weight:700;font-size:15px">Total Project Cost:</span>
          <span style="font-weight:700;font-size:18px">${this.fmt(total)}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- TERMS & CONDITIONS -->
  <div style="margin-bottom:32px">
    <h2>Terms and Conditions</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div><div style="font-size:13px;font-weight:700;margin-bottom:6px">1. Scope of Work</div><div style="font-size:12px;color:#6b7280;line-height:1.7">Work will be performed according to specifications outlined in this quote. Changes in scope require written approval and may result in additional charges.</div></div>
      <div><div style="font-size:13px;font-weight:700;margin-bottom:6px">2. Timeline and Delivery</div><div style="font-size:12px;color:#6b7280;line-height:1.7">Project timeline is estimated based on current requirements. Delays caused by client feedback or scope changes may extend the timeline.</div></div>
      <div><div style="font-size:13px;font-weight:700;margin-bottom:6px">3. Payment Terms</div><div style="font-size:12px;color:#6b7280;line-height:1.7">Payment schedule must be maintained for project to proceed. Late payments (&gt;15 days) will incur a 1.5% monthly service charge.</div></div>
      <div><div style="font-size:13px;font-weight:700;margin-bottom:6px">4. Intellectual Property</div><div style="font-size:12px;color:#6b7280;line-height:1.7">Client will own all custom code and designs upon final payment. Third-party licenses remain property of respective owners.</div></div>
      <div><div style="font-size:13px;font-weight:700;margin-bottom:6px">5. Warranty and Support</div><div style="font-size:12px;color:#6b7280;line-height:1.7">30-day warranty on all custom development work. Bug fixes during warranty period provided at no charge.</div></div>
      <div><div style="font-size:13px;font-weight:700;margin-bottom:6px">6. Acceptance</div><div style="font-size:12px;color:#6b7280;line-height:1.7">Quote valid for 30 days from date issued. Project begins upon signed contract and initial deposit.</div></div>
    </div>
  </div>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin-bottom:16px">
  <div style="text-align:center;font-size:12px;color:#9ca3af">
    This quote is created by Provus Express Quoting product. To learn more, check this out &mdash; https://provus.ai/cpq-express
  </div>
</div>
</body>
</html>`;
    }

    // ── Download handler ──────────────────────────────────────────────────
    handleDownload() {
        const html      = this.generateHtmlString();
        const quoteNum  = this.quoteNumber || 'Quote';
        const a         = document.createElement('a');
        a.href          = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
        a.download      = `Quote-${quoteNum}.html`;
        a.click();
    }

    // ── Save handler ──────────────────────────────────────────────────────
    handleSave() {
        this.isSaving       = true;
        const quoteNum      = this.quoteNumber || 'Quote';
        const dateStr       = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
        const documentName  = `${quoteNum} — ${dateStr}`;
        const htmlContent   = this.generateHtmlString();

        saveQuoteDocument({
            quoteId:      this.quoteId,
            documentName: documentName,
            htmlContent:  htmlContent
        })
        .then(() => {
            this.dispatchEvent(new ShowToastEvent({
                title:   'Saved!',
                message: 'Quote document saved to Generated PDFs tab.',
                variant: 'success'
            }));
            this.dispatchEvent(new CustomEvent('saved'));
        })
        .catch(err => {
            console.error('Save PDF error:', err);
            this.dispatchEvent(new ShowToastEvent({
                title:   'Error',
                message: err.body ? err.body.message : 'Failed to save document.',
                variant: 'error'
            }));
        })
        .finally(() => {
            this.isSaving = false;
        });
    }

    // ── Close handler ─────────────────────────────────────────────────────
    handleClose() {
        this.dispatchEvent(new CustomEvent('close'));
    }
}