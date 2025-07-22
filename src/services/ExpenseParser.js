class ExpenseParser {
  // Common expense categories in Brazilian Portuguese
  static categories = {
    alimentação: ['mercado', 'supermercado', 'feira', 'padaria', 'açougue', 'comida', 'almoço', 'jantar', 'lanche', 'restaurante', 'ifood', 'delivery'],
    transporte: ['uber', '99', 'ônibus', 'metrô', 'gasolina', 'combustível', 'passagem', 'transporte', 'taxi', 'táxi'],
    moradia: ['aluguel', 'luz', 'água', 'gás', 'condomínio', 'energia', 'conta'],
    saúde: ['farmácia', 'remédio', 'médico', 'consulta', 'exame', 'hospital'],
    educação: ['escola', 'curso', 'material', 'livro', 'apostila'],
    lazer: ['cinema', 'bar', 'festa', 'cerveja', 'churrasco', 'diversão'],
    outros: []
  };

  static parse(message) {
    const text = message.toLowerCase().trim();
    
    // Remove common words that might interfere
    const cleanText = text
      .replace(/\br\$/gi, '')
      .replace(/reais/gi, '')
      .replace(/real/gi, '')
      .trim();
    
    // Patterns to extract expense information
    const patterns = [
      // "gastei 50 no mercado" or "gastei 50,00 no mercado"
      {
        regex: /gastei?\s+(\d+(?:[,\.]\d{2})?)\s+(?:no|na|em)\s+(.+)/i,
        amountIndex: 1,
        descriptionIndex: 2
      },
      // "mercado 50" or "mercado 50,00"
      {
        regex: /(.+?)\s+(\d+(?:[,\.]\d{2})?)$/i,
        amountIndex: 2,
        descriptionIndex: 1
      },
      // "50 no mercado" or "50,00 no mercado"
      {
        regex: /(\d+(?:[,\.]\d{2})?)\s+(?:no|na|em)\s+(.+)/i,
        amountIndex: 1,
        descriptionIndex: 2
      },
      // "comprei algo por 50" or "paguei 50"
      {
        regex: /(?:comprei|paguei)\s+(.+?)\s+(?:por)?\s*(\d+(?:[,\.]\d{2})?)/i,
        amountIndex: 2,
        descriptionIndex: 1
      },
      // Just amount: "50" or "50,00"
      {
        regex: /^(\d+(?:[,\.]\d{2})?)$/,
        amountIndex: 1,
        descriptionIndex: null
      }
    ];
    
    let expense = null;
    
    // Try each pattern
    for (const pattern of patterns) {
      const match = cleanText.match(pattern.regex);
      if (match) {
        const amount = this.parseAmount(match[pattern.amountIndex]);
        const description = pattern.descriptionIndex ? match[pattern.descriptionIndex].trim() : null;
        const category = description ? this.detectCategory(description) : 'outros';
        
        expense = {
          amount,
          description: description || 'Despesa',
          category,
          original: text
        };
        break;
      }
    }
    
    // If no pattern matched, check for amount anywhere in the text
    if (!expense) {
      const amountMatch = cleanText.match(/\d+(?:[,\.]\d{2})?/);
      if (amountMatch) {
        const amount = this.parseAmount(amountMatch[0]);
        const description = cleanText.replace(amountMatch[0], '').trim();
        
        expense = {
          amount,
          description: description || 'Despesa',
          category: this.detectCategory(description),
          original: text
        };
      }
    }
    
    return expense;
  }
  
  static parseAmount(amountStr) {
    // Convert Brazilian format (1.234,56) to number
    return parseFloat(
      amountStr
        .replace(/\./g, '') // Remove thousand separators
        .replace(',', '.') // Convert decimal comma to dot
    );
  }
  
  static detectCategory(description) {
    if (!description) return 'outros';
    
    const lowerDesc = description.toLowerCase();
    
    // Check each category's keywords
    for (const [category, keywords] of Object.entries(this.categories)) {
      if (category === 'outros') continue;
      
      for (const keyword of keywords) {
        if (lowerDesc.includes(keyword)) {
          return category;
        }
      }
    }
    
    return 'outros';
  }
  
  // Helper to validate if a message likely contains an expense
  static isExpenseMessage(message) {
    const text = message.toLowerCase();
    
    // Check for income indicators (should NOT be expenses)
    const incomeIndicators = [
      /ganh/i,        // ganho, ganhei, ganhar
      /receb/i,       // recebo, recebi, receber
      /salário/i,
      /sal[aá]rio/i,
      /renda/i,
      /fatur/i        // faturo, faturei
    ];
    
    // If it's income, it's NOT an expense
    if (incomeIndicators.some(indicator => indicator.test(text))) {
      return false;
    }
    
    // Check for expense indicators
    const expenseIndicators = [
      /gastei/i,
      /comprei/i,
      /paguei/i,
      /custou/i,
      /saiu por/i
    ];
    
    // Check for expense patterns
    const hasExpenseWord = expenseIndicators.some(indicator => indicator.test(text));
    const hasMoneyPattern = /\d+[,\.]?\d*/.test(text);
    const hasLocation = /\s+(no|na|em)\s+/i.test(text);
    
    // Transport/service patterns: "uber 15", "taxi 20", "gasolina 50"
    const transportServices = ['uber', '99', 'taxi', 'táxi', 'ônibus', 'metro', 'metrô'];
    const hasTransportService = transportServices.some(service => 
      new RegExp(`\\b${service}\\b`, 'i').test(text)
    );
    
    // Product patterns: "gasolina 30", "remédio 45"
    const commonProducts = ['gasolina', 'combustível', 'remédio', 'café', 'lanche'];
    const hasProduct = commonProducts.some(product => 
      new RegExp(`\\b${product}\\b`, 'i').test(text)
    );
    
    return hasExpenseWord || 
           (hasMoneyPattern && hasLocation) || 
           (hasMoneyPattern && hasTransportService) ||
           (hasMoneyPattern && hasProduct);
  }
  
  // Format expense for confirmation message
  static formatExpense(expense) {
    const amount = expense.amount.toLocaleString('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    });
    
    return {
      text: `${expense.description}: ${amount}`,
      category: expense.category,
      amount: amount
    };
  }
}

module.exports = ExpenseParser;