
/**
 * Calculates the distance between two points in meters using the Haversine formula.
 */
export const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
};

export interface LocationCheckResult {
    isVerified: boolean;
    error?: string;
}

export const APPROX_ACCURACY_METERS = 500;

/**
 * true = at the venue, false = outside, null = unverifiable (fix too coarse).
 */
export function geofenceStatus(distance: number, accuracy: number, radius: number): boolean | null {
    if (accuracy > Math.max(radius, APPROX_ACCURACY_METERS)) return null;
    return distance - Math.min(accuracy, 100) <= radius;
}

export const isInAppBrowser = (ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean =>
    /Instagram|FBAN|FBAV|FB_IAB|Line\/|Snapchat|GroupMe|LinkedInApp|BytedanceWebview|musical_ly|Twitter/i.test(ua);

const getPositionOnce = (options: PositionOptions): Promise<GeolocationPosition> =>
    new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, options));

/**
 * Two-stage position lookup: a (possibly cached) high-accuracy fix first, then
 * one low-accuracy retry on POSITION_UNAVAILABLE / TIMEOUT. Permission denied
 * (code 1) rejects immediately.
 */
export const getCurrentPosition = async (): Promise<GeolocationPosition> => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
        throw new Error('Geolocation is not supported by your browser');
    }
    try {
        return await getPositionOnce({ enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
    } catch (err: any) {
        if (err?.code === 2 || err?.code === 3) {
            return await getPositionOnce({ enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 });
        }
        throw err;
    }
};
