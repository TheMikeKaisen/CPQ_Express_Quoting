try {
    Quote q = new Quote();
    q.Name = 'Test Quote No Opp';
    insert q;
    System.debug('SUCCESS: Quote created without Opportunity. Id: ' + q.Id);
} catch (Exception e) {
    System.debug('ERROR: ' + e.getMessage());
}
