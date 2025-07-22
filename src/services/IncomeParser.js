class IncomeParser {
  static parse(message) {
    const text = message.toLowerCase().trim();
    
    // Income patterns in Brazilian Portuguese
    const patterns = [
      // "ganho 4000 por mês" or "recebo 2500"
      {
        regex: /(?:ganh[o]?|receb[o]?)\s+(?:r\$)?\s*(\d+(?:[,\.]\d{2})?)\s*(?:por\s+m[êe]s|mensal)?/i,
        amountIndex: 1
      },
      // "meu salário é 3000"
      {
        regex: /(?:sal[aá]rio|renda)\s+(?:é|de)?\s*(?:r\$)?\s*(\d+(?:[,\.]\d{2})?)/i,
        amountIndex: 1
      },
      // "minha renda mensal é 2800"
      {
        regex: /renda\s+mensal\s+(?:é|de)?\s*(?:r\$)?\s*(\d+(?:[,\.]\d{2})?)/i,
        amountIndex: 1
      }
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern.regex);
      if (match) {
        const amount = this.parseAmount(match[pattern.amountIndex]);
        
        return {
          amount,
          type: 'monthly_income',
          original: text
        };
      }
    }
    
    return null;
  }
  
  static parseAmount(amountStr) {
    // Convert Brazilian format to number
    return parseFloat(
      amountStr
        .replace(/\./g, '') // Remove thousand separators
        .replace(',', '.') // Convert decimal comma to dot
    );
  }
  
  static isIncomeMessage(message) {
    const text = message.toLowerCase();
    
    const incomeIndicators = [
      /ganh[o]?/i,
      /receb[o]?/i,
      /sal[aá]rio/i,
      /renda/i,
      /fatur[o]?/i
    ];
    
    const hasIncomeWord = incomeIndicators.some(indicator => indicator.test(text));
    const hasAmount = /\d+/.test(text);
    
    return hasIncomeWord && hasAmount;
  }
}

module.exports = IncomeParser;