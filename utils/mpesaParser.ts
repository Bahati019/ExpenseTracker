/**
 * M-Pesa SMS Parser
 * 
 * Extracts amount, merchant/recipient name, and transaction date from M-Pesa SMS formats.
 * Supports:
 * - Paid to (Buy Goods / Paybill)
 * - Sent to (P2P Transfers)
 * - Bought airtime
 * - Withdrawn
 */

export interface MPesaTransaction {
  id: string; // The M-Pesa receipt number
  amount: number;
  description: string; // Merchant or Recipient Name
  date: Date;
  type: 'PAYMENT' | 'SEND' | 'AIRTIME' | 'WITHDRAWAL' | 'UNKNOWN';
}

export function parseMPesaSMS(smsBody: string): MPesaTransaction | null {
  // Check if it's an M-Pesa message by looking for standard keywords
  if (!smsBody.includes('Confirmed') && !smsBody.includes('Ksh')) {
    return null;
  }

  // Common Regex Patterns
  // ID is usually 10 alphanumeric characters at the start (e.g., OBF11R9XF)
  const idMatch = smsBody.match(/^([A-Z0-9]{10})/);
  const id = idMatch ? idMatch[1] : `MPESA_${Date.now()}`;

  // Amount is usually prefixed with Ksh
  const amountMatch = smsBody.match(/Ksh([\d,]+\.\d{2})/);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;

  let description = 'M-Pesa Transaction';
  let type: MPesaTransaction['type'] = 'UNKNOWN';

  // Paid to (Buy Goods / Paybill)
  if (smsBody.includes('paid to')) {
    type = 'PAYMENT';
    const descMatch = smsBody.match(/paid to (.*?)(?= on | for | \.)/);
    if (descMatch) description = descMatch[1].trim();
  } 
  // Sent to (P2P)
  else if (smsBody.includes('sent to')) {
    type = 'SEND';
    const descMatch = smsBody.match(/sent to (.*?)(?= on | for | \.)/);
    if (descMatch) description = descMatch[1].replace(/ \d{10}$/, '').trim(); // Remove phone number if present
  } 
  // Bought Airtime
  else if (smsBody.includes('bought Ksh')) {
    type = 'AIRTIME';
    description = 'Airtime Purchase';
  }
  // Withdrawn
  else if (smsBody.includes('Withdraw Ksh') || smsBody.includes('Withdrawn Ksh')) {
    type = 'WITHDRAWAL';
    const descMatch = smsBody.match(/from (.*?) New M-PESA balance/);
    if (descMatch) description = `Withdrawal: ${descMatch[1].trim()}`;
  }

  // Ignore received money for expenses tracker
  if (smsBody.includes('received Ksh') || smsBody.includes('You have received')) {
    return null;
  }

  return {
    id,
    amount,
    description,
    date: new Date(), 
    type
  };
}
