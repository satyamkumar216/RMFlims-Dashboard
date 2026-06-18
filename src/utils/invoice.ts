import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Generates a unique invoice / receipt number following conventional rules:
 * - Uses a standard prefix: e.g., RMF (RM Films) or INV. Let's use RMF.
 * - Incorporates the current calendar year.
 * - Pads the sequential number to 4 digits (e.g., RMF-2026-0001).
 * - Matches old format (XYZ-2026-001) as well to prevent resetting sequence numbers.
 * - Verifies uniqueness against both local array (for demo mode) and the DB.
 */
export async function generateUniqueReceiptNumber(
  supabase: SupabaseClient | null,
  isDemo: boolean = false,
  localBookings: any[] = []
): Promise<string> {
  const year = new Date().getFullYear();
  let maxNum = 0;

  // We will collect all existing receipt numbers to find max and enforce absolute uniqueness.
  const existingNumbers = new Set<string>();

  if (isDemo || !supabase) {
    // Process local/demo bookings
    localBookings.forEach(b => {
      if (b.receipt_number) {
        existingNumbers.add(b.receipt_number.trim().toUpperCase());
        // Match RMF, XYZ, or INV prefixes, followed by year and numeric sequence
        const match = b.receipt_number.match(/(RMF|XYZ|INV)-(\d+)-(\d+)/i);
        if (match && Number(match[2]) === year) {
          const num = Number(match[3]);
          if (num > maxNum) maxNum = num;
        }
      }
    });
  } else {
    // Fetch all receipt numbers from Supabase to guarantee uniqueness
    const { data: allBookings, error } = await supabase
      .from('bookings')
      .select('receipt_number');

    if (!error && allBookings) {
      allBookings.forEach(b => {
        if (b.receipt_number) {
          existingNumbers.add(b.receipt_number.trim().toUpperCase());
          const match = b.receipt_number.match(/(RMF|XYZ|INV)-(\d+)-(\d+)/i);
          if (match && Number(match[2]) === year) {
            const num = Number(match[3]);
            if (num > maxNum) maxNum = num;
          }
        }
      });
    }
  }

  // Generate the next sequential number, starting from maxNum + 1
  let nextNum = maxNum + 1;
  let receiptNumber = `RMF-${year}-${String(nextNum).padStart(4, '0')}`;

  // Ensure absolute uniqueness by incrementing nextNum if it already exists in the set
  while (existingNumbers.has(receiptNumber.toUpperCase())) {
    nextNum++;
    receiptNumber = `RMF-${year}-${String(nextNum).padStart(4, '0')}`;
  }

  return receiptNumber;
}
