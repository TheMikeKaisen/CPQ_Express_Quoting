List<Quote> allQuotes = [SELECT Id FROM Quote];
for(Quote q : allQuotes) {
    QuoteController.recalculateQuoteTotals(q.Id);
}
System.debug('Recalculated ' + allQuotes.size() + ' quotes.');
