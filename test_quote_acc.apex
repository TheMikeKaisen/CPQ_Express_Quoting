Account acc = [SELECT Id FROM Account LIMIT 1];
try {
    Quote q = new Quote();
    q.Name = 'Test Quote With Acc';
    q.AccountId = acc.Id;
    insert q;
    System.debug('SUCCESS: Quote created with Account. Id: ' + q.Id);
} catch (Exception e) {
    System.debug('ERROR: ' + e.getMessage());
}
