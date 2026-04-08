public with sharing class QuoteLineItemController {

    // ── Get all line items for a quote ────────────────────────────────────
    @AuraEnabled(cacheable=true)
    public static List<Quote_Line_Item__c> getLineItems(Id quoteId) {
        return [
            SELECT Id, Name, Item_Type__c,
                   Resource_Role__c, Resource_Role__r.Name, Resource_Role__r.Name__c,
                   Product__c, Product__r.Name, Product__r.Name__c,
                   Add_On__c, Add_On__r.Name, Add_On__r.Name__c,
                   Phase__c, Task__c,
                   Start_Date__c, End_Date__c,
                   Duration__c, Quantity__c, Billing_Unit__c,
                   Base_Rate__c, Unit_Price__c,
                   Discount_Percent__c, Line_Total__c,
                   Cost__c, Margin__c, Quote__r.Time_Period__c
            FROM Quote_Line_Item__c
            WHERE Quote__c = :quoteId
            ORDER BY CreatedDate ASC
        ];
    }

    // ── Get empty phases stored on the Quote ──────────────────────────────
    @AuraEnabled(cacheable=true)
    public static String getPhaseList(Id quoteId) {
        Quote q = [SELECT Phase_List__c FROM Quote WHERE Id = :quoteId LIMIT 1];
        return q.Phase_List__c;
    }

    // ── Save empty phases back to the Quote ───────────────────────────────
    @AuraEnabled
    public static void savePhaseList(Id quoteId, String phaseList) {
        Quote q = new Quote(Id = quoteId);
        q.Phase_List__c = phaseList;
        update q;
    }

    // ── Add line items from modal selection ───────────────────────────────
    @AuraEnabled
    public static void addLineItems(
            Id quoteId,
            List<Id> resourceRoleIds,
            List<Id> productIds,
            List<Id> addonIds) {

        Quote parentQuote = [
            SELECT Start_Date__c, End_Date__c, Time_Period__c
            FROM Quote
            WHERE Id = :quoteId
            LIMIT 1
        ];

        List<Quote_Line_Item__c> itemsToInsert =
            new List<Quote_Line_Item__c>();

        // ── Add Resource Roles ────────────────────────────────────────────
        if (resourceRoleIds != null && !resourceRoleIds.isEmpty()) {
            List<Resource_Role__c> roles = [
                SELECT Id, Name, Name__c, Price__c, Cost__c, Billing_Unit__c
                FROM Resource_Role__c
                WHERE Id IN :resourceRoleIds
            ];

            for (Resource_Role__c role : roles) {
                Quote_Line_Item__c item = new Quote_Line_Item__c();
                item.Quote__c            = quoteId;
                item.Name                = role.Name__c;
                item.Item_Type__c        = 'Resource Role';
                item.Resource_Role__c    = role.Id;
                item.Billing_Unit__c     = role.Billing_Unit__c != null ? role.Billing_Unit__c : 'Hour';
                item.Base_Rate__c        = role.Cost__c;
                item.Unit_Price__c       = role.Price__c;
                item.Cost__c             = role.Cost__c;
                item.Quantity__c         = 1;
                item.Duration__c         = 1;
                item.Discount_Percent__c = 0;
                populateDates(item, parentQuote);
                item.Line_Total__c = calculateTotalPrice(
                    item.Unit_Price__c, item.Quantity__c, item.Duration__c,
                    item.Billing_Unit__c, parentQuote.Time_Period__c, item.Discount_Percent__c
                );
                itemsToInsert.add(item);
            }
        }

        // ── Add Products ──────────────────────────────────────────────────
        if (productIds != null && !productIds.isEmpty()) {
            List<Product__c> products = [
                SELECT Id, Name, Name__c, Price__c, Cost__c, Billing_Unit__c
                FROM Product__c
                WHERE Id IN :productIds
            ];

            for (Product__c product : products) {
                Quote_Line_Item__c item = new Quote_Line_Item__c();
                item.Quote__c            = quoteId;
                item.Name                = product.Name__c;
                item.Item_Type__c        = 'Product';
                item.Product__c          = product.Id;
                item.Billing_Unit__c     = product.Billing_Unit__c != null ? product.Billing_Unit__c : 'Each';
                item.Base_Rate__c        = product.Cost__c;
                item.Unit_Price__c       = product.Price__c;
                item.Cost__c             = product.Cost__c;
                item.Quantity__c         = 1;
                item.Duration__c         = 1;
                item.Discount_Percent__c = 0;
                populateDates(item, parentQuote);
                item.Line_Total__c = calculateTotalPrice(
                    item.Unit_Price__c, item.Quantity__c, item.Duration__c,
                    item.Billing_Unit__c, parentQuote.Time_Period__c, item.Discount_Percent__c
                );
                itemsToInsert.add(item);
            }
        }

        // ── Add Add-ons ───────────────────────────────────────────────────
        if (addonIds != null && !addonIds.isEmpty()) {
            List<Add_On__c> addons = [
                SELECT Id, Name, Name__c, Price__c, Cost__c, Billing_Unit__c
                FROM Add_On__c
                WHERE Id IN :addonIds
            ];

            for (Add_On__c addon : addons) {
                Quote_Line_Item__c item = new Quote_Line_Item__c();
                item.Quote__c            = quoteId;
                item.Name                = addon.Name__c;
                item.Item_Type__c        = 'Add-on';
                item.Add_On__c           = addon.Id;
                item.Billing_Unit__c     = addon.Billing_Unit__c != null ? addon.Billing_Unit__c : 'Each';
                item.Base_Rate__c        = addon.Cost__c;
                item.Unit_Price__c       = addon.Price__c;
                item.Cost__c             = addon.Cost__c;
                item.Quantity__c         = 1;
                item.Duration__c         = 1;
                item.Discount_Percent__c = 0;
                populateDates(item, parentQuote);
                item.Line_Total__c = calculateTotalPrice(
                    item.Unit_Price__c, item.Quantity__c, item.Duration__c,
                    item.Billing_Unit__c, parentQuote.Time_Period__c, item.Discount_Percent__c
                );
                itemsToInsert.add(item);
            }
        }

        if (!itemsToInsert.isEmpty()) {
            insert itemsToInsert;
            QuoteController.recalculateQuoteTotals(quoteId);
        }
    }

    // ── Update a single line item ─────────────────────────────────────────
    @AuraEnabled
    public static void updateLineItem(Quote_Line_Item__c item) {
        Quote_Line_Item__c existing = [
            SELECT Quantity__c, Duration__c, Billing_Unit__c,
                   Start_Date__c, End_Date__c, Line_Total__c,
                   Unit_Price__c, Discount_Percent__c, Quote__c,
                   Quote__r.Start_Date__c, Quote__r.End_Date__c, Quote__r.Time_Period__c
            FROM Quote_Line_Item__c
            WHERE Id = :item.Id
            LIMIT 1
        ];

        String timePeriod = existing.Quote__r.Time_Period__c;

        // Merge provided updates with persisted values
        Decimal qty        = item.Quantity__c         != null ? item.Quantity__c         : existing.Quantity__c;
        Decimal duration   = item.Duration__c         != null ? item.Duration__c         : existing.Duration__c;
        Date    start      = item.Start_Date__c        != null ? item.Start_Date__c       : existing.Start_Date__c;
        Decimal unitPrice  = item.Unit_Price__c        != null ? item.Unit_Price__c       : existing.Unit_Price__c;
        Decimal discountPct= item.Discount_Percent__c  != null ? item.Discount_Percent__c: existing.Discount_Percent__c;
        String  billingUnit= existing.Billing_Unit__c; // Billing unit is fixed on the line item

        // Recalculate End Date ONLY for time-based billing (Hour, Day).
        // 'Each' billing has no time dimension — End Date stays null.
        if (billingUnit == 'Each') {
            item.End_Date__c = null;
        } else if (timePeriod != null &&
            (item.Quantity__c != null || item.Duration__c != null || item.Start_Date__c != null)) {
            item.End_Date__c = calculateEndDate(start, duration, timePeriod);
        }

        // Recalculate Line Total whenever a pricing-relevant field changes
        if (item.Quantity__c != null || item.Duration__c != null ||
            item.Unit_Price__c != null || item.Discount_Percent__c != null) {
            item.Line_Total__c = calculateTotalPrice(
                unitPrice, qty, duration, billingUnit, timePeriod, discountPct
            );
        }

        update item;
        QuoteController.recalculateQuoteTotals(existing.Quote__c);
    }

    /**
     * Calculates total price for a line item based on billing unit type.
     *
     * 'Hour' billing: UnitPrice is an hourly rate.
     *   Total = UnitPrice x HoursPerPeriod x Duration x Quantity x (1 - Discount% / 100)
     *   Example: 3 engineers x 5 weeks x 40hrs/week x $100/hr = $60,000
     *
     * 'Each' billing: Flat rate per unit — no time dimension.
     *   Total = UnitPrice x Quantity x (1 - Discount% / 100)
     *
     * 'Day' billing: UnitPrice is a daily rate.
     *   Total = UnitPrice x Duration x Quantity x (1 - Discount% / 100)
     *
     * discountPct is stored as a whole percentage (e.g. 10 = 10% off).
     */
    @TestVisible
    private static Decimal calculateTotalPrice(
        Decimal unitPrice, Decimal quantity, Decimal duration,
        String billingUnit, String timePeriod, Decimal discountPct) {

        if (unitPrice == null)   unitPrice   = 0;
        if (quantity  == null)   quantity    = 1;
        if (duration  == null)   duration    = 1;
        if (discountPct == null) discountPct = 0;

        Decimal total;
        if (billingUnit == 'Hour') {
            Decimal hoursPerPeriod = getHoursPerPeriod(timePeriod);
            total = unitPrice * hoursPerPeriod * duration * quantity;
        } else if (billingUnit == 'Day') {
            // Daily rate — duration is in days (within the time period unit)
            total = unitPrice * duration * quantity;
        } else {
            // 'Each': flat per-unit price, no time dimension
            total = unitPrice * quantity;
        }

        // discountPct stored as 0-100 (e.g. 10 = 10% discount)
        return total * (1 - discountPct / 100);
    }

    /**
     * Standard work hours per time period (8 hrs/day, 5 days/week).
     */
    private static Decimal getHoursPerPeriod(String timePeriod) {
        if (timePeriod == 'Days')     return 8;    // 8 hrs/day
        if (timePeriod == 'Weeks')    return 40;   // 8 * 5 days
        if (timePeriod == 'Months')   return 160;  // 40 * 4 weeks
        if (timePeriod == 'Quarters') return 480;  // 160 * 3 months
        return 8; // default to daily if unrecognised
    }

    // ── Date Helpers ──────────────────────────────────────────────────────
    private static void populateDates(Quote_Line_Item__c item, Quote parentQuote) {
        if (parentQuote.Start_Date__c != null) {
            item.Start_Date__c = parentQuote.Start_Date__c;

            // Only compute End Date for time-based billing (Hour, Day).
            // 'Each' billing has no time dimension — End Date stays null.
            if (item.Billing_Unit__c != 'Each') {
                if (parentQuote.Time_Period__c != null) {
                    item.End_Date__c = calculateEndDate(
                        parentQuote.Start_Date__c,
                        item.Duration__c,
                        parentQuote.Time_Period__c
                    );
                } else if (parentQuote.End_Date__c != null) {
                    item.End_Date__c = parentQuote.End_Date__c;
                }
            }
        }
    }

    private static Date calculateEndDate(Date startDate, Decimal duration, String timePeriod) {
        if (startDate == null || duration == null || String.isBlank(timePeriod)) {
            return null;
        }

        if (timePeriod == 'Days') {
            return startDate.addDays((Integer) Math.round(duration));
        } else if (timePeriod == 'Weeks') {
            return startDate.addDays((Integer) Math.round(duration * 7));
        } else if (timePeriod == 'Months') {
            Integer wholeMonths = (Integer) Math.floor(duration);
            Decimal fraction    = duration - wholeMonths;
            Date d = startDate.addMonths(wholeMonths);
            if (fraction > 0) {
                d = d.addDays((Integer) Math.round(fraction * 30));
            }
            return d;
        } else if (timePeriod == 'Quarters') {
            Integer wholeMonths = (Integer) Math.round(duration * 3);
            return startDate.addMonths(wholeMonths);
        }

        return null;
    }

    // ── Delete a single line item ─────────────────────────────────────────
    @AuraEnabled
    public static void deleteLineItem(Id itemId) {
        Quote_Line_Item__c item = [
            SELECT Quote__c
            FROM Quote_Line_Item__c
            WHERE Id = :itemId
            LIMIT 1
        ];
        Id quoteId = item.Quote__c;
        delete item;
        QuoteController.recalculateQuoteTotals(quoteId);
    }

    // ── Delete multiple line items ────────────────────────────────────────
    @AuraEnabled
    public static void deleteLineItems(List<Id> itemIds) {
        if (itemIds == null || itemIds.isEmpty()) return;

        Quote_Line_Item__c firstItem = [
            SELECT Quote__c
            FROM Quote_Line_Item__c
            WHERE Id IN :itemIds
            LIMIT 1
        ];
        Id quoteId = firstItem.Quote__c;

        delete [SELECT Id FROM Quote_Line_Item__c WHERE Id IN :itemIds];
        QuoteController.recalculateQuoteTotals(quoteId);
    }

    // ── Get line items grouped by type for summary cards ──────────────────
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getLineItemSummary(Id quoteId) {
        AggregateResult[] results = [
            SELECT Item_Type__c type,
                   SUM(Line_Total__c) totalRevenue,
                   SUM(Margin__c) totalMargin,
                   COUNT(Id) itemCount
            FROM Quote_Line_Item__c
            WHERE Quote__c = :quoteId
            GROUP BY Item_Type__c
        ];

        Map<String, Object> summary = new Map<String, Object>();
        Decimal grandTotal = 0;

        for (AggregateResult r : results) {
            Decimal rev = (Decimal) r.get('totalRevenue');
            if (rev != null) grandTotal += rev;
        }

        for (AggregateResult r : results) {
            String type = (String) r.get('type');
            Decimal revenue    = (Decimal) r.get('totalRevenue')  != null ? (Decimal) r.get('totalRevenue')  : 0;
            Decimal margin     = (Decimal) r.get('totalMargin')   != null ? (Decimal) r.get('totalMargin')   : 0;
            Integer count      = (Integer) r.get('itemCount');
            Decimal cost       = revenue - margin;
            Decimal percentage = grandTotal > 0 ? (revenue / grandTotal * 100).setScale(1) : 0;

            summary.put(type, new Map<String, Object>{
                'revenue'    => revenue,
                'cost'       => cost,
                'margin'     => margin,
                'count'      => count,
                'percentage' => percentage
            });
        }

        // Subtotal = sum of (Unit Price x Quantity x Duration x HoursPerPeriod) before discount
        List<Quote_Line_Item__c> items = [
            SELECT Unit_Price__c, Quantity__c, Duration__c, Billing_Unit__c, Quote__r.Time_Period__c
            FROM Quote_Line_Item__c
            WHERE Quote__c = :quoteId
        ];

        Decimal subtotal = 0;
        for (Quote_Line_Item__c item : items) {
            if (item.Unit_Price__c != null) {
                Decimal qty = item.Quantity__c != null ? item.Quantity__c : 1;
                Decimal dur = item.Duration__c != null ? item.Duration__c : 1;
                Decimal up  = item.Unit_Price__c;
                String  bu  = item.Billing_Unit__c;

                if (bu == 'Hour') {
                    Decimal hrs = getHoursPerPeriod(item.Quote__r.Time_Period__c);
                    subtotal += (up * hrs * dur * qty);
                } else if (bu == 'Day') {
                    subtotal += (up * dur * qty);
                } else {
                    // Each
                    subtotal += (up * qty);
                }
            }
        }

        summary.put('grandTotal', grandTotal);
        summary.put('subtotal', subtotal);
        return summary;
    }

    // ── Get line items grouped by phase for phase table ───────────────────
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getLineItemsByPhase(Id quoteId) {

        AggregateResult[] results = [
            SELECT Phase__c phase,
                   Item_Type__c type,
                   SUM(Line_Total__c) totalPrice,
                   COUNT(Id) itemCount
            FROM Quote_Line_Item__c
            WHERE Quote__c = :quoteId
            GROUP BY Phase__c, Item_Type__c
            ORDER BY Phase__c
        ];

        Map<String, Map<String, Object>> phaseMap =
            new Map<String, Map<String, Object>>();

        for (AggregateResult r : results) {
            String  phase = (String)  r.get('phase');
            String  type  = (String)  r.get('type');
            Decimal price = (Decimal) r.get('totalPrice');
            Integer count = (Integer) r.get('itemCount');

            if (phase == null) phase = 'Default';
            if (price == null) price = 0;

            if (!phaseMap.containsKey(phase)) {
                phaseMap.put(phase, new Map<String, Object>{
                    'phase'    => phase,
                    'labor'    => 0,
                    'products' => 0,
                    'addons'   => 0,
                    'total'    => 0,
                    'items'    => 0
                });
            }

            Map<String, Object> phaseData = phaseMap.get(phase);
            Decimal currentTotal = (Decimal) phaseData.get('total');
            Integer currentItems = (Integer) phaseData.get('items');

            if (type == 'Resource Role') {
                phaseData.put('labor', price);
            } else if (type == 'Product') {
                phaseData.put('products', price);
            } else if (type == 'Add-on') {
                phaseData.put('addons', price);
            }

            phaseData.put('total', currentTotal + price);
            phaseData.put('items', currentItems + count);
        }

        return phaseMap.values();
    }
}