public with sharing class ResourceRoleController {

    // ── Get all resource roles with optional status filter ─────────────────
    @AuraEnabled(cacheable=true)
    public static List<Resource_Role__c> getResourceRoles(
            String statusFilter) {

        String query = 'SELECT Id, Name, Name__c, Location__c, ' +
                       'Billing_Unit__c, Price__c, Cost__c, ' +
                       'Tags__c, Is_Active__c ' +
                       'FROM Resource_Role__c';

        List<String> conditions = new List<String>();

        if (String.isNotBlank(statusFilter)) {
            if (statusFilter == 'Active') {
                conditions.add('Is_Active__c = true');
            } else if (statusFilter == 'Inactive') {
                conditions.add('Is_Active__c = false');
            }
            // 'All' = no filter
        }

        if (!conditions.isEmpty()) {
            query += ' WHERE ' + String.join(conditions, ' AND ');
        }

        query += ' ORDER BY Name__c ASC';
        return Database.query(query);
    }

    // ── Create or Update resource role ───────────────────────────────────
    @AuraEnabled
    public static Id createResourceRole(
            Id roleId,
            String name,
            String location,
            String billingUnit,
            Decimal price,
            Decimal cost,
            String tags) {

        Resource_Role__c role  = new Resource_Role__c();
        if (roleId != null) {
            role.Id = roleId;
        }
        role.Name__c           = name;
        role.Location__c       = location;
        role.Billing_Unit__c   = billingUnit;
        role.Price__c          = price;
        role.Cost__c           = cost;
        role.Tags__c           = tags;
        
        if (roleId == null) {
            role.Is_Active__c = true;
        }

        upsert role;
        return role.Id;
    }

    // ── Toggle active/inactive status ─────────────────────────────────────
    @AuraEnabled
    public static void toggleActiveStatus(
            Id roleId,
            Boolean isActive) {

        Resource_Role__c role = new Resource_Role__c();
        role.Id = roleId;
        role.Is_Active__c = isActive;
        update role;
    }

    @AuraEnabled
    public static void deleteResourceRole(Id roleId) {
        Resource_Role__c role = new Resource_Role__c();
        role.Id = roleId;
        delete role;
    }

    // ── Import from CSV JSON ──────────────────────────────────────────────
    @AuraEnabled
    public static void importResourceRolesData(String jsonData) {
        List<Resource_Role__c> rolesToInsert = new List<Resource_Role__c>();
        List<Object> rawRecords = (List<Object>) JSON.deserializeUntyped(jsonData);
        for (Object obj : rawRecords) {
            Map<String, Object> record = (Map<String, Object>) obj;
            Resource_Role__c role = new Resource_Role__c();
            role.Name__c = (String) record.get('Name');
            role.Location__c = (String) record.get('Location');
            role.Billing_Unit__c = (String) record.get('Billing Unit');
            
            Object rawPrice = record.get('Price');
            Object rawCost = record.get('Cost');
            
            role.Price__c = rawPrice != null && String.isNotBlank(String.valueOf(rawPrice)) ? Decimal.valueOf(String.valueOf(rawPrice).replaceAll(',', '')) : 0;
            role.Cost__c = rawCost != null && String.isNotBlank(String.valueOf(rawCost)) ? Decimal.valueOf(String.valueOf(rawCost).replaceAll(',', '')) : 0;
            role.Tags__c = (String) record.get('Tags');
            role.Is_Active__c = true;
            rolesToInsert.add(role);
        }
        insert rolesToInsert;
    }
}