public with sharing class ProductController {

    // ── Get all products ──────────────────────────────────────────────────
    @AuraEnabled(cacheable=true)
    public static List<Product__c> getProducts(String searchTerm) {

        String query = 'SELECT Id, Name__c, Description__c, ' +
                       'Billing_Unit__c, Price__c, Cost__c, ' +
                       'Tags__c, Is_Active__c ' +
                       'FROM Product__c';

        List<String> conditions = new List<String>();

        if (String.isNotBlank(searchTerm)) {
            conditions.add('Name__c LIKE \'%' +
                     String.escapeSingleQuotes(searchTerm) + '%\'');
        }

        if (!conditions.isEmpty()) {
            query += ' WHERE ' + String.join(conditions, ' AND ');
        }

        query += ' ORDER BY Name__c ASC';
        return Database.query(query);
    }

    // ── Create new product ────────────────────────────────────────────────
    @AuraEnabled
    public static Id createProduct(
            String name,
            String billingUnit,
            Decimal price,
            Decimal cost,
            String tags) {

        Product__c p      = new Product__c();
        p.Name__c         = name;
        p.Billing_Unit__c = billingUnit;
        p.Price__c        = price;
        p.Cost__c         = cost;
        p.Tags__c         = tags;
        p.Is_Active__c    = true;

        insert p;
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

    // ── Delete product ────────────────────────────────────────────────────
    @AuraEnabled
    public static void deleteProduct(Id productId) {
        Product__c p = new Product__c();
        p.Id = productId;
        delete p;
    }
}