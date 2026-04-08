Account acc = [SELECT Id FROM Account LIMIT 1];
try {
    Quote q = new Quote();
    q.Name = 'Test Standalone';
    // Let's try to set AccountId directly again but without Opp
    // q.AccountId = acc.Id;
    
    // Oh wait, I see what's happening.
    // In many orgs, Quote is mandatory to have Opportunity.
    // If Quote is enabled, it usually requires an Opportunity.
} catch (Exception e) {}
