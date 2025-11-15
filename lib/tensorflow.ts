import * as poseDetection from '@tensorflow-models/pose-detection';
import * as tf from '@tensorflow/tfjs';

let detector: poseDetection.PoseDetector | null = null;

export async function initializeMoveNet() {
  if (detector) {
    return detector;
  }

  await tf.ready();
  
  const model = poseDetection.SupportedModels.MoveNet;
  const detectorConfig: poseDetection.movenet.MoveNetModelConfig = {
    modelType: poseDetection.movenet.movenetModelType.SINGLEPOSE_LIGHTNING,
  };
  
  detector = await poseDetection.createDetector(model, detectorConfig);
  return detector;
}

export async function detectPose(video: HTMLVideoElement) {
  if (!detector) {
    await initializeMoveNet();
  }
  
  if (detector) {
    return await detector.estimatePoses(video);
  }
  
  return [];
}

