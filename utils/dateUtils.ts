/**
 * Parses a local date string (YYYY-MM-DD) into a Date object
 * treated as local time (midnight).
 * 
 * @param dateStr String in YYYY-MM-DD format
 * @returns Date object
 */
export const parseLocalDate = (dateStr: string): Date => {
  // Split the date string
  const [year, month, day] = dateStr.split('-').map(Number);

  // Create date using local constructor (months are 0-indexed)
  return new Date(year, month - 1, day);
};

/**
 * Formats a Date object back to YYYY-MM-DD string using local time.
 * 
 * @param date Date object
 * @returns String in YYYY-MM-DD format
 */
export const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Formats a date string (YYYY-MM-DD) into a friendly "Mon D" format
 * (e.g. "Sept 4").
 * 
 * @param dateStr String in YYYY-MM-DD format
 * @returns Friendly string
 */
export const formatFriendlyDate = (dateStr: string): string => {
  const date = parseLocalDate(dateStr);
  return date.toLocaleString('default', { month: 'short', day: 'numeric' });
};

/**
 * Checks if two date strings represent the same day.
 */
// Existing export...
export const isSameDay = (dateStr1: string, dateStr2: string): boolean => {
  return dateStr1 === dateStr2;
};

/**
 * Converts a date and time from a source time zone to Central Time (America/Chicago).
 * Returns the date and time strings in YYYY-MM-DD and HH:MM format (24h).
 */
export const convertInputToCST = (dateStr: string, timeStr: string, sourceTimeZone: string): { date: string, time: string } => {
  if (!dateStr || !timeStr) return { date: dateStr, time: timeStr };

  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);

  // 1. Find the Absolute Timestamp (UTC) for the input time in the source zone.
  // We use an iterative approach because we don't know the offset initially.

  // Start assuming the input time is UTC
  let estimated = new Date(Date.UTC(year, month - 1, day, hours, minutes));

  // Refine logic:
  // We want finding T such that T in SourceZone == InputComponents.
  // 
  // Loop (max 3 tries):
  // 1. Format 'estimated' to parts in SourceZone.
  // 2. Calculate difference between formatted parts and InputComponents.
  // 3. Adjust 'estimated' by that difference.

  const getPartsInZone = (d: Date, zone: string) => {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
      hour12: false
    });
    const parts = fmt.formatToParts(d);
    const part = (type: string) => Number(parts.find(p => p.type === type)?.value);
    // Note: hour12: false returns 24:00 for midnight sometimes? No, 0-23 usually.
    // Actually Intl 'hour12: false' produces "24" for midnight in some browsers? Best to check.
    // Standard is 0-23.
    let h = part('hour');
    if (h === 24) h = 0;
    return {
      y: part('year'),
      m: part('month'),
      d: part('day'),
      h: h,
      min: part('minute')
    };
  };

  for (let i = 0; i < 3; i++) {
    const currentParts = getPartsInZone(estimated, sourceTimeZone);

    // Calculate diff in ms
    // We construct a UTC date from the 'currentParts' to compare with 'InputComponents' (also as UTC)
    // Only difference matters.
    const currentAsUTC = Date.UTC(currentParts.y, currentParts.m - 1, currentParts.d, currentParts.h, currentParts.min);
    const targetAsUTC = Date.UTC(year, month - 1, day, hours, minutes);

    const diff = targetAsUTC - currentAsUTC;
    if (Math.abs(diff) < 1000) break; // Close enough

    estimated = new Date(estimated.getTime() + diff);
  }

  // Now 'estimated' is the correct instant.
  // Convert to CST (America/Chicago)
  const cstParts = getPartsInZone(estimated, 'America/Chicago');

  const pad = (n: number) => n.toString().padStart(2, '0');
  const finalDate = `${cstParts.y}-${pad(cstParts.m)}-${pad(cstParts.d)}`;
  const finalTime = `${pad(cstParts.h)}:${pad(cstParts.min)}`;

  return { date: finalDate, time: finalTime };
};
