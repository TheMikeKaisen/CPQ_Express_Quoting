public without sharing class CompanySettingsController {

    // ── Save company profile ──────────────────────────────────────────────
    @AuraEnabled
    public static void saveCompanySettings(
            String companyName, String email,    String phone,
            String website,     String address,  String city,
            String state,       String zipCode,  String country,
            String logoBase64) {
        try {
            List<Company_Profile__c> existing = [
                SELECT Id FROM Company_Profile__c
                ORDER BY CreatedDate ASC LIMIT 1
            ];

            Company_Profile__c s = existing.isEmpty()
                ? new Company_Profile__c(Name = 'Org Profile')
                : existing[0];

            s.Company_Name__c = companyName;
            s.Email__c        = email;
            s.Phone__c        = phone;
            s.Website__c      = website;
            s.Address__c      = address;
            s.City__c         = city;
            s.State__c        = state;
            s.Zip_Code__c     = zipCode;
            s.Country__c      = country;
            if (String.isNotBlank(logoBase64)) {
                s.Logo_Base64__c = logoBase64;
            }

            upsert s;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    // ── Remove logo only ──────────────────────────────────────────────────
    @AuraEnabled
    public static void removeLogo() {
        try {
            List<Company_Profile__c> existing = [
                SELECT Id FROM Company_Profile__c
                ORDER BY CreatedDate ASC LIMIT 1
            ];
            if (!existing.isEmpty()) {
                existing[0].Logo_Base64__c = null;
                update existing[0];
            }
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}