// Live2D 관련 타입 정의

export interface Live2DModel {
  name: string;
  description: string;
  url: string;
  kScale: number;
  initialXshift: number;
  initialYshift: number;
  kXOffset: number;
  idleMotionGroupName: string;
  emotionMap: {
    [emotion: string]: number;
  };
  tapMotions: {
    [area: string]: {
      [motion: string]: number;
    };
  };
}

export interface Live2DInstance {
  model: any;
  canvas: HTMLCanvasElement;
  app: any;
  currentModel?: any;
  destroy: () => void;
}

export interface Live2DEmotions {
  neutral: number;
  joy: number;
  anger: number;
  sadness: number;
  surprise: number;
  fear?: number;
  disgust?: number;
  smirk?: number;
}

declare global {
  interface Window {
    PIXI: any;
    Live2DCubismFramework: any;
    Live2DCubismCore: any;
    live2d?: any;
  }
}
