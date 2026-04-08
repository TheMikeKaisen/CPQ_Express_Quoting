public without sharing class QuotePdfController {

    // ── Save generated PDF as a Quote Document record ─────────────────────
    @AuraEnabled
    public static Id saveQuoteDocument(
            Id quoteId,
            String documentName,
            String htmlContent) {
        try {
            String generatedBy = UserInfo.getName();

            Quote_Document__c doc = new Quote_Document__c();
            doc.Name              = documentName;
            doc.Quote__c          = quoteId;
            doc.Generated_Date__c = DateTime.now();
            doc.Generated_By__c   = generatedBy;
            doc.Html_Content__c   = htmlContent;

            insert doc;
            return doc.Id;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    // ── Get list of saved documents for a quote ───────────────────────────
    @AuraEnabled(cacheable=true)
    public static List<Quote_Document__c> getQuoteDocuments(Id quoteId) {
        return [
            SELECT Id, Name, Generated_Date__c, Generated_By__c
            FROM Quote_Document__c
            WHERE Quote__c = :quoteId
            ORDER BY Generated_Date__c DESC
        ];
    }

    // ── Get HTML content of a saved document ──────────────────────────────
    @AuraEnabled
    public static String getDocumentHtml(Id documentId) {
        try {
            Quote_Document__c doc = [
                SELECT Html_Content__c
                FROM Quote_Document__c
                WHERE Id = :documentId
                LIMIT 1
            ];
            return doc.Html_Content__c;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    // ── Delete a saved document ───────────────────────────────────────────
    @AuraEnabled
    public static void deleteQuoteDocument(Id documentId) {
        try {
            delete new Quote_Document__c(Id = documentId);
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}