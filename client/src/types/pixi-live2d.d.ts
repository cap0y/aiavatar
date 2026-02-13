declare module 'pixi-live2d' {
  import * as PIXI from 'pixi.js';

  export class Live2DModel extends PIXI.Container {
    static from(source: string | any): Promise<Live2DModel>;
    
    internalModel?: {
      motionManager?: {
        startRandomMotion(group: string, priority: number): void;
      };
      eyeBlink?: {
        setEyeBlinkIds(ids: string[]): void;
      };
      breath?: {
        setBreathIds(ids: string[]): void;
      };
      coreModel?: {
        getParameterIds(): string[];
      };
    };
    
    anchor: PIXI.ObservablePoint;
    position: PIXI.ObservablePoint;
    scale: PIXI.ObservablePoint;
    destroy(): void;
  }
} 