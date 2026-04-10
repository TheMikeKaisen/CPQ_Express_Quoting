public with sharing class ProductController {

    // ── Get all products with optional search and status filters ──────────
    @AuraEnabled(cacheable=true)
    public static List<Product__c> getProducts(
            String searchTerm,
            String statusFilter) {

        String query = 'SELECT Id, Name, Name__c, Description__c, ' +
                       'Billing_Unit__c, Price__c, Cost__c, ' +
                       'Tags__c, Is_Active__c ' +
                       'FROM Product__c';

        List<String> conditions = new List<String>();

        if (String.isNotBlank(searchTerm)) {
            conditions.add('Name__c LIKE \'%' +
                     String.escapeSingleQuotes(searchTerm) + '%\'');
        }

        if (String.isNotBlank(statusFilter)) {
            if (statusFilter == 'Active') {
                conditions.add('Is_Active__c = true');
            } else if (statusFilter == 'Inactive') {
                conditions.add('Is_Active__c = false');
            }
        }

        if (!conditions.isEmpty()) {
            query += ' WHERE ' + String.join(conditions, ' AND ');
        }

        query += ' ORDER BY Name__c ASC';
        return Database.query(query);
    }

    // ── Create or Update product ──────────────────────────────────────────
    @AuraEnabled
    public static Id createProduct(
            Id productId,
            String name,
            String billingUnit,
            Decimal price,
            Decimal cost,
            String tags) {

        Product__c p      = new Product__c();
        if (productId != null) {
            p.Id = productId;
        }
        p.Name__c         = name;
        p.Billing_Unit__c = billingUnit;
        p.Price__c        = price;
        p.Cost__c         = cost;
        p.Tags__c         = tags;
        
        if (productId == null) {
            p.Is_Active__c = true;
        }

        upsert p;
        return p.Id;
    }

    // ── Toggle active status ──────────────────────────────────────────────
    @AuraEnabled
    public static void toggleActiveStatus(
            Id productId,
            Boolean isActive) {

        Product__c p   = new Product__c();
        p.Id           = productId;
        p.Is_Active__c = isActive;
        update p;
    }

    @AuraEnabled
    public static void deleteProduct(Id productId) {
        Product__c p = new Product__c();
        p.Id = productId;
        delete p;
    }

    // ── Import from CSV JSON ──────────────────────────────────────────────
    @AuraEnabled
    public static void importProductsData(String jsonData) {
        List<Product__c> productsToInsert = new List<Product__c>();
        List<Object> rawRecords = (List<Object>) JSON.deserializeUntyped(jsonData);
        for (Object obj : rawRecords) {
            Map<String, Object> record = (Map<String, Object>) obj;
            Product__c p = new Product__c();
            p.Name__c = (String) record.get('Name');
            p.Billing_Unit__c = (String) record.get('Billing Unit');
            
            Object rawPrice = record.get('Price');
            Object rawCost = record.get('Cost');
            
            p.Price__c = rawPrice != null && String.isNotBlank(String.valueOf(rawPrice)) ? Decimal.valueOf(String.valueOf(rawPrice).replaceAll(',', '')) : 0;
            p.Cost__c = rawCost != null && String.isNotBlank(String.valueOf(rawCost)) ? Decimal.valueOf(String.valueOf(rawCost).replaceAll(',', '')) : 0;
            p.Tags__c = (String) record.get('Tags');
            p.Is_Active__c = true;
            productsToInsert.add(p);
        }
        insert productsToInsert;
    }
}