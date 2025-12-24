
/**
 * Utility functions for robust video frame extraction and processing.
 */

export const waitForSeek = async (video: HTMLVideoElement, timeSeconds: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            // If seek takes too long, we might still be okay if we are close enough
            if (Math.abs(video.currentTime - timeSeconds) < 0.1) {
                resolve();
            } else {
                reject(new Error("Seek timeout"));
            }
        }, 3000);

        const onSeeked = () => {
            clearTimeout(timeout);
            video.removeEventListener('seeked', onSeeked);
            resolve();
        };

        video.addEventListener('seeked', onSeeked);
        video.currentTime = timeSeconds;
    });
};

export const captureFrameAtTimestamp = async (
    video: HTMLVideoElement,
    timestampSeconds: number,
    quality = 0.8
): Promise<string> => {
    try {
        await waitForSeek(video, timestampSeconds);

        // Wait a tiny bit for the frame to actually render in the buffer
        await new Promise(r => setTimeout(r, 150));

        const canvas = document.createElement('canvas');
        // Limit resolution for API performance (max 720p height is usually enough for pose analysis)
        const scale = Math.min(1, 720 / video.videoHeight);
        canvas.width = video.videoWidth * scale;
        canvas.height = video.videoHeight * scale;

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Canvas context creation failed");

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Return base64 without prefix for Gemini API if needed, 
        // but typically we use full dataURI for display and strip it later.
        // Here we return full dataURI.
        return canvas.toDataURL('image/jpeg', quality);
    } catch (e) {
        console.warn(`Frame capture failed at ${timestampSeconds}s:`, e);
        throw e;
    }
};

export const compressImage = async (base64Str: string, maxWidth = 1280, quality = 0.7): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const scale = Math.min(1, maxWidth / img.width);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;

            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(base64Str); // Fallback
    });
};
