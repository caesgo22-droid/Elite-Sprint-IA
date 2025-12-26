import { useState, useEffect, useRef } from 'react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

export const useMediaPipe = () => {
    const [poseLandmarker, setPoseLandmarker] = useState<PoseLandmarker | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const initializationRef = useRef(false);

    useEffect(() => {
        if (initializationRef.current) return;
        initializationRef.current = true;

        const init = async () => {
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm"
                );
                const landmarker = await PoseLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task`,
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO",
                    numPoses: 1,
                    minPoseDetectionConfidence: 0.6,
                    minPosePresenceConfidence: 0.6,
                    minTrackingConfidence: 0.6
                });
                setPoseLandmarker(landmarker);
                setIsReady(true);
                console.log("✅ MediaPipe Pose Landmarker Initialized");
            } catch (err: any) {
                console.error("Error initializing MediaPipe:", err);
                setError(err.message || "Failed to initialize MediaPipe");
            }
        };

        init();
    }, []);

    return { poseLandmarker, isReady, error };
};
