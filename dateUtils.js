/**
 * ============================================================================
 * DATE UTILITIES - INTELLIGENT DATE FILTERING SYSTEM (v5.0)
 * ============================================================================
 * 
 * This module provides date parsing and filtering functions to ensure
 * availability dates in follow-up emails are always current and valid.
 * 
 * KEY FEATURES:
 * - Parses natural language dates (e.g., "November 9-26th", "Dec 1-15")
 * - Filters dates based on when each follow-up email will be sent
 * - Automatically adjusts date ranges when start dates have passed
 * - Handles year rollovers (dates in past assume next year)
 * - Returns validity status for smart email content adjustment
 * 
 * PROBLEM IT SOLVES:
 * Musicians enter availability like "November 9-26th" on October 28.
 * Follow-up emails are sent on day 7, 14, 21, 31, 41, 51, 61.
 * By day 31 (November 28), those dates have expired - showing them
 * would be unprofessional. This module filters them automatically.
 * 
 * INTEGRATION:
 * Used in index.js endpoints to filter dates before building AI prompts.
 * 
 * See README.md and DEVELOPER_GUIDE.md for more details.
 * ============================================================================
 */

/**
 * Parse date strings in natural language format into Date objects.
 * 
 * SUPPORTED FORMATS:
 * - "November 9-26th" - Full month name with date range
 * - "Nov 9-26" - Abbreviated month with date range
 * - "December 5" - Single date
 * - "Dec 5th" - Single date with ordinal suffix
 * 
 * BEHAVIOR:
 * - Uses provided currentYear for date construction
 * - If parsed date is in the past, assumes next year
 * - Handles both date ranges (9-26) and single dates (5)
 * - Returns empty array if date string can't be parsed
 * 
 * EXAMPLES:
 * parseDateRanges("November 9-26th", 2025) 
 * // => [{ start: Date(2025-11-09), end: Date(2025-11-26) }]
 * 
 * parseDateRanges("Dec 1-15", 2025)
 * // => [{ start: Date(2025-12-01), end: Date(2025-12-15) }]
 * 
 * @param {string} dateStr - The date string to parse (e.g., "November 9-26th")
 * @param {number} currentYear - The year to use for parsing (e.g., 2025)
 * @returns {Array<{start: Date, end: Date}>} Array of date range objects
 */
function parseDateRanges(dateStr, currentYear) {
  if (!dateStr || typeof dateStr !== 'string') {
    return [];
  }

  const ranges = [];
  const cleaned = dateStr.trim();
  
  // Month name patterns
  const monthNames = {
    january: 0, jan: 0,
    february: 1, feb: 1,
    march: 2, mar: 2,
    april: 3, apr: 3,
    may: 4,
    june: 5, jun: 5,
    july: 6, jul: 6,
    august: 7, aug: 7,
    september: 8, sep: 8, sept: 8,
    october: 9, oct: 9,
    november: 10, nov: 10,
    december: 11, dec: 11
  };

  // Pattern: "November 9-26th" or "Nov 9-26" or "November 9-26"
  const rangePattern = /(\w+)\s+(\d+)\s*-\s*(\d+)(?:st|nd|rd|th)?/gi;
  let match;
  
  while ((match = rangePattern.exec(cleaned)) !== null) {
    const monthStr = match[1].toLowerCase();
    const startDay = parseInt(match[2]);
    const endDay = parseInt(match[3]);
    
    if (monthNames.hasOwnProperty(monthStr)) {
      const month = monthNames[monthStr];
      const startDate = new Date(currentYear, month, startDay);
      const endDate = new Date(currentYear, month, endDay);
      
      // If dates are in the past, try next year
      const now = new Date();
      if (endDate < now) {
        startDate.setFullYear(currentYear + 1);
        endDate.setFullYear(currentYear + 1);
      }
      
      ranges.push({ start: startDate, end: endDate });
    }
  }

  // Pattern: "December 5" or "Dec 5th" (single date)
  const singlePattern = /(\w+)\s+(\d+)(?:st|nd|rd|th)?(?:\s|,|$)/gi;
  while ((match = singlePattern.exec(cleaned)) !== null) {
    const monthStr = match[1].toLowerCase();
    const day = parseInt(match[2]);
    
    if (monthNames.hasOwnProperty(monthStr)) {
      const month = monthNames[monthStr];
      const date = new Date(currentYear, month, day);
      
      const now = new Date();
      if (date < now) {
        date.setFullYear(currentYear + 1);
      }
      
      ranges.push({ start: date, end: date });
    }
  }

  return ranges;
}

/**
 * Filter availability dates based on when the email will be sent.
 * 
 * This is the MAIN FUNCTION of this module - called by all email generation endpoints.
 * 
 * WHAT IT DOES:
 * 1. Calculates when the email will actually be sent (current date + daysFromNow)
 * 2. Parses the user's availability string into date ranges
 * 3. Filters out dates that will have passed by the time email is sent
 * 4. Adjusts start dates that are before email send date
 * 5. Returns validity status and filtered availability string
 * 
 * FOLLOW-UP SCHEDULE:
 * - Email 1: daysFromNow = 7   (sends 7 days after initial email)
 * - Email 2: daysFromNow = 14  (sends 14 days after initial email)
 * - Email 3: daysFromNow = 21
 * - Email 4: daysFromNow = 31
 * - Email 5: daysFromNow = 41
 * - Email 6: daysFromNow = 51
 * - Email 7: daysFromNow = 61
 * 
 * EXAMPLE SCENARIO:
 * User enters: "November 9-26th" on October 28
 * 
 * Email 1 (day 7, Nov 4):   Returns "November 9-26"  ✅ All dates valid
 * Email 2 (day 14, Nov 11):  Returns "November 11-26" ✅ Adjusted start
 * Email 3 (day 21, Nov 18):  Returns "November 18-26" ✅ Adjusted start
 * Email 4 (day 31, Nov 28):  Returns ""               ❌ All dates expired
 * 
 * RETURN VALUE:
 * {
 *   hasValidDates: boolean     - true if any dates still valid, false if all expired
 *   filteredAvailability: string  - Reconstructed date string or empty string
 * }
 * 
 * When hasValidDates = false, the AI prompt is adjusted to NOT mention artist dates,
 * only ask about venue's available dates.
 * 
 * @param {string} availability - The availability string from user input (e.g., "November 9-26th")
 * @param {number} daysFromNow - How many days from now the email will be sent (7, 14, 21, etc.)
 * @param {string} userCurrentDate - ISO 8601 date string of user's current date/time
 * @returns {Object} { hasValidDates: boolean, filteredAvailability: string }
 */
function filterAvailabilityByDate(availability, daysFromNow, userCurrentDate) {
  // Handle empty or "OPEN" cases
  if (!availability || availability.trim() === '' || availability.toUpperCase() === 'OPEN') {
    return { hasValidDates: false, filteredAvailability: '' };
  }

  // Calculate when this email will be sent
  const currentDate = userCurrentDate ? new Date(userCurrentDate) : new Date();
  const emailSendDate = new Date(currentDate);
  emailSendDate.setDate(emailSendDate.getDate() + daysFromNow);
  
  // Parse the date ranges from the availability string
  const currentYear = currentDate.getFullYear();
  const dateRanges = parseDateRanges(availability, currentYear);
  
  if (dateRanges.length === 0) {
    // Could not parse dates, return original
    return { hasValidDates: true, filteredAvailability: availability };
  }

  // Filter out ranges that have completely passed by the time email is sent
  const validRanges = dateRanges.filter(range => {
    // Keep range if end date is after or on the email send date
    return range.end >= emailSendDate;
  });

  if (validRanges.length === 0) {
    // All dates have passed
    return { hasValidDates: false, filteredAvailability: '' };
  }

  // Adjust start dates if they're before the email send date
  const adjustedRanges = validRanges.map(range => {
    if (range.start < emailSendDate) {
      // Move start date to the email send date
      return { start: emailSendDate, end: range.end };
    }
    return range;
  });

  // Reconstruct the availability string with valid dates
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
  
  const rangeStrings = adjustedRanges.map(range => {
    const startMonth = monthNames[range.start.getMonth()];
    const startDay = range.start.getDate();
    const endDay = range.end.getDate();
    
    if (range.start.getTime() === range.end.getTime()) {
      // Single date
      return `${startMonth} ${startDay}`;
    } else {
      // Date range
      return `${startMonth} ${startDay}-${endDay}`;
    }
  });

  const filteredAvailability = rangeStrings.join(', ');
  
  return { hasValidDates: true, filteredAvailability };
}

/**
 * Get wait days for a specific email index
 * @param {number} emailIndex - The index of the follow-up email (0-6)
 * @returns {number} Number of days to wait
 */
function getWaitDays(emailIndex) {
  const waitDays = [7, 14, 21, 31, 41, 51, 61];
  return waitDays[emailIndex] || 0;
}

module.exports = {
  parseDateRanges,
  filterAvailabilityByDate,
  getWaitDays
};

