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
                   Quantity__c, Base_Rate__c,
                   Unit_Price__c, Discount_Percent__c,
                   Total_Price__c, Cost__c, Margin__c
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

        // Add Resource Roles
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
                item.Base_Rate__c        = role.Price__c;
                item.Unit_Price__c       = role.Price__c;
                item.Cost__c             = role.Cost__c;
                item.Quantity__c         = 1;
                item.Discount_Percent__c = 0;
                populateDates(item, parentQuote);
                itemsToInsert.add(item);
            }
        }

        // Add Products
        if (productIds != null && !productIds.isEmpty()) {
            List<Product__c> products = [
                SELECT Id, Name, Name__c, Price__c, Cost__c
                FROM Product__c
                WHERE Id IN :productIds
            ];

            for (Product__c product : products) {
                Quote_Line_Item__c item = new Quote_Line_Item__c();
                item.Quote__c            = quoteId;
                item.Name                = product.Name__c;
                item.Item_Type__c        = 'Product';
                item.Product__c          = product.Id;
                item.Base_Rate__c        = product.Price__c;
                item.Unit_Price__c       = product.Price__c;
                item.Cost__c             = product.Cost__c;
                item.Quantity__c         = 1;
                item.Discount_Percent__c = 0;
                populateDates(item, parentQuote);
                itemsToInsert.add(item);
            }
        }

        // Add Add-ons
        if (addonIds != null && !addonIds.isEmpty()) {
            List<Add_On__c> addons = [
                SELECT Id, Name, Name__c, Price__c, Cost__c
                FROM Add_On__c
                WHERE Id IN :addonIds
            ];

            for (Add_On__c addon : addons) {
                Quote_Line_Item__c item = new Quote_Line_Item__c();
                item.Quote__c            = quoteId;
                item.Name                = addon.Name__c;
                item.Item_Type__c        = 'Add-on';
                item.Add_On__c           = addon.Id;
                item.Base_Rate__c        = addon.Price__c;
                item.Unit_Price__c       = addon.Price__c;
                item.Cost__c             = addon.Cost__c;
                item.Quantity__c         = 1;
                item.Discount_Percent__c = 0;
                populateDates(item, parentQuote);
                itemsToInsert.add(item);
            }
        }

        if (!itemsToInsert.isEmpty()) {
            insert itemsToInsert;
            // Recalculate quote totals after adding items
            QuoteController.recalculateQuoteTotals(quoteId);
        }
    }

    // ── Update a single line item ─────────────────────────────────────────
    @AuraEnabled
    public static void updateLineItem(Quote_Line_Item__c item) {
        // Query existing to get context for date recalculation
        Quote_Line_Item__c existing = [
            SELECT Quantity__c, Start_Date__c, End_Date__c, Quote__c,
                   Quote__r.Start_Date__c, Quote__r.End_Date__c, Quote__r.Time_Period__c
            FROM Quote_Line_Item__c
            WHERE Id = :item.Id
            LIMIT 1
        ];

        // Force recalculation if Quantity OR Start Date is present in the update
        // (Even if they haven't changed, we want to ensure the End Date stays in sync if Quote allows)
        if (existing.Quote__r.End_Date__c == null && existing.Quote__r.Time_Period__c != null) {
            Boolean hasChange = false;
            // Check if quantity or start date is being updated
            if (item.Quantity__c != null) hasChange = true;
            if (item.Start_Date__c != null) hasChange = true;

            if (hasChange) {
                Decimal qty = item.Quantity__c != null ? item.Quantity__c : existing.Quantity__c;
                Date start = item.Start_Date__c != null ? item.Start_Date__c : existing.Start_Date__c;
                item.End_Date__c = calculateEndDate(start, qty, existing.Quote__r.Time_Period__c);
            }
        }

        update item;
        // Recalculate quote totals after update
        QuoteController.recalculateQuoteTotals(existing.Quote__c);
    }

    private static void populateDates(Quote_Line_Item__c item, Quote parentQuote) {
        if (parentQuote.Start_Date__c != null) {
            item.Start_Date__c = parentQuote.Start_Date__c;
            if (parentQuote.End_Date__c != null) {
                item.End_Date__c = parentQuote.End_Date__c;
            } else if (parentQuote.Time_Period__c != null) {
                item.End_Date__c = calculateEndDate(parentQuote.Start_Date__c, item.Quantity__c, parentQuote.Time_Period__c);
            }
        }
    }

    private static Date calculateEndDate(Date startDate, Decimal quantity, String timePeriod) {
        if (startDate == null || quantity == null || String.isBlank(timePeriod)) {
            return null;
        }

        if (timePeriod == 'Days') {
            return startDate.addDays((Integer)Math.round(quantity));
        } else if (timePeriod == 'Weeks') {
            return startDate.addDays((Integer)Math.round(quantity * 7));
        } else if (timePeriod == 'Months' || timePeriod == 'Quarters' || timePeriod == 'Years') {
            // Calculate total months based on period
            Decimal totalMonths = (timePeriod == 'Months') ? quantity 
                                 : (timePeriod == 'Quarters') ? quantity * 3 
                                 : quantity * 12; // Years

            Integer wholeMonths = (Integer)Math.floor(totalMonths);
            Decimal fraction = totalMonths - wholeMonths;
            
            Date d = startDate.addMonths(wholeMonths);
            if (fraction > 0) {
                d = d.addDays((Integer)Math.round(fraction * 30));
            }
            // Typically end date is inclusive duration, but standard addDays logic 
            // often needs a -1 adjustment if we count the start day as Day 1.
            // However, user said "2 months ahead", so we'll stick to clear addMonths logic.
            return d;
        }
        
        return null;
    }

    // ── Delete a single line item ─────────────────────────────────────────
    @AuraEnabled
    public static void deleteLineItem(Id itemId) {
        // Get quoteId before deleting
        Quote_Line_Item__c item = [
            SELECT Quote__c
            FROM Quote_Line_Item__c
            WHERE Id = :itemId
            LIMIT 1
        ];
        Id quoteId = item.Quote__c;

        delete item;

        // Recalculate quote totals after delete
        QuoteController.recalculateQuoteTotals(quoteId);
    }

    // ── Get line items grouped by type for summary cards ──────────────────
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getLineItemSummary(Id quoteId) {
        AggregateResult[] results = [
            SELECT Item_Type__c type,
                   SUM(Total_Price__c) totalRevenue,
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
            Decimal revenue = (Decimal) r.get('totalRevenue') != null ? (Decimal) r.get('totalRevenue') : 0;
            Decimal margin = (Decimal) r.get('totalMargin') != null ? (Decimal) r.get('totalMargin') : 0;
            Integer count = (Integer) r.get('itemCount');

            // Derive cost: Revenue - Margin = Total Cost
            Decimal cost = revenue - margin;

            Decimal percentage = grandTotal > 0
                ? (revenue / grandTotal * 100).setScale(1)
                : 0;

            summary.put(type, new Map<String, Object>{
                'revenue'    => revenue,
                'cost'       => cost,
                'margin'     => margin,
                'count'      => count,
                'percentage' => percentage
            });
        }

        // Calculate Subtotal (Unit Price * Quantity before discount)
        List<Quote_Line_Item__c> items = [
            SELECT Unit_Price__c, Quantity__c 
            FROM Quote_Line_Item__c 
            WHERE Quote__c = :quoteId
        ];
        
        Decimal subtotal = 0;
        for (Quote_Line_Item__c item : items) {
            if (item.Unit_Price__c != null && item.Quantity__c != null) {
                subtotal += (item.Unit_Price__c * item.Quantity__c);
            }
        }

        summary.put('grandTotal', grandTotal);
        summary.put('subtotal', subtotal);
        return summary;
    }

    // ── Get line items grouped by phase for phase table ───────────────────
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getLineItemsByPhase(
            Id quoteId) {

        AggregateResult[] results = [
            SELECT Phase__c phase,
                   Item_Type__c type,
                   SUM(Total_Price__c) totalPrice,
                   COUNT(Id) itemCount
            FROM Quote_Line_Item__c
            WHERE Quote__c = :quoteId
            GROUP BY Phase__c, Item_Type__c
            ORDER BY Phase__c
        ];

        // Group by phase
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