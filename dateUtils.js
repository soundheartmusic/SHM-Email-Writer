/**
 * Date utility functions for handling availability date filtering
 */

/**
 * Parse date strings like "November 9-26th", "Dec 1-15", "January 5-12"
 * @param {string} dateStr - The date string to parse
 * @param {number} currentYear - The year to use for parsing
 * @returns {Array<{start: Date, end: Date}>} Array of date ranges
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
 * Filter availability dates based on when the email will be sent
 * @param {string} availability - The availability string from user input
 * @param {number} daysFromNow - How many days from now the email will be sent
 * @param {string} userCurrentDate - ISO string of user's current date
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

