/**
 * M-Pesa SMS Parser
 * 
 * Extracts amount, merchant/recipient name, and transaction date from M-Pesa SMS formats.
 * Supports:
 * - Paid to (Buy Goods / Till / Paybill)
 * - Sent to (P2P Transfers / Send Money)
 * - Bought airtime
 * - Withdrawn
 */

export interface MPesaTransaction {
  id: string; // The M-Pesa receipt number (e.g. OBF11R9XF)
  amount: number;
  description: string; // Merchant or Recipient Name
  date: Date;
  type: 'PAYMENT' | 'SEND' | 'AIRTIME' | 'WITHDRAWAL' | 'UNKNOWN';
  suggestedCategory: string;
}

export function guessCategory(description: string, type: MPesaTransaction['type']): string {
  const desc = description.toLowerCase();
  
  if (
    type === 'AIRTIME' ||
    desc.includes('airtime') ||
    desc.includes('kplc') ||
    desc.includes('token') ||
    desc.includes('water') ||
    desc.includes('wifi') ||
    desc.includes('zuku') ||
    desc.includes('internet')
  ) {
    return 'Utilities';
  }
  
  if (
    desc.includes('naivas') ||
    desc.includes('quickmart') ||
    desc.includes('carrefour') ||
    desc.includes('supermarket') ||
    desc.includes('java') ||
    desc.includes('kfc') ||
    desc.includes('restaurant') ||
    desc.includes('cafe') ||
    desc.includes('bakery') ||
    desc.includes('butchery') ||
    desc.includes('food') ||
    desc.includes('groceries')
  ) {
    return 'Food';
  }
  
  if (
    desc.includes('uber') ||
    desc.includes('bolt') ||
    desc.includes('little') ||
    desc.includes('shell') ||
    desc.includes('total') ||
    desc.includes('rubis') ||
    desc.includes('petrol') ||
    desc.includes('matatu') ||
    desc.includes('fare') ||
    desc.includes('fuel')
  ) {
    return 'Transport';
  }
  
  if (
    desc.includes('netflix') ||
    desc.includes('showmax') ||
    desc.includes('cinema') ||
    desc.includes('movie') ||
    desc.includes('spotify') ||
    desc.includes('game') ||
    desc.includes('gaming')
  ) {
    return 'Entertainment';
  }
  
  return 'Others';
}

export function parseMPesaSMS(smsBody: string): MPesaTransaction | null {
  if (!smsBody) return null;

  // Ignore received money for expenses tracker (income, not expense)
  if (
    /received\s+Ksh/i.test(smsBody) || 
    /you\s+have\s+received/i.test(smsBody) ||
    /give\s+Ksh/i.test(smsBody)
  ) {
    return null;
  }

  // Check if it's an M-Pesa message
  const hasMpesaKeyword = /confirmed/i.test(smsBody) || /m-pesa/i.test(smsBody) || /mpesa/i.test(smsBody);
  const hasCurrency = /Ksh/i.test(smsBody);
  if (!hasMpesaKeyword || !hasCurrency) {
    return null;
  }

  // Extract M-Pesa transaction ID (10 alphanumeric chars)
  const idMatch = smsBody.match(/\b([A-Z0-9]{10})\s+Confirmed/i) || smsBody.match(/^([A-Z0-9]{10})/i) || smsBody.match(/\b([A-Z0-9]{10})\b/);
  const id = idMatch ? idMatch[1].toUpperCase() : `MPESA_${Date.now()}`;

  // Extract Amount: e.g. "Ksh10.00", "Ksh 10.00", "Ksh. 10.00", "Ksh 10", "Ksh1,500.00"
  const amountMatch = smsBody.match(/Ksh\.?\s*([\d,]+(?:\.\d{1,2})?)/i);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;
  if (amount <= 0) {
    return null;
  }

  let description = 'M-Pesa Transaction';
  let type: MPesaTransaction['type'] = 'UNKNOWN';

  // 1. Bought Airtime
  if (/bought\s+Ksh/i.test(smsBody) || /bought.*?airtime/i.test(smsBody)) {
    type = 'AIRTIME';
    description = 'Airtime Purchase';
  }
  // 2. Paid to (Buy Goods / Paybill / Till)
  else if (/paid to/i.test(smsBody)) {
    type = 'PAYMENT';
    const descMatch = smsBody.match(/paid to\s+(.*?)(?=\s+on\s+|\s+for\s+account|\s+for\s+|\.\s*|New M-PESA balance)/i);
    if (descMatch) {
      description = descMatch[1].trim();
      description = description.replace(/\.+$/, '').trim();
    }
  } 
  // 3. Sent to (P2P / Send Money)
  else if (/sent to/i.test(smsBody) || /sent.*?to/i.test(smsBody)) {
    type = 'SEND';
    const descMatch = smsBody.match(/(?:sent to|sent\s+Ksh\.?\s*[\d,.]+\s*to)\s+(.*?)(?=\s+on\s+|\s+for\s+|\.\s*|New M-PESA balance)/i);
    if (descMatch) {
      let recipient = descMatch[1].trim();
      recipient = recipient.replace(/\s*(\+?254\d{9}|0[71]\d{8}|\d{9,12})$/, '').trim();
      recipient = recipient.replace(/\.+$/, '').trim();
      if (recipient) description = recipient;
    }
  } 
  // 4. Withdrawn
  else if (/withdraw/i.test(smsBody)) {
    type = 'WITHDRAWAL';
    const descMatch = smsBody.match(/from\s+(.*?)(?=\s+on\s+|\.\s*|New M-PESA balance)/i);
    if (descMatch) {
      description = `Withdrawal: ${descMatch[1].replace(/\.+$/, '').trim()}`;
    } else {
      description = 'M-Pesa Cash Withdrawal';
    }
  }

  // Extract Date if present in SMS, e.g., "on 15/10/26 at 4:30 PM"
  let date = new Date();
  const dateMatch = smsBody.match(/on\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+at\s+(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (dateMatch) {
    try {
      const day = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10) - 1;
      let year = parseInt(dateMatch[3], 10);
      if (year < 100) year += 2000;
      let hours = parseInt(dateMatch[4], 10);
      const minutes = parseInt(dateMatch[5], 10);
      const ampm = dateMatch[6]?.toUpperCase();
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
      
      const parsedDate = new Date(year, month, day, hours, minutes);
      if (!isNaN(parsedDate.getTime())) {
        date = parsedDate;
      }
    } catch {
      // fallback to current date
    }
  }

  const suggestedCategory = guessCategory(description, type);

  return {
    id,
    amount,
    description,
    date,
    type,
    suggestedCategory,
  };
}
