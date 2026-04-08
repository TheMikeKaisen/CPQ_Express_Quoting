Account acc = [SELECT Id FROM Account LIMIT 1];
try {
    Quote q = new Quote();
    // q.QuoteAccountId = acc.Id; 
    // Wait, I can't test it if I don't know the exact name.
    // I will try to use SObject's put method to see if it even exists in the schema at runtime.
    SObject qObj = Schema.getGlobalDescribe().get('Quote').newSObject();
    qObj.put('QuoteAccountId', acc.Id);
    System.debug('SUCCESS: QuoteAccountId is writable via put');
} catch (Exception e) {
    System.debug('ERROR: ' + e.getMessage());
}
