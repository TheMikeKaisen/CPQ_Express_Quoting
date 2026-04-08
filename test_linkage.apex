Account acc = [SELECT Id, Name FROM Account LIMIT 1];
try {
    Quote q = new Quote();
    q.Name = 'Test Quote Linkage';
    // Using SObject put because I'm not sure if it compiles directly
    q.put('QuoteAccountId', acc.Id);
    insert q;
    
    Quote inserted = [SELECT Id, AccountId, Account.Name FROM Quote WHERE Id = :q.Id];
    System.debug('Inserted Quote ID: ' + inserted.Id);
    System.debug('Std AccountId: ' + inserted.AccountId);
    System.debug('Std Account Name: ' + inserted.Account.Name);
} catch (Exception e) {
    System.debug('ERROR: ' + e.getMessage());
}
