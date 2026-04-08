public without sharing class CompanySettingsController {

    // ── Get company profile ───────────────────────────────────────────────
    @AuraEnabled(cacheable=true)
    public static Map<String, String> getCompanySettings() {
        try {
            List<Company_Profile__c> profiles = [
                SELECT Company_Name__c, Email__c, Phone__c, Website__c,
                       Address__c, City__c, State__c, Zip_Code__c,
                       Country__c, Logo_Base64__c
                FROM Company_Profile__c
                ORDER BY CreatedDate ASC
                LIMIT 1
            ];

            if (profiles.isEmpty()) {
                return new Map<String, String>{
                    'companyName' => '', 'email'    => '',
                    'phone'       => '', 'website'  => '',
                    'address'     => '', 'city'     => '',
                    'state'       => '', 'zipCode'  => '',
                    'country'     => '', 'logoBase64' => ''
                };
            }

            Company_Profile__c s = profiles[0];
            return new Map<String, String>{
                'companyName' => s.Company_Name__c  != null ? s.Company_Name__c  : '',
                'email'       => s.Email__c         != null ? s.Email__c         : '',
                'phone'       => s.Phone__c         != null ? s.Phone__c         : '',
                'website'     => s.Website__c       != null ? s.Website__c       : '',
                'address'     => s.Address__c       != null ? s.Address__c       : '',
                'city'        => s.City__c          != null ? s.City__c          : '',
                'state'       => s.State__c         != null ? s.State__c         : '',
                'zipCode'     => s.Zip_Code__c      != null ? s.Zip_Code__c      : '',
                'country'     => s.Country__c       != null ? s.Country__c       : '',
                'logoBase64'  => s.Logo_Base64__c   != null ? s.Logo_Base64__c   : ''
            };
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

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