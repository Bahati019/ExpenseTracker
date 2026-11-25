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
  type: 'PAYMENT' | 'PAYBILL' | 'SEND' | 'AIRTIME' | 'WITHDRAWAL' | 'UNKNOWN';
  suggestedCategory: string;
  accountNumber?: string;
}

export function guessCategory(
  description: string,
  type: MPesaTransaction['type'] = 'UNKNOWN',
  fullSms?: string
): string {
  // Combine description and full SMS body so no merchant keywords are missed
  const combined = `${description || ''} ${fullSms || ''}`.toLowerCase();

  // 1. Rent & Housing
  if (
    combined.includes('rent') ||
    combined.includes('housing') ||
    combined.includes('caretaker') ||
    combined.includes('landlord') ||
    combined.includes('property') ||
    combined.includes('apartment') ||
    combined.includes('apartments') ||
    combined.includes('residence') ||
    combined.includes('estate') ||
    combined.includes('tenant') ||
    combined.includes('court') ||
    combined.includes('hostel') ||
    /\bhse\b/i.test(combined) ||
    /\bhouse\b/i.test(combined)
  ) {
    return 'Rent & Housing';
  }

  // 2. Utilities
  if (
    type === 'AIRTIME' ||
    combined.includes('airtime') ||
    combined.includes('safaricom') ||
    combined.includes('airtel') ||
    combined.includes('telkom') ||
    combined.includes('bundle') ||
    combined.includes('kplc') ||
    combined.includes('token') ||
    combined.includes('kenya power') ||
    combined.includes('stima') ||
    combined.includes('prepaid') ||
    combined.includes('postpaid') ||
    combined.includes('water') ||
    combined.includes('nairobi water') ||
    combined.includes('sewerage') ||
    combined.includes('maji') ||
    combined.includes('wifi') ||
    combined.includes('zuku') ||
    combined.includes('internet') ||
    combined.includes('faiba') ||
    combined.includes('jtl') ||
    combined.includes('dstv') ||
    combined.includes('gotv') ||
    combined.includes('startimes') ||
    combined.includes('electricity') ||
    combined.includes('garbage') ||
    combined.includes('clean') ||
    combined.includes('laundry')
  ) {
    return 'Utilities';
  }

  // 3. Food (Supermarkets, Groceries, Delivery apps, Restaurants, Fast Food, Cafes, Bars)
  if (
    // Supermarkets & Groceries (including variations with spaces/hyphens)
    combined.includes('naivas') ||
    combined.includes('quickmart') ||
    combined.includes('quick mart') ||
    combined.includes('quick-mart') ||
    combined.includes('quick_mart') ||
    combined.includes('carrefour') ||
    combined.includes('supermarket') ||
    combined.includes('chandarana') ||
    combined.includes('foodplus') ||
    combined.includes('food plus') ||
    combined.includes('cleanshelf') ||
    combined.includes('eastmatt') ||
    combined.includes('tuskys') ||
    combined.includes('tumaini') ||
    combined.includes('magunas') ||
    combined.includes('kassmart') ||
    combined.includes('choppies') ||
    combined.includes('mama mboga') ||
    combined.includes('market') ||
    combined.includes('greens') ||
    combined.includes('grocery') ||
    combined.includes('groceries') ||
    combined.includes('kibanda') ||
    // Food Delivery
    combined.includes('glovo') ||
    combined.includes('bolt food') ||
    combined.includes('uber eats') ||
    combined.includes('ubereats') ||
    combined.includes('jumia food') ||
    // Restaurants, Fast Food, Bakeries, Butcheries
    combined.includes('kfc') ||
    combined.includes('java') ||
    combined.includes('artcaffe') ||
    combined.includes('artcaffé') ||
    combined.includes('galitos') ||
    combined.includes('pizza') ||
    combined.includes('burger') ||
    combined.includes('chicken') ||
    combined.includes('subway') ||
    combined.includes('big square') ||
    combined.includes("cj's") ||
    combined.includes('cjs') ||
    combined.includes('dominos') ||
    combined.includes('creamy inn') ||
    combined.includes('pizza inn') ||
    combined.includes('chicken inn') ||
    combined.includes('bakers inn') ||
    combined.includes('bakery') ||
    combined.includes('bakes') ||
    combined.includes('pastry') ||
    combined.includes('butchery') ||
    combined.includes('meat') ||
    combined.includes('pork') ||
    combined.includes('beef') ||
    combined.includes('fish') ||
    combined.includes('fruits') ||
    combined.includes('vegetables') ||
    combined.includes('restaurant') ||
    combined.includes('cafe') ||
    combined.includes('café') ||
    combined.includes('coffee') ||
    combined.includes('tea') ||
    combined.includes('boba') ||
    combined.includes('smoothie') ||
    combined.includes('shawarma') ||
    combined.includes('snack') ||
    combined.includes('deli') ||
    combined.includes('eatery') ||
    combined.includes('dining') ||
    combined.includes('hotel') ||
    combined.includes('lounge') ||
    combined.includes('grill') ||
    combined.includes('choma') ||
    combined.includes('food') ||
    // Bars, Pubs & Drinks
    combined.includes('bar') ||
    combined.includes('pub') ||
    combined.includes('liquor') ||
    combined.includes('wines') ||
    combined.includes('spirits') ||
    combined.includes('brew')
  ) {
    return 'Food';
  }

  // 4. Transport (Cabs, Fuel, Public Transit)
  if (
    combined.includes('uber') ||
    combined.includes('bolt') ||
    combined.includes('little') ||
    combined.includes('faras') ||
    combined.includes('wasili') ||
    combined.includes('shell') ||
    combined.includes('total') ||
    combined.includes('rubis') ||
    combined.includes('petrol') ||
    combined.includes('diesel') ||
    combined.includes('fuel') ||
    combined.includes('oil') ||
    combined.includes('matatu') ||
    combined.includes('fare') ||
    combined.includes('boda') ||
    combined.includes('bodaboda') ||
    combined.includes('stage') ||
    combined.includes('parking') ||
    combined.includes('toll') ||
    combined.includes('expressway') ||
    combined.includes('sgr') ||
    combined.includes('easy coach') ||
    combined.includes('modern coast') ||
    combined.includes('tahmeed') ||
    combined.includes('shuttle') ||
    combined.includes('bus')
  ) {
    return 'Transport';
  }

  // 5. Entertainment (Streaming, Cinema, Gaming, Betting, Events)
  if (
    combined.includes('netflix') ||
    combined.includes('spotify') ||
    combined.includes('cinema') ||
    combined.includes('movie') ||
    combined.includes('imax') ||
    combined.includes('angate') ||
    combined.includes('game') ||
    combined.includes('gaming') ||
    combined.includes('playstation') ||
    combined.includes('betting') ||
    combined.includes('sportpesa') ||
    combined.includes('betika') ||
    combined.includes('mozzart') ||
    combined.includes('1xbet') ||
    combined.includes('ticket') ||
    combined.includes('concert') ||
    combined.includes('event')
  ) {
    return 'Entertainment';
  }

  return 'Others';
}

export function parseMPesaSMS(smsBody: string): MPesaTransaction | null {
  if (!smsBody) return null;

  // Ignore received money for expenses tracker (income, not expense)
  if (
    /received\s+(?:Ksh|KES)/i.test(smsBody) || 
    /you\s+have\s+received/i.test(smsBody) ||
    /give\s+(?:Ksh|KES)/i.test(smsBody)
  ) {
    return null;
  }

  // Check if it's an M-Pesa message
  const hasMpesaKeyword = /confirmed|m-pesa|mpesa|paybill|buy goods|till/i.test(smsBody);
  const hasCurrency = /(?:Ksh|KES)/i.test(smsBody);
  if (!hasMpesaKeyword || !hasCurrency) {
    return null;
  }

  // Extract M-Pesa transaction ID (10 alphanumeric chars)
  const idMatch =
    smsBody.match(/\b([A-Z0-9]{10})\s+Confirmed/i) ||
    smsBody.match(/^([A-Z0-9]{10})/i) ||
    smsBody.match(/\b([A-Z0-9]{10})\b/);
  const id = idMatch ? idMatch[1].toUpperCase() : `MPESA_${Date.now()}`;

  // Extract Amount: e.g. "Ksh10.00", "Ksh 10.00", "Ksh. 10.00", "Ksh 10", "KES 1,500.00"
  const amountMatch = smsBody.match(/(?:Ksh|KES)\.?\s*([\d,]+(?:\.\d{1,2})?)/i);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;
  if (amount <= 0) {
    return null;
  }

  let description = 'M-Pesa Transaction';
  let type: MPesaTransaction['type'] = 'UNKNOWN';
  let accountNumber: string | undefined = undefined;

  // 1. Bought Airtime
  if (/bought\s+Ksh/i.test(smsBody) || /bought.*?airtime/i.test(smsBody)) {
    type = 'AIRTIME';
    description = 'Airtime Purchase';
  }
  // 2. Paybill / Buy Goods / Merchant Payments
  else if (
    /paid\s+to/i.test(smsBody) ||
    /paid\s+Ksh\.?\s*[\d,.]+\s*to/i.test(smsBody) ||
    /paybill/i.test(smsBody) ||
    /for\s+account/i.test(smsBody)
  ) {
    // Extract Paybill account number if present (e.g., "for account 12345678")
    const accMatch = smsBody.match(/for\s+account\s+([A-Za-z0-9_\-\/.]+)/i);
    if (accMatch) {
      accountNumber = accMatch[1].replace(/\.+$/, '').trim();
      type = 'PAYBILL';
    } else {
      type = 'PAYMENT';
    }

    const descMatch = smsBody.match(
      /(?:paid\s+to|paid\s+Ksh\.?\s*[\d,.]+\s*to)\s+(.*?)(?=\s+for\s+account|\s+on\s+|\s+for\s+|\.\s*|New M-PESA balance)/i
    );
    if (descMatch) {
      let merchant = descMatch[1].trim();
      // Clean up leading Paybill business numbers like "888880 - KPLC" -> "KPLC"
      merchant = merchant.replace(/^(\d{5,7}\s*[-–:]\s*)/, '').trim();
      merchant = merchant.replace(/\.+$/, '').trim();

      if (accountNumber) {
        description = `${merchant} (Acc: ${accountNumber})`;
      } else {
        description = merchant;
      }
    } else if (accountNumber) {
      description = `Paybill (Acc: ${accountNumber})`;
    }
  } 
  // 3. Sent to (P2P / Send Money)
  else if (/sent to/i.test(smsBody) || /sent.*?to/i.test(smsBody)) {
    type = 'SEND';
    const descMatch = smsBody.match(
      /(?:sent to|sent\s+Ksh\.?\s*[\d,.]+\s*to)\s+(.*?)(?=\s+on\s+|\s+for\s+|\.\s*|New M-PESA balance)/i
    );
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

  const suggestedCategory = guessCategory(description, type, smsBody);

  return {
    id,
    amount,
    description,
    date,
    type,
    suggestedCategory,
  };
}
