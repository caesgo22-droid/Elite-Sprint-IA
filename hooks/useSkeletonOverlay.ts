import { useCallback } from 'react';
import { PoseLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';

export const useSkeletonOverlay = () => {

    // Draw simplified skeleton for UI overlay
    const drawSkeleton = useCallback((
        ctx: CanvasRenderingContext2D,
        landmarks: any[],
        videoWidth: number,
        videoHeight: number,
        displayWidth: number,
        displayHeight: number
    ) => {
        if (!landmarks || landmarks.length === 0 || videoWidth === 0) return;

        ctx.canvas.width = displayWidth;
        ctx.canvas.height = displayHeight;
        ctx.clearRect(0, 0, displayWidth, displayHeight);

        // Calculate aspect ratios for "object-contain" scaling
        const videoRatio = videoWidth / videoHeight;
        const displayRatio = displayWidth / displayHeight;

        let renderWidth = displayWidth;
        let renderHeight = displayHeight;
        let xOffset = 0;
        let yOffset = 0;

        if (displayRatio > videoRatio) {
            // Letterboxing (Current container is wider than video)
            renderWidth = displayHeight * videoRatio;
            xOffset = (displayWidth - renderWidth) / 2;
        } else {
            // Pillarboxing (Current container is taller than video)
            renderHeight = displayWidth / videoRatio;
            yOffset = (displayHeight - renderHeight) / 2;
        }

        const toScreen = (p: { x: number, y: number }) => ({
            x: (p.x * renderWidth) + xOffset,
            y: (p.y * renderHeight) + yOffset
        });

        const lms = landmarks[0]; // First detected pose

        // Helper to draw segment
        const drawSegment = (indices: number[], color: string) => {
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            // First point
            const p0 = toScreen(lms[indices[0]]);
            ctx.moveTo(p0.x, p0.y);

            for (let i = 1; i < indices.length; i++) {
                const p = toScreen(lms[indices[i]]);
                ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();
        };

        // Draw connections (Simplified Skeleton)
        // Legs
        drawSegment([23, 25, 27, 31], 'cyan'); // Left Leg
        drawSegment([24, 26, 28, 32], 'magenta'); // Right Leg
        // Torso
        drawSegment([11, 23], 'white'); // Left Side
        drawSegment([12, 24], 'white'); // Right Side
        drawSegment([11, 12], 'white'); // Shoulders
        drawSegment([23, 24], 'white'); // Hips
        // Arms
        drawSegment([11, 13, 15], 'cyan'); // Left Arm
        drawSegment([12, 14, 16], 'magenta'); // Right Arm

        // Draw keypoints
        const keypointsOfInterest = [
            11, 12, 23, 24, // Torso
            25, 26, 27, 28, 31, 32, // Legs
            13, 14, 15, 16 // Arms
        ];

        keypointsOfInterest.forEach(idx => {
            const p = lms[idx];
            const sp = toScreen(p);
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, 4, 0, 2 * Math.PI);
            ctx.fillStyle = idx % 2 === 0 ? 'magenta' : 'cyan';
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1;
            ctx.stroke();
        });

    }, []);

    return { drawSkeleton };
};
