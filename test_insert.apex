Account acc = [SELECT Id FROM Account LIMIT 1];
try {
    Quote q = new Quote();
    q.Name = 'Test Standalone Quote';
    // Let's try to set some fields and see what happens
    // q.QuoteAccountId = acc.Id; 
    insert q;
    System.debug('SUCCESS: Inserted with Id ' + q.Id);
} catch (Exception e) {
    System.debug('ERROR: ' + e.getMessage());
}
