import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { Live2DModel } from 'pixi-live2d-display';
import * as PIXI from 'pixi.js';

// PIXI를 글로벌로 설정
if (typeof window !== 'undefined') {
  (window as any).PIXI = PIXI;
}

// Live2D SDK 파라미터 타입
interface ParameterInfo {
  id: string;
  name: string;
  value: number;
  minValue: number;
  maxValue: number;
  defaultValue: number;
}

// 모델 정보 타입
interface ModelInfo {
  name: string;
  description: string;
  url: string;
  kScale?: number;
  initialXshift?: number;
  initialYshift?: number;
}

// 파트 정보 타입
interface PartInfo {
  id: string;
  name: string;
  opacity: number;
}

// 커스텀 표정 타입
interface CustomExpression {
  name: string;
  parameters: { [paramId: string]: number };
}

// 브레스 설정 타입
interface BreathSettings {
  enabled: boolean;
  cycle: number;
  peak: number;
  offset: number;
}

// 눈 깜빡임 설정 타입
interface EyeBlinkSettings {
  enabled: boolean;
  interval: number;
  closingDuration: number;
  closedDuration: number;
  openingDuration: number;
}

const AvatarStudio: React.FC = () => {
  const [, setLocation] = useLocation();
  
  // 상태 관리
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [modelDefinitions, setModelDefinitions] = useState<{ [key: string]: ModelInfo }>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Live2D 파라미터 상태
  const [parameters, setParameters] = useState<ParameterInfo[]>([]);
  const [parts, setParts] = useState<PartInfo[]>([]);
  const [selectedParameter, setSelectedParameter] = useState<string>('');
  
  // 고급 기능 상태
  const [breathSettings, setBreathSettings] = useState<BreathSettings>({
    enabled: false, // 기본 비활성화 (사용자 수동 제어를 위해)
    cycle: 3.0,
    peak: 0.5,
    offset: 0.0,
  });
  
  const [eyeBlinkSettings, setEyeBlinkSettings] = useState<EyeBlinkSettings>({
    enabled: false, // 기본 비활성화 (사용자 수동 제어를 위해)
    interval: 3.0,
    closingDuration: 0.1,
    closedDuration: 0.1,
    openingDuration: 0.15,
  });
  
  const [customExpressions, setCustomExpressions] = useState<CustomExpression[]>([]);
  const [currentExpression, setCurrentExpression] = useState<string>('');
  const [newExpressionName, setNewExpressionName] = useState<string>('');
  
  // 프리셋 관리 상태
  const [presetName, setPresetName] = useState<string>('');
  const [savedPresets, setSavedPresets] = useState<Array<{name: string, parameters: {[key: string]: number}}>>([]);
  
  // 모델 복제/저장 상태
  const [isSavingAsNew, setIsSavingAsNew] = useState<boolean>(false);
  const [newModelNameForSave, setNewModelNameForSave] = useState<string>('');
  
  // 커스텀 모델 목록 (사용자가 복제한 모델들)
  const [customModelNames, setCustomModelNames] = useState<string[]>([]);
  
  // 이미지 편집 상태
  const [isImageEditorOpen, setIsImageEditorOpen] = useState<boolean>(false);
  const [selectedTexture, setSelectedTexture] = useState<string | null>(null);
  const [textureList, setTextureList] = useState<{name: string, url: string}[]>([]);
  const [editingImage, setEditingImage] = useState<HTMLImageElement | null>(null);
  const [canvasBrushSize, setCanvasBrushSize] = useState<number>(10);
  const [canvasBrushColor, setCanvasBrushColor] = useState<string>('#000000');
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [drawMode, setDrawMode] = useState<'brush' | 'eraser' | 'line' | 'rect' | 'circle' | 'select' | 'magic-wand'>('brush');
  const [canvasZoom, setCanvasZoom] = useState<number>(1);
  const [canvasHistory, setCanvasHistory] = useState<ImageData[]>([]);
  const [historyStep, setHistoryStep] = useState<number>(-1);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const [startPoint, setStartPoint] = useState<{x: number, y: number} | null>(null);
  
  // 영역 선택 상태 (여러 개 선택 가능)
  // pixels가 있으면 Magic Wand로 선택된 실제 픽셀들, 없으면 사각형 영역
  const [selectionRects, setSelectionRects] = useState<Array<{
    x: number, 
    y: number, 
    width: number, 
    height: number,
    pixels?: Array<{x: number, y: number}>
  }>>([]);
  const [isSelecting, setIsSelecting] = useState<boolean>(false);
  const [magicWandTolerance, setMagicWandTolerance] = useState<number>(32); // 색상 허용 오차 (0-255)
  const [fillColor, setFillColor] = useState<string>('#FF6B9D'); // 선택 영역 칠하기 색상
  
  // AI 이미지 변환 상태
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [aiStyle, setAiStyle] = useState<string>('anime');
  const [isAiProcessing, setIsAiProcessing] = useState<boolean>(false);
  const [regionAiPrompt, setRegionAiPrompt] = useState<string>(''); // 영역 AI 변환용 프롬프트
  
  // 캔버스 초기화
  useEffect(() => {
    if (canvasRef.current) {
      // willReadFrequently 속성 설정으로 getImageData 성능 향상
      const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctxRef.current = ctx;
      }
    }
  }, []);
  
  // 히스토리 저장
  const saveHistory = useCallback(() => {
    if (!canvasRef.current || !ctxRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // 현재 단계 이후의 히스토리 제거
    const newHistory = canvasHistory.slice(0, historyStep + 1);
    newHistory.push(imageData);
    
    // 최대 50개까지만 저장
    if (newHistory.length > 50) {
      newHistory.shift();
    } else {
      setHistoryStep(prev => prev + 1);
    }
    
    setCanvasHistory(newHistory);
  }, [canvasHistory, historyStep]);
  
  // Undo
  const undo = useCallback(() => {
    if (historyStep > 0) {
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      if (!canvas || !ctx) return;
      
      const newStep = historyStep - 1;
      ctx.putImageData(canvasHistory[newStep], 0, 0);
      setHistoryStep(newStep);
    }
  }, [historyStep, canvasHistory]);
  
  // Redo
  const redo = useCallback(() => {
    if (historyStep < canvasHistory.length - 1) {
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      if (!canvas || !ctx) return;
      
      const newStep = historyStep + 1;
      ctx.putImageData(canvasHistory[newStep], 0, 0);
      setHistoryStep(newStep);
    }
  }, [historyStep, canvasHistory]);
  
  // Ctrl+Z, Ctrl+Y 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
      } else if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    
    if (isImageEditorOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isImageEditorOpen, undo, redo]);
  
  // 이미지 편집 모드 전환 시 캔버스에 이미지 그리기
  useEffect(() => {
    console.log('🔄 useEffect 실행:', {
      isImageEditorOpen,
      hasEditingImage: !!editingImage,
      hasCanvas: !!canvasRef.current,
      hasCtx: !!ctxRef.current
    });
    
    if (isImageEditorOpen && editingImage && canvasRef.current) {
      const canvas = canvasRef.current;
      // willReadFrequently 속성 설정으로 getImageData 성능 향상
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        console.error('❌ 캔버스 컨텍스트를 가져올 수 없습니다');
        return;
      }
      
      ctxRef.current = ctx;
      
      // 캔버스 크기 설정
      canvas.width = editingImage.width;
      canvas.height = editingImage.height;
      
      console.log('📐 캔버스 크기 설정:', canvas.width, 'x', canvas.height);
      console.log('📐 표시 크기:', canvas.clientWidth, 'x', canvas.clientHeight);
      
      // 투명 배경 유지 (흰색 배경 그리지 않음)
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // 이미지 그리기
      ctx.drawImage(editingImage, 0, 0);
      
      // 초기 히스토리 저장
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setCanvasHistory([imageData]);
      setHistoryStep(0);
      
      console.log('✅ 캔버스 렌더링 완료:', canvas.width, 'x', canvas.height);
    }
  }, [isImageEditorOpen, editingImage]);
  
  // PIXI 및 Live2D 참조
  const containerRef = useRef<HTMLDivElement>(null);
  const pixiAppRef = useRef<PIXI.Application | null>(null);
  const live2dModelRef = useRef<Live2DModel | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const breathTimeRef = useRef<number>(0);
  const eyeBlinkTimeRef = useRef<number>(0);
  const eyeBlinkStateRef = useRef<'open' | 'closing' | 'closed' | 'opening'>('open');
  const eyeBlinkNextTimeRef = useRef<number>(0);
  
  // 공통 Live2D 파라미터 정의 (Cubism SDK 표준)
  const commonParameters = [
    // 각도
    { id: 'ParamAngleX', name: '머리 좌우', category: 'angle' },
    { id: 'ParamAngleY', name: '머리 위아래', category: 'angle' },
    { id: 'ParamAngleZ', name: '머리 회전', category: 'angle' },
    { id: 'ParamBodyAngleX', name: '몸 좌우', category: 'angle' },
    { id: 'ParamBodyAngleY', name: '몸 위아래', category: 'angle' },
    { id: 'ParamBodyAngleZ', name: '몸 회전', category: 'angle' },
    
    // 눈
    { id: 'ParamEyeLOpen', name: '왼쪽 눈 열림', category: 'eye' },
    { id: 'ParamEyeROpen', name: '오른쪽 눈 열림', category: 'eye' },
    { id: 'ParamEyeLSmile', name: '왼쪽 눈 웃음', category: 'eye' },
    { id: 'ParamEyeRSmile', name: '오른쪽 눈 웃음', category: 'eye' },
    { id: 'ParamEyeBallX', name: '눈동자 좌우', category: 'eye' },
    { id: 'ParamEyeBallY', name: '눈동자 위아래', category: 'eye' },
    { id: 'ParamEyeBallForm', name: '눈동자 형태', category: 'eye' },
    
    // 눈썹
    { id: 'ParamBrowLY', name: '왼쪽 눈썹 위아래', category: 'brow' },
    { id: 'ParamBrowRY', name: '오른쪽 눈썹 위아래', category: 'brow' },
    { id: 'ParamBrowLX', name: '왼쪽 눈썹 좌우', category: 'brow' },
    { id: 'ParamBrowRX', name: '오른쪽 눈썹 좌우', category: 'brow' },
    { id: 'ParamBrowLAngle', name: '왼쪽 눈썹 각도', category: 'brow' },
    { id: 'ParamBrowRAngle', name: '오른쪽 눈썹 각도', category: 'brow' },
    { id: 'ParamBrowLForm', name: '왼쪽 눈썹 형태', category: 'brow' },
    { id: 'ParamBrowRForm', name: '오른쪽 눈썹 형태', category: 'brow' },
    
    // 입
    { id: 'ParamMouthForm', name: '입 모양', category: 'mouth' },
    { id: 'ParamMouthOpenY', name: '입 열림', category: 'mouth' },
    
    // 기타
    { id: 'ParamCheek', name: '볼 터짐', category: 'other' },
    { id: 'ParamBreath', name: '호흡', category: 'other' },
    
    // 팔
    { id: 'ParamArmLA', name: '왼팔 A', category: 'arm' },
    { id: 'ParamArmRA', name: '오른팔 A', category: 'arm' },
    { id: 'ParamArmLB', name: '왼팔 B', category: 'arm' },
    { id: 'ParamArmRB', name: '오른팔 B', category: 'arm' },
    { id: 'ParamHandL', name: '왼손', category: 'arm' },
    { id: 'ParamHandR', name: '오른손', category: 'arm' },
    
    // 머리카락
    { id: 'ParamHairFront', name: '앞머리', category: 'hair' },
    { id: 'ParamHairSide', name: '옆머리', category: 'hair' },
    { id: 'ParamHairBack', name: '뒷머리', category: 'hair' },
    { id: 'ParamHairFluffy', name: '머리카락 흔들림', category: 'hair' },
    
    // 몸
    { id: 'ParamShoulderY', name: '어깨 위아래', category: 'body' },
    { id: 'ParamBustX', name: '가슴 좌우', category: 'body' },
    { id: 'ParamBustY', name: '가슴 위아래', category: 'body' },
    { id: 'ParamBaseX', name: '기본 X', category: 'body' },
    { id: 'ParamBaseY', name: '기본 Y', category: 'body' },
  ];
  
  // 모델 정의 로드
  const fetchModelDefinitions = async (): Promise<{ [key: string]: ModelInfo }> => {
    try {
      console.log('🔍 모델 목록 자동 스캔 중...');
      
      // 서버 API로 모든 모델 자동 감지
      const response = await fetch('/api/model-editor/scan-models');
      if (!response.ok) {
        throw new Error('모델 스캔 API 호출 실패');
      }
      
      const modelArray = await response.json();
      const modelDefinitions: { [key: string]: ModelInfo } = {};
      
      // 배열을 객체로 변환
      modelArray.forEach((model: any) => {
        modelDefinitions[model.name] = {
          name: model.name,
          description: model.description || `${model.name} Character`,
          url: model.url,
          kScale: model.kScale || 0.5,
          initialXshift: model.initialXshift || 0.15,
          initialYshift: model.initialYshift || 0,
        };
      });
      
      // 로컬 스토리지에서 커스텀 모델 불러오기 (복제된 모델들)
      try {
        const customModelsJson = localStorage.getItem('customModels');
        if (customModelsJson) {
          const customModels = JSON.parse(customModelsJson);
          customModels.forEach((model: ModelInfo) => {
            // 서버에서 스캔된 모델이 없으면 추가 (중복 방지)
            if (!modelDefinitions[model.name]) {
              modelDefinitions[model.name] = model;
            }
          });
        }
      } catch (localStorageError) {
        console.warn('⚠️ 로컬 스토리지 커스텀 모델 로드 실패:', localStorageError);
      }
      
      console.log(`✅ 총 ${Object.keys(modelDefinitions).length}개 모델 로드 완료`);
      console.log('📋 모델 목록:', Object.keys(modelDefinitions));
      
      return modelDefinitions;
      
    } catch (error) {
      console.error('❌ 모델 정의 로드 실패:', error);
      
      // 폴백: 기본 모델만 반환
      return {
        'mao': {
          name: 'mao',
          description: 'Mao Character',
          url: '/live2d-models/mao/runtime/mao_pro.model3.json',
          kScale: 0.5,
          initialXshift: 0.15,
          initialYshift: 0,
        },
        'ichika': {
          name: 'ichika',
          description: 'Ichika Character',
          url: '/live2d-models/ichika/runtime/ichika.model3.json',
          kScale: 0.5,
          initialXshift: 0.15,
          initialYshift: 0,
        }
      };
    }
  };
  
  // Live2D 모델에서 파라미터 정보 추출 (다중 API 시도)
  const extractModelParameters = useCallback((model: any) => {
    if (!model || !model.internalModel) {
      console.warn('⚠️ 모델 내부 구조에 접근할 수 없습니다');
      return;
    }
    
    try {
      const extractedParams: ParameterInfo[] = [];
      const extractedParts: PartInfo[] = [];
      
      const internalModel = model.internalModel as any;
      
      // 디버깅: 구조 확인
      console.log('🔍 InternalModel 타입:', internalModel.constructor?.name);
      console.log('🔍 InternalModel 키:', Object.keys(internalModel).slice(0, 20));
      
      // 방법 1: InternalModel.coreModel의 _parameterIds (Cubism4InternalModel)
      if (internalModel.coreModel && internalModel.coreModel._parameterIds) {
        console.log('📊 방법 1: coreModel._parameterIds 사용');
        const coreModel = internalModel.coreModel;
        const paramCount = coreModel._parameterIds.length;
        console.log(`📊 총 ${paramCount}개의 파라미터 발견`);
        
        for (let i = 0; i < paramCount; i++) {
          const paramId = coreModel._parameterIds[i];
          const paramValue = coreModel._parameterValues?.[i] ?? 0;
          const paramMin = coreModel._parameterMinimumValues?.[i] ?? -1;
          const paramMax = coreModel._parameterMaximumValues?.[i] ?? 1;
          const paramDefault = coreModel._parameterDefaultValues?.[i] ?? 0;
          
          const commonParam = commonParameters.find(p => p.id === paramId);
          const paramName = commonParam ? commonParam.name : paramId;
          
          extractedParams.push({
            id: paramId,
            name: paramName,
            value: paramValue,
            minValue: paramMin,
            maxValue: paramMax,
            defaultValue: paramDefault,
          });
        }
        
        // 파트 정보 추출
        if (coreModel._partIds) {
          const partCount = coreModel._partIds.length;
          console.log(`📦 총 ${partCount}개의 파트 발견`);
          
          for (let i = 0; i < partCount; i++) {
            const partId = coreModel._partIds[i];
            const partOpacity = coreModel._partOpacities?.[i] ?? 1;
            
            extractedParts.push({
              id: partId,
              name: partId,
              opacity: partOpacity,
            });
          }
        }
      }
      // 방법 2: InternalModel 직접 _parameterIds
      else if (internalModel._parameterIds) {
        console.log('📊 방법 2: internalModel._parameterIds 사용');
        const paramCount = internalModel._parameterIds.length;
        console.log(`📊 총 ${paramCount}개의 파라미터 발견`);
        
        for (let i = 0; i < paramCount; i++) {
          const paramId = internalModel._parameterIds[i];
          const paramValue = internalModel._parameterValues?.[i] ?? 0;
          const paramMin = internalModel._parameterMinimumValues?.[i] ?? -1;
          const paramMax = internalModel._parameterMaximumValues?.[i] ?? 1;
          const paramDefault = internalModel._parameterDefaultValues?.[i] ?? 0;
          
          const commonParam = commonParameters.find(p => p.id === paramId);
          const paramName = commonParam ? commonParam.name : paramId;
          
          extractedParams.push({
            id: paramId,
            name: paramName,
            value: paramValue,
            minValue: paramMin,
            maxValue: paramMax,
            defaultValue: paramDefault,
          });
        }
        
        // 파트 정보 추출
        if (internalModel._partIds) {
          const partCount = internalModel._partIds.length;
          console.log(`📦 총 ${partCount}개의 파트 발견`);
          
          for (let i = 0; i < partCount; i++) {
            const partId = internalModel._partIds[i];
            const partOpacity = internalModel._partOpacities?.[i] ?? 1;
            
            extractedParts.push({
              id: partId,
              name: partId,
              opacity: partOpacity,
            });
          }
        }
      }
      // 방법 3: coreModel.parameters 객체 (Live2DCubismCore.Model)
      else if (internalModel.coreModel && internalModel.coreModel.parameters) {
        console.log('📊 방법 3: coreModel.parameters 객체 사용');
        const coreModel = internalModel.coreModel;
        const params = coreModel.parameters;
        const paramCount = params.count;
        console.log(`📊 총 ${paramCount}개의 파라미터 발견`);
        
        for (let i = 0; i < paramCount; i++) {
          const paramId = params.ids[i];
          const paramValue = params.values[i];
          const paramMin = params.minimumValues[i];
          const paramMax = params.maximumValues[i];
          const paramDefault = params.defaultValues[i];
          
          const commonParam = commonParameters.find(p => p.id === paramId);
          const paramName = commonParam ? commonParam.name : paramId;
          
          extractedParams.push({
            id: paramId,
            name: paramName,
            value: paramValue,
            minValue: paramMin,
            maxValue: paramMax,
            defaultValue: paramDefault,
          });
        }
        
        // 파트 정보
        if (coreModel.parts) {
          const parts = coreModel.parts;
          const partCount = parts.count;
          console.log(`📦 총 ${partCount}개의 파트 발견`);
          
          for (let i = 0; i < partCount; i++) {
            extractedParts.push({
              id: parts.ids[i],
              name: parts.ids[i],
              opacity: parts.opacities[i],
            });
          }
        }
      }
      // 방법을 찾지 못한 경우
      else {
        console.error('❌ 파라미터 추출 방법을 찾을 수 없습니다');
        console.log('🔍 coreModel:', internalModel.coreModel);
        console.log('🔍 coreModel 키:', internalModel.coreModel ? Object.keys(internalModel.coreModel) : 'undefined');
      }
      
      if (extractedParams.length > 0) {
        setParameters(extractedParams);
        console.log('✅ 파라미터 추출 완료:', extractedParams.length);
      }
      
      if (extractedParts.length > 0) {
        setParts(extractedParts);
        console.log('✅ 파트 추출 완료:', extractedParts.length);
      }
      
    } catch (error) {
      console.error('❌ 파라미터 추출 실패:', error);
      
      // 디버그: 실제 모델 구조 확인
      const cubismModel = model.internalModel as any;
      console.log('🔍 모델 구조 상세 분석:', {
        type: cubismModel?.constructor?.name,
        keys: Object.keys(cubismModel || {}).slice(0, 20),
        coreModel: cubismModel?.coreModel,
        coreModelKeys: Object.keys(cubismModel?.coreModel || {}).slice(0, 20),
        // 가능한 파라미터 접근 경로들
        hasParameters: 'parameters' in (cubismModel?.coreModel || {}),
        hasGetParameterCount: typeof cubismModel?.coreModel?.getParameterCount === 'function',
        // Private 프로퍼티 확인
        privateKeys: Object.getOwnPropertyNames(cubismModel || {}).slice(0, 20),
        corePrivateKeys: Object.getOwnPropertyNames(cubismModel?.coreModel || {}).slice(0, 20)
      });
      
      // 프로토타입 체인 확인
      if (cubismModel?.coreModel) {
        console.log('🔍 CoreModel 프로토타입 메서드:', 
          Object.getOwnPropertyNames(Object.getPrototypeOf(cubismModel.coreModel)).slice(0, 30)
        );
      }
    }
  }, []);
  
  // 파라미터 값 변경 (다중 API 시도) - UI 슬라이더용
  const handleParameterChange = useCallback((paramId: string, value: number) => {
    if (!live2dModelRef.current) return;
    
    try {
      const model = live2dModelRef.current;
      const internalModel = model.internalModel as any;
      
      // 방법 1: internalModel.coreModel._parameterIds (추출과 동일한 경로)
      if (internalModel.coreModel && internalModel.coreModel._parameterIds) {
        const coreModel = internalModel.coreModel;
        const paramIndex = coreModel._parameterIds.indexOf(paramId);
        if (paramIndex >= 0 && coreModel._parameterValues) {
          coreModel._parameterValues[paramIndex] = value;
          
          // UI 상태 업데이트 (PIXI 렌더링 루프에서 자동 반영됨)
          setParameters(prev => 
            prev.map(p => p.id === paramId ? { ...p, value } : p)
          );
          return;
        }
      }
      
      // 방법 2: internalModel._parameterIds (직접)
      if (internalModel._parameterIds) {
        const paramIndex = internalModel._parameterIds.indexOf(paramId);
        if (paramIndex >= 0 && internalModel._parameterValues) {
          internalModel._parameterValues[paramIndex] = value;
          
          // UI 상태 업데이트 (PIXI 렌더링 루프에서 자동 반영됨)
          setParameters(prev => 
            prev.map(p => p.id === paramId ? { ...p, value } : p)
          );
          return;
        }
      }
      
      // 방법 3: coreModel.parameters 객체
      if (internalModel.coreModel && internalModel.coreModel.parameters) {
        const params = internalModel.coreModel.parameters;
        const paramIndex = params.ids.indexOf(paramId);
        if (paramIndex >= 0 && params.values) {
          params.values[paramIndex] = value;
          
          // UI 상태 업데이트 (PIXI 렌더링 루프에서 자동 반영됨)
          setParameters(prev => 
            prev.map(p => p.id === paramId ? { ...p, value } : p)
          );
          return;
        }
      }
      
      console.warn(`⚠️ 파라미터 "${paramId}"를 찾을 수 없습니다`);
      
    } catch (error) {
      console.error('❌ 파라미터 변경 실패:', paramId, error);
    }
  }, []);
  
  // 파트 불투명도 변경 (다중 API 시도)
  const handlePartOpacityChange = useCallback((partId: string, opacity: number) => {
    if (!live2dModelRef.current) return;
    
    try {
      const model = live2dModelRef.current;
      const internalModel = model.internalModel as any;
      
      // 방법 1: internalModel.coreModel._partIds (추출과 동일한 경로)
      if (internalModel.coreModel && internalModel.coreModel._partIds) {
        const coreModel = internalModel.coreModel;
        const partIndex = coreModel._partIds.indexOf(partId);
        if (partIndex >= 0 && coreModel._partOpacities) {
          coreModel._partOpacities[partIndex] = opacity;
          
          // UI 상태 업데이트 (PIXI 렌더링 루프에서 자동 반영됨)
          setParts(prev => 
            prev.map(p => p.id === partId ? { ...p, opacity } : p)
          );
          return;
        }
      }
      
      // 방법 2: internalModel._partIds (직접)
      if (internalModel._partIds) {
        const partIndex = internalModel._partIds.indexOf(partId);
        if (partIndex >= 0 && internalModel._partOpacities) {
          internalModel._partOpacities[partIndex] = opacity;
          
          // UI 상태 업데이트 (PIXI 렌더링 루프에서 자동 반영됨)
          setParts(prev => 
            prev.map(p => p.id === partId ? { ...p, opacity } : p)
          );
          return;
        }
      }
      
      // 방법 3: coreModel.parts 객체
      if (internalModel.coreModel && internalModel.coreModel.parts) {
        const parts = internalModel.coreModel.parts;
        const partIndex = parts.ids.indexOf(partId);
        if (partIndex >= 0 && parts.opacities) {
          parts.opacities[partIndex] = opacity;
          
          // UI 상태 업데이트 (PIXI 렌더링 루프에서 자동 반영됨)
          setParts(prev => 
            prev.map(p => p.id === partId ? { ...p, opacity } : p)
          );
          return;
        }
      }
      
      console.warn(`⚠️ 파트 "${partId}"를 찾을 수 없습니다`);
      
    } catch (error) {
      console.error('❌ 파트 불투명도 변경 실패:', partId, error);
    }
  }, []);
  
  // 호흡 효과 업데이트
  const updateBreath = useCallback((deltaTime: number) => {
    if (!breathSettings.enabled || !live2dModelRef.current) return;
    
    try {
      breathTimeRef.current += deltaTime;
      const t = breathTimeRef.current * 2.0 * Math.PI;
      const breathValue = breathSettings.offset + 
                         breathSettings.peak * Math.sin(t / breathSettings.cycle);
      
      // 직접 파라미터 설정 (애니메이션 루프용)
      const model = live2dModelRef.current;
      const internalModel = model.internalModel as any;
      
      // 방법 1: internalModel.coreModel._parameterIds
      if (internalModel.coreModel && internalModel.coreModel._parameterIds) {
        const coreModel = internalModel.coreModel;
        const paramIndex = coreModel._parameterIds.indexOf('ParamBreath');
        if (paramIndex >= 0 && coreModel._parameterValues) {
          coreModel._parameterValues[paramIndex] = breathValue;
        }
      }
      // 방법 2: internalModel._parameterIds
      else if (internalModel._parameterIds) {
        const paramIndex = internalModel._parameterIds.indexOf('ParamBreath');
        if (paramIndex >= 0 && internalModel._parameterValues) {
          internalModel._parameterValues[paramIndex] = breathValue;
        }
      }
      // 방법 3: coreModel.parameters
      else if (internalModel.coreModel && internalModel.coreModel.parameters) {
        const params = internalModel.coreModel.parameters;
        const paramIndex = params.ids.indexOf('ParamBreath');
        if (paramIndex >= 0 && params.values) {
          params.values[paramIndex] = breathValue;
        }
      }
    } catch (error) {
      // 조용히 실패 처리 (로그 스팸 방지)
    }
  }, [breathSettings]);
  
  // 눈 깜빡임 효과 업데이트
  const updateEyeBlink = useCallback((deltaTime: number) => {
    if (!eyeBlinkSettings.enabled || !live2dModelRef.current) return;
    
    try {
      eyeBlinkTimeRef.current += deltaTime;
      
      const state = eyeBlinkStateRef.current;
      let eyeValue = 1.0;
      
      switch (state) {
        case 'open':
          eyeValue = 1.0;
          if (eyeBlinkTimeRef.current >= eyeBlinkNextTimeRef.current) {
            eyeBlinkStateRef.current = 'closing';
            eyeBlinkTimeRef.current = 0;
          }
          break;
          
        case 'closing':
          const closingT = eyeBlinkTimeRef.current / eyeBlinkSettings.closingDuration;
          eyeValue = 1.0 - closingT;
          if (closingT >= 1.0) {
            eyeBlinkStateRef.current = 'closed';
            eyeBlinkTimeRef.current = 0;
          }
          break;
          
        case 'closed':
          eyeValue = 0.0;
          if (eyeBlinkTimeRef.current >= eyeBlinkSettings.closedDuration) {
            eyeBlinkStateRef.current = 'opening';
            eyeBlinkTimeRef.current = 0;
          }
          break;
          
        case 'opening':
          const openingT = eyeBlinkTimeRef.current / eyeBlinkSettings.openingDuration;
          eyeValue = openingT;
          if (openingT >= 1.0) {
            eyeBlinkStateRef.current = 'open';
            eyeBlinkTimeRef.current = 0;
            eyeBlinkNextTimeRef.current = eyeBlinkSettings.interval;
          }
          break;
      }
      
      // 직접 파라미터 설정 (애니메이션 루프용)
      const model = live2dModelRef.current;
      const internalModel = model.internalModel as any;
      
      // 방법 1: internalModel.coreModel._parameterIds
      if (internalModel.coreModel && internalModel.coreModel._parameterIds) {
        const coreModel = internalModel.coreModel;
        const leftEyeIndex = coreModel._parameterIds.indexOf('ParamEyeLOpen');
        const rightEyeIndex = coreModel._parameterIds.indexOf('ParamEyeROpen');
        
        if (leftEyeIndex >= 0 && coreModel._parameterValues) {
          coreModel._parameterValues[leftEyeIndex] = eyeValue;
        }
        if (rightEyeIndex >= 0 && coreModel._parameterValues) {
          coreModel._parameterValues[rightEyeIndex] = eyeValue;
        }
      }
      // 방법 2: internalModel._parameterIds
      else if (internalModel._parameterIds) {
        const leftEyeIndex = internalModel._parameterIds.indexOf('ParamEyeLOpen');
        const rightEyeIndex = internalModel._parameterIds.indexOf('ParamEyeROpen');
        
        if (leftEyeIndex >= 0 && internalModel._parameterValues) {
          internalModel._parameterValues[leftEyeIndex] = eyeValue;
        }
        if (rightEyeIndex >= 0 && internalModel._parameterValues) {
          internalModel._parameterValues[rightEyeIndex] = eyeValue;
        }
      }
      // 방법 3: coreModel.parameters
      else if (internalModel.coreModel && internalModel.coreModel.parameters) {
        const params = internalModel.coreModel.parameters;
        const leftEyeIndex = params.ids.indexOf('ParamEyeLOpen');
        const rightEyeIndex = params.ids.indexOf('ParamEyeROpen');
        
        if (leftEyeIndex >= 0 && params.values) {
          params.values[leftEyeIndex] = eyeValue;
        }
        if (rightEyeIndex >= 0 && params.values) {
          params.values[rightEyeIndex] = eyeValue;
        }
      }
    } catch (error) {
      // 조용히 실패 처리 (로그 스팸 방지)
    }
  }, [eyeBlinkSettings]);
  
  // Live2D 모델 초기화
  const initializeLive2D = useCallback(async () => {
    if (!containerRef.current) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const model = modelDefinitions[selectedModel];
      if (!model) {
        throw new Error(`모델 "${selectedModel}"을 찾을 수 없습니다`);
      }
      
      const container = containerRef.current;
      
      // 기존 애니메이션 프레임 취소
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      // 기존 Live2D 모델 정리
      if (live2dModelRef.current) {
        try {
          if (live2dModelRef.current.parent) {
            live2dModelRef.current.parent.removeChild(live2dModelRef.current);
          }
          live2dModelRef.current.destroy();
        } catch (e) {
          console.warn('⚠️ Live2D 모델 정리 중 오류:', e);
        }
        live2dModelRef.current = null;
      }
      
      // 기존 PIXI 앱 완전 정리
      if (pixiAppRef.current) {
        try {
          const app = pixiAppRef.current;
          
          // 1. Ticker 멈춤 (destroy는 스킵, app.destroy에서 처리됨)
          if (app.ticker) {
            app.ticker.stop();
          }
          
          // 2. Stage 정리
          if (app.stage) {
            app.stage.removeChildren();
          }
          
          // 3. 전체 앱 파괴 (내부적으로 renderer와 ticker도 정리됨)
          app.destroy(true, { children: true, texture: true, baseTexture: true });
          
          console.log('🧹 PIXI 앱 완전 정리 완료');
        } catch (e) {
          console.warn('⚠️ PIXI 앱 정리 중 오류 (무시됨):', e);
        }
        pixiAppRef.current = null;
      }
      
      // DOM에서 기존 캔버스 완전 제거
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      
      // WebGL 컨텍스트가 완전히 해제될 때까지 대기
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 새로운 PIXI.js Application 생성
      console.log('🎨 새 PIXI 앱 생성 중...');
      
      // 모바일/데스크톱에 따라 캔버스 크기 조정
      const isMobile = window.innerWidth < 768;
      const canvasWidth = isMobile ? Math.min(window.innerWidth - 32, 400) : 800;
      const canvasHeight = isMobile ? 600 : 1000;
      
      console.log('📱 캔버스 크기:', { isMobile, width: canvasWidth, height: canvasHeight });
      
      const app = new PIXI.Application({
        width: canvasWidth,
        height: canvasHeight,
        backgroundColor: 0xf8fafc,
        backgroundAlpha: 1,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        forceCanvas: false, // WebGL 사용
      });
      
      // 이벤트 시스템 설정
      try {
        if (app.renderer && (app.renderer as any).events) {
          (app.renderer as any).events.autoPreventDefault = false;
        }
        app.stage.eventMode = 'none';
        (app.stage as any).interactiveChildren = false;
      } catch (eventError) {
        console.warn('⚠️ 이벤트 시스템 설정 실패:', eventError);
      }
      
      // DOM에 새 캔버스 추가
      const canvas = app.view as HTMLCanvasElement;
      if (canvas) {
        canvas.style.display = 'block';
        canvas.style.touchAction = 'none';
        container.appendChild(canvas);
        pixiAppRef.current = app;
        console.log('✅ 새 캔버스 추가 완료');
      } else {
        throw new Error('PIXI 캔버스를 찾을 수 없습니다');
      }
      
      console.log('🎨 Live2D 모델 로드 시작:', model.url);
      
      // 캐시 버스팅을 위한 타임스탬프 추가
      const cacheBuster = `?t=${Date.now()}`;
      const modelUrlWithCache = model.url + cacheBuster;
      
      console.log('📦 캐시 버스팅 URL:', modelUrlWithCache);
      
      // PIXI 텍스처 캐시 클리어 (이전 텍스처 제거)
      if (PIXI.utils && PIXI.utils.clearTextureCache) {
        PIXI.utils.clearTextureCache();
        console.log('🧹 PIXI 텍스처 캐시 클리어');
      }
      
      // Live2D 모델 로드
      const live2dModel = await Live2DModel.from(modelUrlWithCache, {
        onError: (error: any) => {
          console.warn('⚠️ Live2D 모션 로딩 실패 (무시됨):', error.message || error);
        }
      });
      
      console.log('✅ Live2D 모델 로드 완료');
      
      // 인터랙션 비활성화
      try {
        (live2dModel as any).eventMode = 'none';
        (live2dModel as any).interactiveChildren = false;
        
        if ((live2dModel as any).internalModel) {
          (live2dModel as any).internalModel.eventMode = 'none';
        }
        
        if (typeof (live2dModel as any).registerInteraction === 'function') {
          (live2dModel as any).registerInteraction = () => {};
        }
        if (typeof (live2dModel as any).unregisterInteraction === 'function') {
          (live2dModel as any).unregisterInteraction = () => {};
        }
      } catch (interactionError) {
        console.warn('⚠️ 인터랙션 비활성화 실패:', interactionError);
      }
      
      // 모든 자동 애니메이션 완전 비활성화
      try {
        const internalModel = (live2dModel as any).internalModel;
        
        // 1. 모션 매니저 비활성화
        if (internalModel && internalModel.motionManager) {
          internalModel.motionManager.stopAllMotions();
          // 모션 자동 재생 완전 차단
          if (internalModel.motionManager.update) {
            internalModel.motionManager.update = () => {}; // 빈 함수로 덮어쓰기
          }
        }
        
        // 2. 표정 매니저 비활성화
        if (internalModel && internalModel.expressionManager) {
          // 표정 자동 재생 차단
          if (internalModel.expressionManager.update) {
            internalModel.expressionManager.update = () => {}; // 빈 함수로 덮어쓰기
          }
        }
        
        // 3. 자동 업데이트 함수 제거 (눈 깜빡임, 립싱크 등)
        if (internalModel && internalModel.eyeBlink) {
          internalModel.eyeBlink = null;
        }
        if (internalModel && internalModel.breath) {
          internalModel.breath = null;
        }
        
        console.log('✅ 모든 자동 애니메이션 비활성화 완료');
      } catch (animError) {
        console.warn('⚠️ 자동 애니메이션 비활성화 실패:', animError);
      }
      
      // 모델 설정 - 모델 타입에 따라 기본 스케일 자동 결정
      let baseScale;
      
      const isProjectSekaiModel = selectedModel.match(/^\d{2}[a-z]+_/); // 01ichika, 02saki 등
      const isCubismSDKModel = ['mao', 'mao_pro', 'shizuku', 'chitose', 'haru', 'Epsilon', 
                                'hijiki', 'tororo', 'hiyori_pro_ko', 'natori_pro_ko', 
                                'rice_pro_ko', 'miara_pro_en', 'haru_greeter_pro_jp'].includes(selectedModel);
      
      if (selectedModel === 'mao' || selectedModel === 'mao_pro') {
        baseScale = 0.12; // mao는 특별히 큰 모델
      } else if (selectedModel === 'ichika') {
        baseScale = 0.28; // ichika는 작은 모델
      } else if (isProjectSekaiModel) {
        // Project Sekai 모델들 (숫자로 시작)
        baseScale = 0.35; // Project Sekai 모델들은 더 큰 스케일 필요 (스튜디오는 더 큰 캔버스)
      } else if (isCubismSDKModel) {
        // Cubism SDK 모델들
        baseScale = 0.15; // Cubism SDK 모델들은 작은 스케일
      } else {
        // 기타 모델들
        baseScale = 0.25; // 기본값
      }
      
      console.log(`📏 ${selectedModel} 모델 스케일 설정:`, { baseScale, modelType: isProjectSekaiModel ? 'Project Sekai' : isCubismSDKModel ? 'Cubism SDK' : 'Other' });
      
      // 모바일에서는 스케일 조정
      const finalScale = isMobile ? baseScale * 0.8 : baseScale;
      live2dModel.scale.set(finalScale);
      live2dModel.anchor.set(0.5, 0.5);
      
      // 캔버스 크기에 맞춰 모델 위치 조정
      live2dModel.x = canvasWidth / 2;
      
      // 모델 타입과 화면 크기에 따라 Y 위치 조정
      let yPosition;
      if (isProjectSekaiModel) {
        // Project Sekai 모델은 더 크므로 중앙보다 약간 아래
        yPosition = isMobile ? canvasHeight * 0.6 : 550;
      } else if (isCubismSDKModel) {
        // Cubism SDK 모델들
        yPosition = isMobile ? canvasHeight * 0.55 : 500;
      } else {
        // 기타 모델들
        yPosition = isMobile ? canvasHeight * 0.58 : 520;
      }
      
      live2dModel.y = yPosition;
      
      console.log('📍 모델 위치:', { 
        x: live2dModel.x, 
        y: live2dModel.y, 
        scale: finalScale,
        canvasSize: { width: canvasWidth, height: canvasHeight }
      });
      
      // Stage에 모델 추가
      app.stage.addChild(live2dModel as any);
      live2dModelRef.current = live2dModel;
      
      console.log('✅ Live2D 모델 Stage에 추가 완료');
      
      // 파라미터 정보 추출
      setTimeout(() => {
        if (live2dModelRef.current) {
          extractModelParameters(live2dModelRef.current);
        }
      }, 500);
      
      // 애니메이션 루프 시작
      let lastTime = Date.now();
      const animate = () => {
        // 모델이 파괴되었으면 애니메이션 중지
        if (!live2dModelRef.current || !pixiAppRef.current) {
          return;
        }
        
        const currentTime = Date.now();
        const deltaTime = (currentTime - lastTime) / 1000;
        lastTime = currentTime;
        
        updateBreath(deltaTime);
        updateEyeBlink(deltaTime);
        
        animationFrameRef.current = requestAnimationFrame(animate);
      };
      animate();
      
      setIsLoading(false);
      
    } catch (error) {
      console.error('❌ Live2D 초기화 실패:', error);
      setError(error instanceof Error ? error.message : 'Live2D 초기화 실패');
      setIsLoading(false);
    }
  }, [selectedModel, modelDefinitions, extractModelParameters, updateBreath, updateEyeBlink]);
  
  // 커스텀 표정 저장
  const handleSaveExpression = useCallback(() => {
    if (!newExpressionName.trim()) {
      toast({
        title: '표정 이름 필요',
        description: '표정 이름을 입력해주세요.',
        variant: 'destructive',
      });
      return;
    }
    
    const currentParams: { [paramId: string]: number } = {};
    parameters.forEach(param => {
      currentParams[param.id] = param.value;
    });
    
    const newExpression: CustomExpression = {
      name: newExpressionName,
      parameters: currentParams,
    };
    
    setCustomExpressions(prev => [...prev, newExpression]);
    setNewExpressionName('');
    
    toast({
      title: '표정 저장 완료',
      description: `"${newExpressionName}" 표정이 저장되었습니다.`,
    });
  }, [newExpressionName, parameters]);
  
  // 커스텀 표정 적용
  const handleApplyExpression = useCallback((expressionName: string) => {
    const expression = customExpressions.find(e => e.name === expressionName);
    if (!expression) return;
    
    Object.entries(expression.parameters).forEach(([paramId, value]) => {
      handleParameterChange(paramId, value);
    });
    
    setCurrentExpression(expressionName);
    
    toast({
      title: '표정 적용',
      description: `"${expressionName}" 표정이 적용되었습니다.`,
    });
  }, [customExpressions, handleParameterChange]);
  
  // 전체 설정 저장
  const handleExportSettings = useCallback(() => {
    const settings = {
      modelName: selectedModel,
      parameters: parameters.reduce((acc, p) => {
        acc[p.id] = p.value;
        return acc;
      }, {} as { [key: string]: number }),
      parts: parts.reduce((acc, p) => {
        acc[p.id] = p.opacity;
        return acc;
      }, {} as { [key: string]: number }),
      breath: breathSettings,
      eyeBlink: eyeBlinkSettings,
      customExpressions: customExpressions,
      timestamp: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `live2d-studio-${selectedModel}-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: '설정 내보내기 완료',
      description: '모든 설정이 파일로 저장되었습니다.',
    });
  }, [selectedModel, parameters, parts, breathSettings, eyeBlinkSettings, customExpressions]);
  
  // 파라미터 초기화
  const handleResetParameters = useCallback(() => {
    parameters.forEach(param => {
      handleParameterChange(param.id, param.defaultValue);
    });
    
    toast({
      title: '파라미터 초기화',
      description: '모든 파라미터가 기본값으로 초기화되었습니다.',
    });
  }, [parameters, handleParameterChange]);
  
  // 파라미터 프리셋 저장
  const handleSavePreset = useCallback(() => {
    if (!presetName.trim()) {
      toast({
        title: '입력 오류',
        description: '프리셋 이름을 입력해주세요.',
        variant: 'destructive',
      });
      return;
    }
    
    // 현재 파라미터 값들을 객체로 변환
    const currentParams: {[key: string]: number} = {};
    parameters.forEach(param => {
      currentParams[param.id] = param.value;
    });
    
    const newPreset = {
      name: presetName,
      parameters: currentParams,
      timestamp: new Date().toISOString(),
    };
    
    // 로컬 스토리지에 저장
    const existingPresets = JSON.parse(localStorage.getItem('parameterPresets') || '[]');
    existingPresets.push(newPreset);
    localStorage.setItem('parameterPresets', JSON.stringify(existingPresets));
    
    setSavedPresets(existingPresets);
    setPresetName('');
    
    toast({
      title: '프리셋 저장 완료',
      description: `"${newPreset.name}" 프리셋이 저장되었습니다.`,
    });
  }, [presetName, parameters]);
  
  // 프리셋 불러오기
  const handleLoadPreset = useCallback((presetParams: {[key: string]: number}) => {
    Object.entries(presetParams).forEach(([paramId, value]) => {
      handleParameterChange(paramId, value);
    });
    
    toast({
      title: '프리셋 적용 완료',
      description: '파라미터 값이 적용되었습니다.',
    });
  }, [handleParameterChange]);
  
  // 프리셋 내보내기 (JSON 다운로드)
  const handleExportPreset = useCallback(() => {
    const currentParams: {[key: string]: number} = {};
    parameters.forEach(param => {
      currentParams[param.id] = param.value;
    });
    
    const exportData = {
      modelName: selectedModel,
      presetName: presetName || `${selectedModel}_preset_${Date.now()}`,
      timestamp: new Date().toISOString(),
      parameters: currentParams,
      parts: parts.map(p => ({ id: p.id, opacity: p.opacity })),
    };
    
    // JSON 파일로 다운로드
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportData.presetName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: '프리셋 내보내기 완료',
      description: 'JSON 파일이 다운로드되었습니다.',
    });
  }, [selectedModel, presetName, parameters, parts]);
  
  // 프리셋 가져오기 (JSON 업로드)
  const handleImportPreset = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importData = JSON.parse(e.target?.result as string);
        
        // 파라미터 적용
        if (importData.parameters) {
          handleLoadPreset(importData.parameters);
        }
        
        // 파트 불투명도 적용
        if (importData.parts) {
          importData.parts.forEach((part: {id: string, opacity: number}) => {
            handlePartOpacityChange(part.id, part.opacity);
          });
        }
        
        toast({
          title: '프리셋 가져오기 완료',
          description: `"${importData.presetName}" 프리셋이 적용되었습니다.`,
        });
      } catch (error) {
        toast({
          title: '가져오기 실패',
          description: 'JSON 파일 형식이 올바르지 않습니다.',
          variant: 'destructive',
        });
      }
    };
    reader.readAsText(file);
    
    // input 초기화 (같은 파일 재선택 가능하도록)
    event.target.value = '';
  }, [handleLoadPreset, handlePartOpacityChange]);
  
  // 프리셋 삭제
  const handleDeletePreset = useCallback((presetName: string) => {
    const existingPresets = JSON.parse(localStorage.getItem('parameterPresets') || '[]');
    const updatedPresets = existingPresets.filter((p: any) => p.name !== presetName);
    localStorage.setItem('parameterPresets', JSON.stringify(updatedPresets));
    setSavedPresets(updatedPresets);
    
    toast({
      title: '프리셋 삭제 완료',
      description: `"${presetName}" 프리셋이 삭제되었습니다.`,
    });
  }, []);
  
  // 컴포넌트 마운트 시 프리셋 로드
  useEffect(() => {
    const existingPresets = JSON.parse(localStorage.getItem('parameterPresets') || '[]');
    setSavedPresets(existingPresets);
  }, []);
  
  // 서버에서 모델 폴더 복사
  const copyModelFolder = useCallback(async (sourceModel: string, newModelName: string) => {
    try {
      const response = await fetch('/api/model-editor/copy-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceModel, newModelName }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '모델 복사 실패');
      }
      
      return data;
    } catch (error: any) {
      console.error('모델 폴더 복사 실패:', error);
      throw error;
    }
  }, []);
  
  // 현재 모델을 신규 모델로 저장 (복제)
  const handleSaveAsNewModel = useCallback(async () => {
    if (!newModelNameForSave.trim()) {
      toast({
        title: '입력 오류',
        description: '새 모델 이름을 입력해주세요.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      // 서버에서 모델 폴더 복사
      const copyResult = await copyModelFolder(selectedModel, newModelNameForSave);
      
      console.log('✅ 모델 폴더 복사 완료:', copyResult);
      
      // 현재 파라미터 상태 저장
      const currentParams: {[key: string]: number} = {};
      parameters.forEach(param => {
        currentParams[param.id] = param.value;
      });
      
      const currentParts = parts.map(p => ({ id: p.id, opacity: p.opacity }));
      
      // 기존 모델 정보 복사
      const baseModel = modelDefinitions[selectedModel];
      if (!baseModel) {
        toast({
          title: '오류',
          description: '현재 모델 정보를 찾을 수 없습니다.',
          variant: 'destructive',
        });
        return;
      }
      
      // 새 모델 URL (서버에서 반환된 URL 사용)
      const newModelUrl = copyResult.modelUrl;
    
    // 새 모델 생성 (기존 모델 기반)
    // 복제된 모델은 전체가 보이도록 작은 스케일로 설정
    const newModel: ModelInfo = {
      name: newModelNameForSave,
      description: `${baseModel.description} (복제)`,
      url: newModelUrl,
      kScale: 0.5,  // 머리부터 발까지 보이도록 작게 설정
      initialXshift: 0.35,  // 오른쪽으로 이동 (왼쪽 잘림 방지)
      initialYshift: 0,  // 세로 중앙
    };
    
    // 모델 정의에 추가
    setModelDefinitions(prev => ({
      ...prev,
      [newModelNameForSave]: newModel,
    }));
    
    // 로컬 스토리지에 저장
    const existingModels = JSON.parse(localStorage.getItem('customModels') || '[]');
    existingModels.push(newModel);
    localStorage.setItem('customModels', JSON.stringify(existingModels));
    
    // 커스텀 모델 목록에 추가
    setCustomModelNames(prev => [...prev, newModelNameForSave]);
    
    // 파라미터 프리셋도 함께 저장
    const newPreset = {
      name: `${newModelNameForSave}_initial`,
      modelName: newModelNameForSave,
      timestamp: new Date().toISOString(),
      parameters: currentParams,
      parts: currentParts,
    };
    
    const existingPresets = JSON.parse(localStorage.getItem('parameterPresets') || '[]');
    existingPresets.push(newPreset);
    localStorage.setItem('parameterPresets', JSON.stringify(existingPresets));
    
    // 전체 설정을 서버의 모델 폴더에 저장
    const exportData = {
      modelInfo: newModel,
      preset: newPreset,
      instructions: {
        ko: '이 파일을 사용하려면: 1) Live2D 모델 파일을 서버에 배치, 2) 이 JSON의 파라미터를 적용',
        en: 'To use this file: 1) Place Live2D model files on server, 2) Apply parameters from this JSON'
      }
    };
    
    // 서버에 설정 파일 저장
    const configResponse = await fetch('/api/model-editor/save-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelName: newModelNameForSave,
        config: exportData
      }),
    });
    
    if (!configResponse.ok) {
      console.warn('설정 파일 서버 저장 실패, 다운로드로 대체');
      // 실패 시 브라우저 다운로드
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${newModelNameForSave}_config.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    
    // UI 초기화
    setNewModelNameForSave('');
    setIsSavingAsNew(false);
    
      toast({
        title: '신규 모델 저장 완료',
        description: (
          <div className="space-y-1">
            <p>"{newModelNameForSave}" 모델이 생성되었습니다.</p>
            <p className="text-xs">✅ 서버에 모델 폴더 복사 완료</p>
            <p className="text-xs">✅ 설정 파일 서버에 저장 완료</p>
          </div>
        ),
      });
    } catch (error: any) {
      console.error('모델 저장 실패:', error);
      toast({
        title: '모델 저장 실패',
        description: error.message || '서버 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  }, [newModelNameForSave, selectedModel, modelDefinitions, parameters, parts, copyModelFolder]);
  
  // 현재 모델의 텍스처 이미지 불러오기
  const loadCurrentTexture = useCallback(async () => {
    if (!selectedModel || !modelDefinitions[selectedModel]) return;
    
    try {
      // 모델의 첫 번째 텍스처 경로 가져오기
      console.log('🔍 텍스처 검색 시작:', selectedModel);
      const response = await fetch(`/api/model-editor/textures/${selectedModel}`);
      const data = await response.json();
      console.log('📦 서버 응답:', data);
      
      if (!data.textures || data.textures.length === 0) {
        toast({
          title: '텍스처 없음',
          description: '현재 모델에 텍스처 파일이 없습니다.',
          variant: 'destructive',
        });
        return;
      }
      
      const firstTexture = data.textures[0];
      console.log('📸 텍스처 로드 시작:', firstTexture);
      
      // 이미지를 먼저 완전히 로드
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        img.onload = () => {
          console.log('✅ 이미지 로드 성공:', img.width, 'x', img.height);
          resolve(null);
        };
        img.onerror = (e) => {
          console.error('❌ 이미지 로드 실패:', e);
          reject(new Error('이미지 로드 실패'));
        };
        img.src = firstTexture.url + '?t=' + Date.now();
      });
      
      // 이미지 로드 성공 후 UI 전환
      setTextureList(data.textures);
      setSelectedTexture(firstTexture.url);
      setEditingImage(img);
      setIsImageEditorOpen(true);
      
      toast({
        title: '텍스처 로드 완료',
        description: `${firstTexture.name} (${img.width}x${img.height})`,
      });
      
    } catch (error: any) {
      console.error('텍스처 로드 실패:', error);
      toast({
        title: '텍스처 로드 실패',
        description: error.message,
        variant: 'destructive',
      });
    }
  }, [selectedModel, modelDefinitions]);
  
  // 텍스처 저장 (서버에 업로드)
  const saveTextureToServer = useCallback(async () => {
    if (!canvasRef.current || !selectedModel) return;
    
    try {
      const canvas = canvasRef.current;
      const imageData = canvas.toDataURL('image/png');
      
      console.log('💾 텍스처 저장 시작...');
      
      const response = await fetch('/api/model-editor/save-texture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelName: selectedModel,
          imageData,
        }),
      });
      
      const data = await response.json();
      console.log('📦 저장 응답:', data);
      
      if (!response.ok) {
        throw new Error(data.error || '텍스처 저장 실패');
      }
      
      toast({
        title: '텍스처 저장 완료',
        description: '서버에 텍스처 파일이 저장되었습니다. 모델을 새로고침합니다.',
      });
      
      // 편집 상태 유지하고 모델만 새로고침
      setTimeout(() => {
        initializeLive2D();
        toast({
          title: '모델 새로고침 완료',
          description: '변경된 텍스처가 적용되었습니다.',
        });
      }, 500);
      
    } catch (error: any) {
      console.error('텍스처 저장 실패:', error);
      toast({
        title: '텍스처 저장 실패',
        description: error.message,
        variant: 'destructive',
      });
    }
  }, [selectedModel, initializeLive2D]);
  
  // Magic Wand (자동 선택) - Flood Fill 알고리즘
  const magicWandSelect = useCallback((x: number, y: number, ctrlKey: boolean) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    
    console.log('🪄 Magic Wand 시작:', { x, y, tolerance: magicWandTolerance, ctrlKey });
    
    // Ctrl 키를 누르지 않았으면 이전 선택 초기화
    if (!ctrlKey) {
      setSelectionRects([]);
    }
    
    // 원본 이미지 데이터 복원 (히스토리에서)
    if (canvasHistory.length > 0 && historyStep >= 0) {
      ctx.putImageData(canvasHistory[historyStep], 0, 0);
    }
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    const width = canvas.width;
    const height = canvas.height;
    
    // 클릭한 픽셀의 색상
    const startIndex = (Math.floor(y) * width + Math.floor(x)) * 4;
    const startR = pixels[startIndex];
    const startG = pixels[startIndex + 1];
    const startB = pixels[startIndex + 2];
    const startA = pixels[startIndex + 3];
    
    console.log('🎨 시작 색상:', { r: startR, g: startG, b: startB, a: startA });
    
    // 투명하거나 거의 투명한 픽셀은 선택하지 않음
    if (startA < 10) {
      toast({
        title: '투명 영역은 선택할 수 없습니다',
        description: '불투명한 부품 영역을 클릭해주세요.',
        variant: 'destructive',
      });
      return;
    }
    
    // 이미 방문한 픽셀 추적
    const visited = new Uint8Array(width * height);
    const selectedPixels: Array<{x: number, y: number}> = [];
    
    // BFS를 위한 큐
    const queue: Array<{x: number, y: number}> = [{x: Math.floor(x), y: Math.floor(y)}];
    
    // 선택된 영역의 경계
    let minX = Math.floor(x);
    let maxX = Math.floor(x);
    let minY = Math.floor(y);
    let maxY = Math.floor(y);
    
    // 색상 유사도 체크 함수
    const isSimilarColor = (r: number, g: number, b: number, a: number): boolean => {
      // 투명하거나 거의 투명한 픽셀은 제외 (배경/테두리 제외)
      if (a < 30) return false;
      
      const dr = Math.abs(r - startR);
      const dg = Math.abs(g - startG);
      const db = Math.abs(b - startB);
      const da = Math.abs(a - startA);
      
      // 유클리드 거리 계산
      const distance = Math.sqrt(dr * dr + dg * dg + db * db + da * da);
      return distance <= magicWandTolerance;
    };
    
    // Flood Fill (BFS)
    while (queue.length > 0) {
      const pixel = queue.shift();
      if (!pixel) break;
      
      const px = pixel.x;
      const py = pixel.y;
      
      // 범위 체크
      if (px < 0 || px >= width || py < 0 || py >= height) continue;
      
      const index = py * width + px;
      
      // 이미 방문했으면 스킵
      if (visited[index]) continue;
      visited[index] = 1;
      
      // 픽셀 색상 가져오기
      const pixelIndex = index * 4;
      const r = pixels[pixelIndex];
      const g = pixels[pixelIndex + 1];
      const b = pixels[pixelIndex + 2];
      const a = pixels[pixelIndex + 3];
      
      // 색상이 유사하지 않으면 스킵
      if (!isSimilarColor(r, g, b, a)) continue;
      
      // 선택된 픽셀 저장
      selectedPixels.push({x: px, y: py});
      
      // 경계 업데이트
      minX = Math.min(minX, px);
      maxX = Math.max(maxX, px);
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
      
      // 인접 픽셀 추가 (상하좌우)
      queue.push({x: px + 1, y: py});
      queue.push({x: px - 1, y: py});
      queue.push({x: px, y: py + 1});
      queue.push({x: px, y: py - 1});
      
      // 성능 최적화: 큐가 너무 커지면 중단
      if (queue.length > 100000) {
        console.warn('⚠️ Magic Wand: 영역이 너무 큽니다. 중단합니다.');
        break;
      }
    }
    
    // 선택 영역 설정 (여백 추가)
    const padding = 5;
    const selectionWidth = maxX - minX + 1 + padding * 2;
    const selectionHeight = maxY - minY + 1 + padding * 2;
    
    if (selectionWidth > 5 && selectionHeight > 5 && selectedPixels.length > 0) {
      const newSelection = {
        x: Math.max(0, minX - padding),
        y: Math.max(0, minY - padding),
        width: Math.min(selectionWidth, width - (minX - padding)),
        height: Math.min(selectionHeight, height - (minY - padding)),
        pixels: selectedPixels // Magic Wand로 선택된 실제 픽셀 정보 저장
      };
      
      console.log('✅ Magic Wand 완료:', {
        x: minX - padding,
        y: minY - padding,
        width: selectionWidth,
        height: selectionHeight,
        pixelCount: selectedPixels.length,
        ctrlKey,
        totalSelections: ctrlKey ? selectionRects.length + 1 : 1
      });
      
      // Ctrl 키를 누르면 기존 선택에 추가, 아니면 새로운 선택으로 교체
      const allSelections = ctrlKey ? [...selectionRects, newSelection] : [newSelection];
      setSelectionRects(allSelections);
      
      // 모든 선택 영역을 다시 그리기
      setTimeout(() => {
        const canvas = canvasRef.current;
        const ctx = ctxRef.current;
        if (!canvas || !ctx) return;
        
        // 원본 복원
        if (canvasHistory.length > 0 && historyStep >= 0) {
          ctx.putImageData(canvasHistory[historyStep], 0, 0);
        }
        
        // 모든 선택 영역 표시
        allSelections.forEach(sel => {
          if (sel.pixels) {
            // Magic Wand로 선택된 경우: 실제 픽셀들만 빨간색 반투명으로 표시
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx) {
              const overlayData = tempCtx.createImageData(canvas.width, canvas.height);
              const overlayPixels = overlayData.data;
              
              // 선택된 픽셀을 빨간색으로 마킹
              for (const pixel of sel.pixels) {
                const idx = (pixel.y * canvas.width + pixel.x) * 4;
                overlayPixels[idx] = 255;     // R
                overlayPixels[idx + 1] = 0;   // G
                overlayPixels[idx + 2] = 0;   // B
                overlayPixels[idx + 3] = 100; // A (반투명)
              }
              
              tempCtx.putImageData(overlayData, 0, 0);
              
              // 원본 이미지 위에 오버레이 합성
              ctx.save();
              ctx.globalAlpha = 1;
              ctx.drawImage(tempCanvas, 0, 0);
              ctx.restore();
            }
          } else {
            // 수동 선택된 경우: 사각형 영역을 빨간색 반투명으로 채우기
            ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
            ctx.fillRect(sel.x, sel.y, sel.width, sel.height);
            
            // 경계선 그리기 (수동 선택만)
            ctx.setLineDash([8, 4]);
            ctx.strokeStyle = '#FF0000';
            ctx.lineWidth = 3;
            ctx.shadowColor = 'rgba(255, 0, 0, 0.5)';
            ctx.shadowBlur = 5;
            ctx.strokeRect(sel.x, sel.y, sel.width, sel.height);
            ctx.setLineDash([]);
            ctx.shadowBlur = 0;
          }
        });
      }, 0);
      
      toast({
        title: ctrlKey ? '영역 추가 선택! ✨' : '영역 자동 선택 완료! ✨',
        description: ctrlKey 
          ? `${selectedPixels.length.toLocaleString()}개 픽셀 추가 (총 ${selectionRects.length + 1}개 영역)`
          : `${selectedPixels.length.toLocaleString()}개 픽셀이 선택되었습니다.`,
      });
    } else {
      console.warn('⚠️ 선택 영역이 너무 작습니다.');
      toast({
        title: '영역을 찾을 수 없습니다',
        description: '다른 위치를 클릭하거나 허용 오차를 조정해주세요.',
        variant: 'destructive',
      });
    }
  }, [magicWandTolerance, canvasHistory, historyStep, selectionRects]);
  
  // 캔버스 그리기 시작
  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    // Magic Wand 모드: 클릭한 위치의 유사 색상 영역 자동 선택
    if (drawMode === 'magic-wand') {
      magicWandSelect(x, y, e.ctrlKey);
      return;
    }
    
    if (drawMode === 'select') {
      setIsSelecting(true);
      // Ctrl 키를 누르지 않았으면 이전 선택 초기화
      if (!e.ctrlKey) {
        setSelectionRects([]);
      }
      // 원본 이미지 데이터 복원 (이전 선택 표시 제거)
      if (canvasHistory.length > 0 && historyStep >= 0) {
        ctx.putImageData(canvasHistory[historyStep], 0, 0);
      }
    } else {
      setIsDrawing(true);
    }
    
    setStartPoint({x, y});
    
    if (drawMode === 'brush' || drawMode === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  }, [drawMode, magicWandSelect, canvasHistory, historyStep]);
  
  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing && !isSelecting) return;
    
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx || !startPoint) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    // 선택 모드: 선택 영역 미리보기 (점선 사각형)
    if (drawMode === 'select' && isSelecting) {
      // 이전 캔버스 상태 복원 후 선택 영역 그리기
      if (canvasHistory.length > historyStep + 1) {
        ctx.putImageData(canvasHistory[historyStep], 0, 0);
      }
      
      // 기존 선택 영역들 먼저 표시
      selectionRects.forEach(sel => {
        if (sel.pixels) {
          // Magic Wand로 선택된 경우: 실제 픽셀들만 표시
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = canvas.width;
          tempCanvas.height = canvas.height;
          const tempCtx = tempCanvas.getContext('2d');
          if (tempCtx) {
            const overlayData = tempCtx.createImageData(canvas.width, canvas.height);
            const overlayPixels = overlayData.data;
            
            for (const pixel of sel.pixels) {
              const idx = (pixel.y * canvas.width + pixel.x) * 4;
              overlayPixels[idx] = 255;
              overlayPixels[idx + 1] = 0;
              overlayPixels[idx + 2] = 0;
              overlayPixels[idx + 3] = 100;
            }
            
            tempCtx.putImageData(overlayData, 0, 0);
            ctx.save();
            ctx.globalAlpha = 1;
            ctx.drawImage(tempCanvas, 0, 0);
            ctx.restore();
          }
        } else {
          // 수동 선택된 경우: 사각형 반투명 채우기
          ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
          ctx.fillRect(sel.x, sel.y, sel.width, sel.height);
          
          // 경계선 그리기 (수동 선택만)
          ctx.setLineDash([8, 4]);
          ctx.strokeStyle = '#FF0000';
          ctx.lineWidth = 3;
          ctx.shadowColor = 'rgba(255, 0, 0, 0.5)';
          ctx.shadowBlur = 5;
          ctx.strokeRect(sel.x, sel.y, sel.width, sel.height);
          ctx.setLineDash([]);
          ctx.shadowBlur = 0;
        }
      });
      
      // 현재 드래그 중인 선택 영역 표시
      const width = x - startPoint.x;
      const height = y - startPoint.y;
      
      // 빨간색 점선 스타일로 선택 영역 표시
      ctx.setLineDash([8, 4]);
      ctx.strokeStyle = '#FF0000';
      ctx.lineWidth = 3;
      ctx.shadowColor = 'rgba(255, 0, 0, 0.5)';
      ctx.shadowBlur = 5;
      ctx.strokeRect(startPoint.x, startPoint.y, width, height);
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
      return;
    }
    
    if (drawMode === 'brush') {
      ctx.lineTo(x, y);
      ctx.strokeStyle = canvasBrushColor;
      ctx.lineWidth = canvasBrushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    } else if (drawMode === 'eraser') {
      ctx.lineTo(x, y);
      ctx.strokeStyle = 'white';
      ctx.lineWidth = canvasBrushSize * 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    // 도형 그리기는 마우스 버튼을 떼었을 때 완성
  }, [isDrawing, isSelecting, canvasBrushColor, canvasBrushSize, drawMode, startPoint, canvasHistory, historyStep, selectionRects]);
  
  const stopDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing && !isSelecting) return;
    
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx || !startPoint) {
      setIsDrawing(false);
      setIsSelecting(false);
      return;
    }
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    // 선택 모드: 선택 영역 저장
    if (drawMode === 'select' && isSelecting) {
      const width = x - startPoint.x;
      const height = y - startPoint.y;
      
      // 너비나 높이가 너무 작으면 무시
      if (Math.abs(width) > 10 && Math.abs(height) > 10) {
        // 음수 너비/높이 처리 (역방향 드래그)
        const selX = width < 0 ? x : startPoint.x;
        const selY = height < 0 ? y : startPoint.y;
        const selWidth = Math.abs(width);
        const selHeight = Math.abs(height);
        
        const newSelection = {
          x: selX,
          y: selY,
          width: selWidth,
          height: selHeight
        };
        
        // Ctrl 키를 누르면 기존 선택에 추가, 아니면 새로운 선택으로 교체
        const ctrlKey = e.ctrlKey;
        setSelectionRects(prev => ctrlKey ? [...prev, newSelection] : [newSelection]);
        
        console.log('🎯 영역 선택 완료:', { x: selX, y: selY, width: selWidth, height: selHeight, ctrlKey });
        
        // 선택 영역 재그리기 (히스토리 복원 후) - 빨간색
        if (canvasHistory.length > historyStep + 1) {
          ctx.putImageData(canvasHistory[historyStep], 0, 0);
        }
        
        // 모든 선택 영역 표시
        const allSelections = ctrlKey ? [...selectionRects, newSelection] : [newSelection];
        allSelections.forEach(sel => {
          // 선택 영역 내부를 빨간색 반투명으로 채우기
          ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
          ctx.fillRect(sel.x, sel.y, sel.width, sel.height);
          
          // 경계선 그리기 (빨간색 점선)
          ctx.setLineDash([8, 4]);
          ctx.strokeStyle = '#FF0000';
          ctx.lineWidth = 3;
          ctx.shadowColor = 'rgba(255, 0, 0, 0.5)';
          ctx.shadowBlur = 5;
          ctx.strokeRect(sel.x, sel.y, sel.width, sel.height);
          ctx.setLineDash([]);
          ctx.shadowBlur = 0;
        });
        
        toast({
          title: ctrlKey ? '영역 추가 선택! ✨' : '영역 선택 완료! ✨',
          description: ctrlKey 
            ? `${Math.round(selWidth)} × ${Math.round(selHeight)} 영역 추가 (총 ${allSelections.length}개 영역)`
            : `${Math.round(selWidth)} × ${Math.round(selHeight)} 영역이 선택되었습니다.`,
        });
      }
      
      setIsSelecting(false);
      setStartPoint(null);
      return;
    }
    
    setIsDrawing(false);
    setStartPoint(null);
    saveHistory();
  }, [isDrawing, isSelecting, canvasBrushColor, canvasBrushSize, drawMode, startPoint, saveHistory, canvasHistory, historyStep]);
  
  // AI 이미지 생성
  const handleAiTransform = useCallback(async () => {
    if (!aiPrompt.trim()) {
      toast({
        title: '프롬프트 필요',
        description: 'AI가 생성할 캐릭터에 대한 설명을 입력해주세요.',
        variant: 'destructive',
      });
      return;
    }
    
    // 이미 처리 중이면 무시 (중복 요청 방지)
    if (isAiProcessing) {
      console.log('⏳ 이미 처리 중입니다...');
      return;
    }
    
    setIsAiProcessing(true);
    
    try {
      console.log('🤖 AI 이미지 생성 시작...');
      console.log('📝 프롬프트:', aiPrompt);
      console.log('🎨 스타일:', aiStyle);
      
      // 타임아웃 설정 (60초)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      
      const response = await fetch('/api/model-editor/ai-transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt,
          style: aiStyle,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      console.log('📦 응답 상태:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ 서버 응답 오류:', errorText);
        throw new Error(errorText || '서버 응답 오류');
      }
      
      const data = await response.json();
      console.log('✅ 응답 데이터 수신:', data);
      
      if (!data.success || !data.imageUrl) {
        throw new Error('이미지 URL을 받지 못했습니다');
      }
      
      console.log('📝 수정된 프롬프트:', data.revisedPrompt);
      console.log('🖼️ 이미지 URL:', data.imageUrl);
      
      // AI가 생성한 이미지를 캔버스에 로드
      console.log('🎨 이미지 로드 시작...');
      const img = new Image();
      // Base64 데이터 URL을 사용하므로 crossOrigin 불필요
      // img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        console.log('✅ 이미지 로드 완료:', img.width, 'x', img.height);
        
        const canvas = canvasRef.current;
        const ctx = ctxRef.current;
        if (!canvas || !ctx) {
          console.error('❌ 캔버스를 찾을 수 없습니다');
          setIsAiProcessing(false);
          return;
        }
        
        // 캔버스에 이미지 그리기
        canvas.width = img.width;
        canvas.height = img.height;
        // 투명 배경 유지
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        
        console.log('✅ 캔버스에 이미지 렌더링 완료');
        
        // 상태 업데이트
        setEditingImage(img);
        setIsImageEditorOpen(true); // 자동으로 편집 모드 활성화
        
        // 히스토리 초기화
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setCanvasHistory([imageData]);
        setHistoryStep(0);
        
        setIsAiProcessing(false);
        
        toast({
          title: 'AI 이미지 생성 완료! ✨',
          description: '이미지가 텍스처 편집기에 로드되었습니다. 편집 후 저장하세요.',
        });
        
        console.log('🎉 전체 프로세스 완료');
      };
      
      img.onerror = (e) => {
        console.error('❌ 이미지 로드 실패:', e);
        toast({
          title: '이미지 로드 실패',
          description: '생성된 이미지를 불러올 수 없습니다. URL을 확인해주세요.',
          variant: 'destructive',
        });
        setIsAiProcessing(false);
      };
      
      console.log('📥 이미지 다운로드 시작...');
      img.src = data.imageUrl;
      
    } catch (error: any) {
      console.error('❌ AI 이미지 생성 실패:', error);
      
      let errorMessage = 'AI 서비스 오류가 발생했습니다.';
      
      if (error.name === 'AbortError') {
        errorMessage = '요청 시간이 초과되었습니다. 다시 시도해주세요.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: 'AI 이미지 생성 실패',
        description: errorMessage,
        variant: 'destructive',
      });
      setIsAiProcessing(false);
    }
  }, [aiPrompt, aiStyle, isAiProcessing]);
  
  // 선택 영역 AI 변환 (DALL-E 2 Inpainting)
  const handleRegionAiTransform = useCallback(async () => {
    if (selectionRects.length === 0) {
      toast({
        title: '영역 선택 필요',
        description: '먼저 변환할 영역을 선택해주세요.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!regionAiPrompt.trim()) {
      toast({
        title: '프롬프트 필요',
        description: 'AI가 생성할 부품에 대한 설명을 입력해주세요.',
        variant: 'destructive',
      });
      return;
    }
    
    if (isAiProcessing) {
      console.log('⏳ 이미 처리 중입니다...');
      return;
    }
    
    setIsAiProcessing(true);
    
    try {
      console.log('🎨 선택 영역 AI 변환 시작 (DALL-E 2 Inpainting)...');
      console.log('🎯 선택 영역 개수:', selectionRects.length);
      console.log('🎯 선택 영역들:', selectionRects);
      
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      if (!canvas || !ctx) {
        throw new Error('캔버스를 찾을 수 없습니다');
      }
      
      // 1. 전체 이미지를 정사각형으로 리사이즈 (DALL-E 2 요구사항)
      const maxSize = Math.max(canvas.width, canvas.height);
      const squareCanvas = document.createElement('canvas');
      squareCanvas.width = 1024;
      squareCanvas.height = 1024;
      const squareCtx = squareCanvas.getContext('2d');
      if (!squareCtx) {
        throw new Error('정사각형 캔버스 컨텍스트 생성 실패');
      }
      
      // 흰색 배경
      squareCtx.fillStyle = 'white';
      squareCtx.fillRect(0, 0, 1024, 1024);
      
      // 원본 이미지를 중앙에 배치하며 비율 유지
      const scale = 1024 / maxSize;
      const scaledWidth = canvas.width * scale;
      const scaledHeight = canvas.height * scale;
      const offsetX = (1024 - scaledWidth) / 2;
      const offsetY = (1024 - scaledHeight) / 2;
      
      squareCtx.drawImage(canvas, offsetX, offsetY, scaledWidth, scaledHeight);
      const fullImageData = squareCanvas.toDataURL('image/png');
      
      console.log('📦 전체 이미지 준비 완료 (1024x1024)');
      
      // 2. 마스크 이미지 생성 (선택 영역만 투명, 나머지 불투명)
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = 1024;
      maskCanvas.height = 1024;
      const maskCtx = maskCanvas.getContext('2d');
      if (!maskCtx) {
        throw new Error('마스크 캔버스 컨텍스트 생성 실패');
      }
      
      // 전체를 불투명 검은색으로 채움
      maskCtx.fillStyle = 'rgba(0, 0, 0, 1)';
      maskCtx.fillRect(0, 0, 1024, 1024);
      
      // 선택 영역만 투명하게 (DALL-E 2는 투명 영역을 편집함)
      maskCtx.globalCompositeOperation = 'destination-out';
      maskCtx.fillStyle = 'rgba(0, 0, 0, 1)';
      
      // 모든 선택 영역을 마스크에 추가
      selectionRects.forEach((rect, idx) => {
        if (rect.pixels) {
          // Magic Wand로 선택된 경우: 실제 픽셀들만 투명하게
          rect.pixels.forEach(pixel => {
            const maskX = Math.floor(offsetX + (pixel.x * scale));
            const maskY = Math.floor(offsetY + (pixel.y * scale));
            // 스케일에 따라 픽셀 크기도 조정 (확대 시 픽셀도 크게)
            const pixelSize = Math.max(1, Math.ceil(scale));
            maskCtx.fillRect(maskX, maskY, pixelSize, pixelSize);
          });
          console.log(`📍 마스크 영역 ${idx + 1} (픽셀):`, rect.pixels.length, '개 픽셀');
        } else {
          // 수동 선택된 경우: 사각형 영역 전체를 투명하게
          const maskX = offsetX + (rect.x * scale);
          const maskY = offsetY + (rect.y * scale);
          const maskWidth = rect.width * scale;
          const maskHeight = rect.height * scale;
          
          maskCtx.fillRect(maskX, maskY, maskWidth, maskHeight);
          console.log(`📍 마스크 영역 ${idx + 1} (사각형):`, { x: maskX, y: maskY, width: maskWidth, height: maskHeight });
        }
      });
      
      const maskImageData = maskCanvas.toDataURL('image/png');
      
      console.log('🎭 마스크 이미지 생성 완료 (총', selectionRects.length, '개 영역)');
      
      // 서버로 전송
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      
      const response = await fetch('/api/model-editor/ai-transform-region', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullImageData: fullImageData,
          maskImageData: maskImageData,
          prompt: regionAiPrompt,
          style: aiStyle,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || '서버 응답 오류');
      }
      
      const data = await response.json();
      
      if (!data.success || !data.imageUrl) {
        throw new Error('이미지 URL을 받지 못했습니다');
      }
      
      console.log('✅ AI 변환 완료, 결과 이미지 적용 중...');
      
      // 변환된 전체 이미지를 캔버스에 적용
      const img = new Image();
      img.onload = () => {
        // 정사각형 이미지에서 원본 영역만 추출하여 적용
        // 투명 배경 유지
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 스케일 조정된 이미지를 원래 크기로 복원
        ctx.drawImage(
          img,
          offsetX, offsetY, scaledWidth, scaledHeight,
          0, 0, canvas.width, canvas.height
        );
        
        console.log('✅ 이미지 적용 완료');
        
        // 선택 영역 초기화
        setSelectionRects([]);
        
        // 히스토리 저장
        saveHistory();
        
        setIsAiProcessing(false);
        
        toast({
          title: '부품 AI 변환 완료! ✨',
          description: '기존 형태를 유지하면서 변환되었습니다. 저장하여 모델에 반영하세요.',
        });
      };
      
      img.onerror = () => {
        toast({
          title: '이미지 로드 실패',
          description: '생성된 이미지를 불러올 수 없습니다.',
          variant: 'destructive',
        });
        setIsAiProcessing(false);
      };
      
      img.src = data.imageUrl;
      
    } catch (error: any) {
      console.error('❌ 선택 영역 AI 변환 실패:', error);
      
      let errorMessage = '알 수 없는 오류가 발생했습니다.';
      if (error.name === 'AbortError') {
        errorMessage = '요청 시간 초과. OpenAI 서버가 응답하지 않습니다.';
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = '네트워크 오류. 서버 연결을 확인해주세요.';
      } else {
        errorMessage = error.message;
      }
      
      toast({
        title: '선택 영역 AI 변환 실패',
        description: errorMessage,
        variant: 'destructive',
      });
      
      setIsAiProcessing(false);
    }
  }, [selectionRects, regionAiPrompt, aiStyle, isAiProcessing, saveHistory]);
  
  // 선택 영역 색 칠하기
  const handleFillSelection = useCallback(() => {
    if (selectionRects.length === 0) {
      toast({
        title: '영역 선택 필요',
        description: '먼저 칠할 영역을 선택해주세요.',
        variant: 'destructive',
      });
      return;
    }
    
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) {
      toast({
        title: '캔버스 오류',
        description: '캔버스를 찾을 수 없습니다.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      console.log('🎨 선택 영역 색 칠하기 시작:', fillColor);
      
      // RGB 값 추출 (hex to rgb)
      const hex = fillColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      
      console.log('🎨 RGB:', { r, g, b });
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;
      
      let totalFilledPixels = 0;
      
      // 모든 선택 영역에 색 칠하기
      selectionRects.forEach((rect, idx) => {
        if (rect.pixels) {
          // Magic Wand로 선택된 경우: 실제 픽셀들만 칠하기
          rect.pixels.forEach(pixel => {
            const index = (pixel.y * canvas.width + pixel.x) * 4;
            // 알파값은 유지하면서 RGB만 변경
            // 충분히 불투명한 픽셀만 칠하기 (alpha > 100, 약 40% 이상)
            const alpha = pixels[index + 3];
            if (alpha > 100) {
              pixels[index] = r;
              pixels[index + 1] = g;
              pixels[index + 2] = b;
              // pixels[index + 3]은 원본 알파값 유지
              totalFilledPixels++;
            }
          });
          console.log(`✅ 영역 ${idx + 1} (픽셀): ${rect.pixels.length}개 픽셀 중 ${totalFilledPixels}개 칠함`);
        } else {
          // 수동 선택된 경우: 사각형 영역 전체 칠하기
          for (let y = Math.floor(rect.y); y < Math.floor(rect.y + rect.height); y++) {
            for (let x = Math.floor(rect.x); x < Math.floor(rect.x + rect.width); x++) {
              if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
                const index = (y * canvas.width + x) * 4;
                const alpha = pixels[index + 3];
                // 충분히 불투명한 픽셀만 칠하기 (alpha > 100)
                if (alpha > 100) {
                  pixels[index] = r;
                  pixels[index + 1] = g;
                  pixels[index + 2] = b;
                  totalFilledPixels++;
                }
              }
            }
          }
          console.log(`✅ 영역 ${idx + 1} (사각형): ${Math.floor(rect.width * rect.height)}개 픽셀 중 ${totalFilledPixels}개 칠함`);
        }
      });
      
      // 변경된 이미지 데이터 적용
      ctx.putImageData(imageData, 0, 0);
      
      // 히스토리 저장
      saveHistory();
      
      // 선택 영역 초기화
      setSelectionRects([]);
      
      console.log('✅ 색 칠하기 완료:', totalFilledPixels, '개 픽셀');
      
      toast({
        title: '색 칠하기 완료! 🎨',
        description: `${totalFilledPixels.toLocaleString()}개 픽셀이 ${fillColor}로 칠해졌습니다.`,
      });
    } catch (error: any) {
      console.error('❌ 색 칠하기 실패:', error);
      toast({
        title: '색 칠하기 실패',
        description: error.message,
        variant: 'destructive',
      });
    }
  }, [selectionRects, fillColor, saveHistory]);
  
  // 모델 삭제
  const handleDeleteModel = useCallback(async (modelName: string) => {
    // 기본 모델(서버 스캔된 모델)은 삭제 불가 - 커스텀 모델만 삭제 가능
    if (!customModelNames.includes(modelName)) {
      toast({
        title: '삭제 불가',
        description: '기본 모델은 삭제할 수 없습니다. 복제한 모델만 삭제 가능합니다.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      // 서버에 폴더 삭제 요청
      const response = await fetch(`/api/model-editor/delete-model/${modelName}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '모델 삭제 실패');
      }
      
      // 현재 선택된 모델이면 다른 모델로 변경
      if (selectedModel === modelName) {
        setSelectedModel('mao');
      }
      
      // 모델 정의에서 제거
      setModelDefinitions(prev => {
        const newDefs = { ...prev };
        delete newDefs[modelName];
        return newDefs;
      });
      
      // 로컬 스토리지에서 제거
      const existingModels = JSON.parse(localStorage.getItem('customModels') || '[]');
      const updatedModels = existingModels.filter((m: ModelInfo) => m.name !== modelName);
      localStorage.setItem('customModels', JSON.stringify(updatedModels));
      
      // 커스텀 모델 목록에서 제거
      setCustomModelNames(prev => prev.filter(name => name !== modelName));
      
      toast({
        title: '모델 삭제 완료',
        description: `"${modelName}" 모델 폴더가 완전히 삭제되었습니다.`,
      });
    } catch (error: any) {
      console.error('❌ 모델 삭제 실패:', error);
      toast({
        title: '모델 삭제 실패',
        description: error.message,
        variant: 'destructive',
      });
    }
  }, [selectedModel, customModelNames]);
  
  // 모델 정의 로드 (기본 + 커스텀)
  useEffect(() => {
    const loadDefinitions = async () => {
      try {
        // 기본 모델 로드 (서버에서 스캔된 모델들)
        const definitions = await fetchModelDefinitions();
        
        // 커스텀 모델 로드 (로컬 스토리지 - 사용자가 복제한 모델들)
        const customModels = JSON.parse(localStorage.getItem('customModels') || '[]');
        const customNames: string[] = [];
        
        customModels.forEach((model: ModelInfo) => {
          definitions[model.name] = model;
          customNames.push(model.name);
        });
        
        setModelDefinitions(definitions);
        setCustomModelNames(customNames); // 커스텀 모델 이름 목록 저장
        
        // 첫 번째 모델을 기본으로 선택 (선택된 모델이 없을 때만)
        const modelNames = Object.keys(definitions);
        if (modelNames.length > 0 && !selectedModel) {
          const defaultModel = modelNames[0];
          setSelectedModel(defaultModel);
          console.log('✅ 기본 모델 선택:', defaultModel);
        }
        
        console.log('📋 로드된 모델:', {
          전체: Object.keys(definitions).length,
          기본모델: Object.keys(definitions).length - customNames.length,
          커스텀모델: customNames.length
        });
      } catch (error) {
        console.error('모델 정의 로드 실패:', error);
        setError('모델 정의를 로드할 수 없습니다.');
      }
    };
    loadDefinitions();
  }, []);
  
  // 모델 초기화
  useEffect(() => {
    if (Object.keys(modelDefinitions).length === 0) return;
    if (!modelDefinitions[selectedModel]) return;
    
    const initTimeout = setTimeout(() => {
      initializeLive2D();
    }, 300);
    
    return () => {
      clearTimeout(initTimeout);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [selectedModel, modelDefinitions, initializeLive2D]);
  
  return (
    <div className="min-h-screen bg-white dark:bg-[#030303] transition-colors">
      {/* 헤더 */}
      <div className="bg-gray-100 dark:bg-[#0B0B0B] backdrop-blur-md shadow-xl border-b border-gray-200 dark:border-[#1A1A1B] sticky top-0 z-50 transition-colors">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation('/')}
                className="text-gray-700 dark:text-purple-200 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-purple-700/30"
              >
                <i className="fas fa-arrow-left mr-2"></i>
                돌아가기
              </Button>
              <Separator orientation="vertical" className="h-6 bg-gray-300 dark:bg-purple-500/30 hidden md:block" />
              <div>
                <h1 className="text-lg md:text-2xl font-bold text-purple-600 dark:text-purple-400">
                  <i className="fas fa-flask mr-2"></i>
                  아바타 스튜디오
                </h1>
                <p className="text-xs md:text-sm text-gray-600 dark:text-purple-300 hidden sm:block">Cubism SDK 기반 고급 파라미터 제어</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-1">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleResetParameters}
                className="border-gray-300 dark:border-purple-500/50 text-gray-700 dark:text-purple-200 hover:bg-gray-200 dark:hover:bg-purple-700/30"
              >
                <i className="fas fa-undo mr-2"></i>
                초기화
              </Button>
              <Button 
                size="sm" 
                onClick={handleExportSettings}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                <i className="fas fa-download mr-2"></i>
                내보내기
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* 메인 콘텐츠 */}
      <div className="container mx-auto px-2 md:px-4 py-4 md:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          
          {/* 좌측: 미리보기 영역 */}
          <div className="lg:col-span-2">
            <Card className="h-full shadow-2xl border-2 border-gray-200 dark:border-purple-500/30 bg-white dark:bg-[#0B0B0B] backdrop-blur-sm transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-gray-900 dark:text-purple-100">
                  <span className="flex items-center">
                    <i className="fas fa-tv mr-2 text-purple-600 dark:text-purple-400"></i>
                    실시간 미리보기
                  </span>
                  {!isLoading && !error && (
                    <Badge className="bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-300 dark:border-green-500/50">
                      <span className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full mr-2 animate-pulse"></span>
                      Live
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-purple-300">
                  Cubism SDK로 실시간 파라미터 제어
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                    {/* Live2D 캔버스 */}
                    <div 
                      ref={containerRef}
                      className="w-full bg-gray-100 dark:bg-purple-900/20 rounded-lg overflow-hidden shadow-inner border-2 border-gray-200 dark:border-purple-500/20 transition-colors"
                      style={{ height: window.innerWidth < 768 ? '600px' : '800px' }}
                    />
                  
                  {/* 로딩 표시 */}
                  {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/95 dark:bg-black/80 rounded-lg transition-colors">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 dark:border-purple-500 mx-auto mb-4"></div>
                        <p className="text-gray-900 dark:text-purple-200 font-medium text-lg">모델 로딩 중...</p>
                        <p className="text-sm text-gray-600 dark:text-purple-400 mt-2">Cubism SDK 초기화</p>
                      </div>
                    </div>
                  )}
                  
                  {/* 에러 표시 */}
                  {error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-red-100 dark:bg-red-950/90 rounded-lg transition-colors">
                      <div className="text-center p-6">
                        <div className="text-red-600 dark:text-red-400 mb-4">
                          <i className="fas fa-exclamation-triangle text-5xl"></i>
                        </div>
                        <p className="text-red-700 dark:text-red-200 font-semibold text-lg">로드 실패</p>
                        <p className="text-sm text-red-600 dark:text-red-300 mt-2">{error}</p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* 모델 정보 */}
                {!isLoading && !error && (
                  <div className="mt-4 p-4 bg-gray-100 dark:bg-purple-900/30 rounded-lg border border-gray-200 dark:border-purple-500/30 transition-colors">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600 dark:text-purple-400 mb-1">모델 이름</p>
                        <p className="text-gray-900 dark:text-purple-100 font-semibold">{selectedModel}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-purple-400 mb-1">파라미터 수</p>
                        <p className="text-gray-900 dark:text-purple-100 font-semibold">{parameters.length}개</p>
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-purple-400 mb-1">파트 수</p>
                        <p className="text-gray-900 dark:text-purple-100 font-semibold">{parts.length}개</p>
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-purple-400 mb-1">표정 수</p>
                        <p className="text-gray-900 dark:text-purple-100 font-semibold">{customExpressions.length}개</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* 우측: 컨트롤 패널 */}
          <div className="lg:col-span-2">
            <Card className="shadow-2xl border-2 border-gray-200 dark:border-purple-500/30 bg-white dark:bg-[#0B0B0B] backdrop-blur-sm transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center text-gray-900 dark:text-purple-100">
                  <i className="fas fa-sliders-h mr-2 text-pink-600 dark:text-pink-400"></i>
                  고급 파라미터 제어
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-purple-300">
                  Cubism SDK를 사용한 세밀한 제어
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] md:h-[800px] pr-4">
                  <Tabs defaultValue="model" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 md:grid-cols-8 mb-4 bg-gray-100 dark:bg-purple-900/30 transition-colors">
                      <TabsTrigger value="model" className="text-xs md:text-sm">모델</TabsTrigger>
                      <TabsTrigger value="parameters" className="text-xs md:text-sm">파라미터</TabsTrigger>
                      <TabsTrigger value="parts" className="text-xs md:text-sm">파트</TabsTrigger>
                      <TabsTrigger value="effects" className="text-xs md:text-sm">효과</TabsTrigger>
                      <TabsTrigger value="expressions" className="text-xs md:text-sm">표정</TabsTrigger>
                      <TabsTrigger value="presets" className="text-xs md:text-sm">프리셋</TabsTrigger>
                      <TabsTrigger value="texture" className="text-xs md:text-sm">텍스처</TabsTrigger>
                      <TabsTrigger value="editor" className="text-xs md:text-sm">편집</TabsTrigger>
                    </TabsList>
                    
                    {/* 모델 선택 탭 */}
                    <TabsContent value="model" className="space-y-4">
                      <div>
                        <Label htmlFor="model-select" className="text-base font-semibold mb-3 block text-gray-900 dark:text-purple-200">
                          모델 선택
                        </Label>
                        <Select value={selectedModel} onValueChange={setSelectedModel}>
                          <SelectTrigger id="model-select" className="bg-gray-100 dark:bg-purple-900/30 border-gray-300 dark:border-purple-500/30 text-gray-900 dark:text-purple-100">
                            <SelectValue placeholder="모델을 선택하세요" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.values(modelDefinitions).map((model) => (
                              <SelectItem key={model.name} value={model.name}>
                                {model.name} - {model.description}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <Separator className="bg-gray-200 dark:bg-purple-500/30" />
                      
                      {/* 모델 관리 섹션 */}
                      <div className="p-4 bg-red-50 dark:bg-red-900/40 rounded-lg border border-red-200 dark:border-red-500/30 transition-colors">
                        <h4 className="font-semibold text-red-700 dark:text-red-200 mb-3 flex items-center">
                          <i className="fas fa-cog mr-2 text-red-600 dark:text-red-400"></i>
                          모델 관리
                        </h4>
                        
                        <div className="space-y-2">
                          {Object.values(modelDefinitions).map((model) => {
                            // 커스텀 모델(복제한 모델)이 아니면 모두 기본 모델
                            const isDefault = !customModelNames.includes(model.name);
                            return (
                              <div 
                                key={model.name}
                                className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-500/20 transition-colors"
                              >
                                <div>
                                  <p className="text-red-100 font-medium">{model.name}</p>
                                  <p className="text-xs text-red-300">{model.description}</p>
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                  {isDefault && (
                                    <Badge variant="outline" className="border-yellow-500/50 text-yellow-300 text-xs">
                                      기본
                                    </Badge>
                                  )}
                                  {!isDefault && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDeleteModel(model.name)}
                                      className="text-red-400 hover:text-red-100 hover:bg-red-700/30"
                                    >
                                      <i className="fas fa-trash"></i>
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      
                      <Separator className="bg-purple-500/30" />
                      
                      <div className="p-4 bg-gradient-to-br from-purple-900/40 to-pink-900/40 rounded-lg border border-purple-500/30">
                        <h4 className="font-semibold text-purple-200 mb-3 flex items-center">
                          <i className="fas fa-info-circle mr-2 text-pink-400"></i>
                          스튜디오 기능
                        </h4>
                        <ul className="space-y-2 text-sm text-purple-300">
                          <li className="flex items-start">
                            <i className="fas fa-check-circle text-green-400 mr-2 mt-0.5"></i>
                            <span><strong className="text-purple-100">파라미터 제어:</strong> 각 파라미터를 개별적으로 조정</span>
                          </li>
                          <li className="flex items-start">
                            <i className="fas fa-check-circle text-green-400 mr-2 mt-0.5"></i>
                            <span><strong className="text-purple-100">파트 제어:</strong> 파트별 불투명도 조정</span>
                          </li>
                          <li className="flex items-start">
                            <i className="fas fa-check-circle text-green-400 mr-2 mt-0.5"></i>
                            <span><strong className="text-purple-100">효과:</strong> 호흡, 눈 깜빡임 등 자동 효과</span>
                          </li>
                          <li className="flex items-start">
                            <i className="fas fa-check-circle text-green-400 mr-2 mt-0.5"></i>
                            <span><strong className="text-purple-100">표정 저장:</strong> 커스텀 표정 생성 및 관리</span>
                          </li>
                          <li className="flex items-start">
                            <i className="fas fa-check-circle text-green-400 mr-2 mt-0.5"></i>
                            <span><strong className="text-purple-100">모델 추가:</strong> 커스텀 Live2D 모델 업로드</span>
                          </li>
                        </ul>
                      </div>
                    </TabsContent>
                    
                    {/* 파라미터 제어 탭 */}
                    <TabsContent value="parameters" className="space-y-4">
                      {parameters.length === 0 ? (
                        <div className="text-center py-8 text-purple-400">
                          <i className="fas fa-box-open text-4xl mb-3"></i>
                          <p>모델을 로드하면 파라미터가 표시됩니다</p>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between mb-4">
                            <Label className="text-purple-200">파라미터 목록</Label>
                            <Badge className="bg-purple-600">{parameters.length}개</Badge>
                          </div>
                          
                          {/* 카테고리별 파라미터 그룹 */}
                          {['angle', 'eye', 'brow', 'mouth', 'other', 'arm', 'hair', 'body'].map(category => {
                            const categoryParams = parameters.filter(p => {
                              const commonParam = commonParameters.find(cp => cp.id === p.id);
                              return commonParam?.category === category;
                            });
                            
                            if (categoryParams.length === 0) return null;
                            
                            const categoryNames: { [key: string]: string } = {
                              angle: '각도',
                              eye: '눈',
                              brow: '눈썹',
                              mouth: '입',
                              other: '기타',
                              arm: '팔',
                              hair: '머리카락',
                              body: '몸',
                            };
                            
                            const categoryIcons: { [key: string]: string } = {
                              angle: 'fa-arrows-rotate',
                              eye: 'fa-eye',
                              brow: 'fa-face-smile',
                              mouth: 'fa-comment',
                              other: 'fa-circle-dot',
                              arm: 'fa-hand',
                              hair: 'fa-brush',
                              body: 'fa-person',
                            };
                            
                            return (
                              <div key={category} className="mb-6">
                                <div className="flex items-center mb-3">
                                  <i className={`fas ${categoryIcons[category]} text-purple-400 mr-2`}></i>
                                  <h4 className="font-semibold text-purple-200">{categoryNames[category]}</h4>
                                  <Badge variant="outline" className="ml-2 text-xs border-purple-500/30 text-purple-300">
                                    {categoryParams.length}개
                                  </Badge>
                                </div>
                                
                                <div className="space-y-3 pl-4">
                                  {categoryParams.map(param => (
                                    <div key={param.id} className="p-3 bg-purple-900/20 rounded border border-purple-500/20">
                                      <div className="flex items-center justify-between mb-2">
                                        <Label className="text-sm text-purple-200">{param.name}</Label>
                                        <span className="text-xs text-purple-400 font-mono">
                                          {param.value.toFixed(2)}
                                        </span>
                                      </div>
                                      <Slider
                                        min={param.minValue}
                                        max={param.maxValue}
                                        step={0.01}
                                        value={[param.value]}
                                        onValueChange={(value) => handleParameterChange(param.id, value[0])}
                                        className="mb-1"
                                      />
                                      <div className="flex justify-between text-xs text-purple-500">
                                        <span>{param.minValue.toFixed(1)}</span>
                                        <span className="text-purple-400">기본: {param.defaultValue.toFixed(1)}</span>
                                        <span>{param.maxValue.toFixed(1)}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                          
                          {/* 기타 파라미터 (카테고리 없음) */}
                          {parameters.filter(p => {
                            const commonParam = commonParameters.find(cp => cp.id === p.id);
                            return !commonParam;
                          }).length > 0 && (
                            <div className="mb-6">
                              <h4 className="font-semibold text-purple-200 mb-3">
                                <i className="fas fa-circle-dot text-purple-400 mr-2"></i>
                                기타 파라미터
                              </h4>
                              <div className="space-y-3">
                                {parameters.filter(p => {
                                  const commonParam = commonParameters.find(cp => cp.id === p.id);
                                  return !commonParam;
                                }).map(param => (
                                  <div key={param.id} className="p-3 bg-purple-900/20 rounded border border-purple-500/20">
                                    <div className="flex items-center justify-between mb-2">
                                      <Label className="text-sm text-purple-200">{param.name}</Label>
                                      <span className="text-xs text-purple-400 font-mono">
                                        {param.value.toFixed(2)}
                                      </span>
                                    </div>
                                    <Slider
                                      min={param.minValue}
                                      max={param.maxValue}
                                      step={0.01}
                                      value={[param.value]}
                                      onValueChange={(value) => handleParameterChange(param.id, value[0])}
                                    />
                                    <div className="flex justify-between text-xs text-purple-500 mt-1">
                                      <span>{param.minValue.toFixed(1)}</span>
                                      <span>{param.maxValue.toFixed(1)}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </TabsContent>
                    
                    {/* 파트 제어 탭 */}
                    <TabsContent value="parts" className="space-y-4">
                      {parts.length === 0 ? (
                        <div className="text-center py-8 text-purple-400">
                          <i className="fas fa-puzzle-piece text-4xl mb-3"></i>
                          <p>모델을 로드하면 파트가 표시됩니다</p>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between mb-4">
                            <Label className="text-purple-200">파트 목록</Label>
                            <Badge className="bg-purple-600">{parts.length}개</Badge>
                          </div>
                          
                          <div className="space-y-3">
                            {parts.map(part => (
                              <div key={part.id} className="p-3 bg-purple-900/20 rounded border border-purple-500/20">
                                <div className="flex items-center justify-between mb-2">
                                  <Label className="text-sm text-purple-200">
                                    <i className="fas fa-puzzle-piece text-purple-400 mr-2"></i>
                                    {part.name}
                                  </Label>
                                  <span className="text-xs text-purple-400 font-mono">
                                    {(part.opacity * 100).toFixed(0)}%
                                  </span>
                                </div>
                                <Slider
                                  min={0}
                                  max={1}
                                  step={0.01}
                                  value={[part.opacity]}
                                  onValueChange={(value) => handlePartOpacityChange(part.id, value[0])}
                                />
                                <div className="flex justify-between text-xs text-purple-500 mt-1">
                                  <span>투명</span>
                                  <span>불투명</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </TabsContent>
                    
                    {/* 효과 탭 */}
                    <TabsContent value="effects" className="space-y-6">
                      {/* 호흡 효과 */}
                      <div className="p-4 bg-purple-900/20 rounded-lg border border-purple-500/30">
                        <div className="flex items-center justify-between mb-4">
                          <Label className="text-base font-semibold text-purple-200">
                            <i className="fas fa-wind text-blue-400 mr-2"></i>
                            호흡 효과 (Breath)
                          </Label>
                          <Switch
                            checked={breathSettings.enabled}
                            onCheckedChange={(enabled) => 
                              setBreathSettings(prev => ({ ...prev, enabled }))
                            }
                          />
                        </div>
                        
                        {breathSettings.enabled && (
                          <div className="space-y-4">
                            <div>
                              <Label className="text-sm text-purple-300">주기 (Cycle)</Label>
                              <Slider
                                min={1}
                                max={10}
                                step={0.1}
                                value={[breathSettings.cycle]}
                                onValueChange={(value) => 
                                  setBreathSettings(prev => ({ ...prev, cycle: value[0] }))
                                }
                              />
                              <div className="text-xs text-purple-400 text-right mt-1">
                                {breathSettings.cycle.toFixed(1)}초
                              </div>
                            </div>
                            
                            <div>
                              <Label className="text-sm text-purple-300">강도 (Peak)</Label>
                              <Slider
                                min={0}
                                max={2}
                                step={0.1}
                                value={[breathSettings.peak]}
                                onValueChange={(value) => 
                                  setBreathSettings(prev => ({ ...prev, peak: value[0] }))
                                }
                              />
                              <div className="text-xs text-purple-400 text-right mt-1">
                                {breathSettings.peak.toFixed(1)}
                              </div>
                            </div>
                            
                            <div>
                              <Label className="text-sm text-purple-300">오프셋 (Offset)</Label>
                              <Slider
                                min={-1}
                                max={1}
                                step={0.1}
                                value={[breathSettings.offset]}
                                onValueChange={(value) => 
                                  setBreathSettings(prev => ({ ...prev, offset: value[0] }))
                                }
                              />
                              <div className="text-xs text-purple-400 text-right mt-1">
                                {breathSettings.offset.toFixed(1)}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* 눈 깜빡임 효과 */}
                      <div className="p-4 bg-purple-900/20 rounded-lg border border-purple-500/30">
                        <div className="flex items-center justify-between mb-4">
                          <Label className="text-base font-semibold text-purple-200">
                            <i className="fas fa-eye text-pink-400 mr-2"></i>
                            눈 깜빡임 (Eye Blink)
                          </Label>
                          <Switch
                            checked={eyeBlinkSettings.enabled}
                            onCheckedChange={(enabled) => 
                              setEyeBlinkSettings(prev => ({ ...prev, enabled }))
                            }
                          />
                        </div>
                        
                        {eyeBlinkSettings.enabled && (
                          <div className="space-y-4">
                            <div>
                              <Label className="text-sm text-purple-300">깜빡임 간격</Label>
                              <Slider
                                min={1}
                                max={10}
                                step={0.5}
                                value={[eyeBlinkSettings.interval]}
                                onValueChange={(value) => 
                                  setEyeBlinkSettings(prev => ({ ...prev, interval: value[0] }))
                                }
                              />
                              <div className="text-xs text-purple-400 text-right mt-1">
                                {eyeBlinkSettings.interval.toFixed(1)}초
                              </div>
                            </div>
                            
                            <div>
                              <Label className="text-sm text-purple-300">감는 시간</Label>
                              <Slider
                                min={0.05}
                                max={0.5}
                                step={0.01}
                                value={[eyeBlinkSettings.closingDuration]}
                                onValueChange={(value) => 
                                  setEyeBlinkSettings(prev => ({ ...prev, closingDuration: value[0] }))
                                }
                              />
                              <div className="text-xs text-purple-400 text-right mt-1">
                                {eyeBlinkSettings.closingDuration.toFixed(2)}초
                              </div>
                            </div>
                            
                            <div>
                              <Label className="text-sm text-purple-300">감은 상태 유지</Label>
                              <Slider
                                min={0.05}
                                max={0.3}
                                step={0.01}
                                value={[eyeBlinkSettings.closedDuration]}
                                onValueChange={(value) => 
                                  setEyeBlinkSettings(prev => ({ ...prev, closedDuration: value[0] }))
                                }
                              />
                              <div className="text-xs text-purple-400 text-right mt-1">
                                {eyeBlinkSettings.closedDuration.toFixed(2)}초
                              </div>
                            </div>
                            
                            <div>
                              <Label className="text-sm text-purple-300">뜨는 시간</Label>
                              <Slider
                                min={0.05}
                                max={0.5}
                                step={0.01}
                                value={[eyeBlinkSettings.openingDuration]}
                                onValueChange={(value) => 
                                  setEyeBlinkSettings(prev => ({ ...prev, openingDuration: value[0] }))
                                }
                              />
                              <div className="text-xs text-purple-400 text-right mt-1">
                                {eyeBlinkSettings.openingDuration.toFixed(2)}초
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="p-4 bg-blue-900/20 rounded-lg border border-blue-500/30">
                        <h4 className="font-semibold text-blue-200 mb-2 flex items-center">
                          <i className="fas fa-lightbulb mr-2 text-yellow-400"></i>
                          효과 정보
                        </h4>
                        <p className="text-sm text-blue-300">
                          호흡과 눈 깜빡임 효과는 Cubism SDK의 표준 기능을 사용하여 
                          실시간으로 모델 파라미터를 제어합니다.
                        </p>
                      </div>
                    </TabsContent>
                    
                    {/* 표정 저장 탭 */}
                    <TabsContent value="expressions" className="space-y-4">
                      <div className="p-4 bg-gradient-to-br from-pink-900/40 to-purple-900/40 rounded-lg border border-pink-500/30">
                        <h4 className="font-semibold text-pink-200 mb-3">
                          <i className="fas fa-plus-circle mr-2"></i>
                          새 표정 저장
                        </h4>
                        <div className="space-y-3">
                          <Input
                            placeholder="표정 이름 입력..."
                            value={newExpressionName}
                            onChange={(e) => setNewExpressionName(e.target.value)}
                            className="bg-purple-900/30 border-purple-500/30 text-purple-100"
                          />
                          <Button 
                            onClick={handleSaveExpression}
                            className="w-full bg-gradient-to-r from-pink-600 to-purple-600"
                          >
                            <i className="fas fa-save mr-2"></i>
                            현재 상태를 표정으로 저장
                          </Button>
                        </div>
                      </div>
                      
                      <Separator className="bg-purple-500/30" />
                      
                      <div>
                        <Label className="text-purple-200 mb-3 block">
                          저장된 표정 ({customExpressions.length}개)
                        </Label>
                        
                        {customExpressions.length === 0 ? (
                          <div className="text-center py-8 text-purple-400">
                            <i className="fas fa-face-smile text-4xl mb-3"></i>
                            <p>저장된 표정이 없습니다</p>
                            <p className="text-sm mt-2">파라미터를 조정하고 위에서 저장하세요</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {customExpressions.map((expr, index) => (
                              <div 
                                key={index}
                                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                                  currentExpression === expr.name
                                    ? 'bg-pink-600/30 border-pink-500'
                                    : 'bg-purple-900/20 border-purple-500/30 hover:bg-purple-900/40'
                                }`}
                                onClick={() => handleApplyExpression(expr.name)}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center">
                                    <i className="fas fa-face-smile text-pink-400 mr-3"></i>
                                    <div>
                                      <p className="font-semibold text-purple-100">{expr.name}</p>
                                      <p className="text-xs text-purple-400">
                                        {Object.keys(expr.parameters).length}개 파라미터
                                      </p>
                                    </div>
                                  </div>
                                  {currentExpression === expr.name && (
                                    <Badge className="bg-pink-600">적용 중</Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </TabsContent>
                    
                    {/* 프리셋 관리 탭 */}
                    <TabsContent value="presets" className="space-y-4">
                      {/* 프리셋 저장 섹션 */}
                      <div className="p-4 bg-gradient-to-br from-indigo-900/40 to-purple-900/40 rounded-lg border border-indigo-500/30">
                        <h4 className="font-semibold text-indigo-200 mb-3">
                          <i className="fas fa-save mr-2"></i>
                          프리셋 저장
                        </h4>
                        <div className="space-y-3">
                          <Input
                            placeholder="프리셋 이름 입력..."
                            value={presetName}
                            onChange={(e) => setPresetName(e.target.value)}
                            className="bg-purple-900/30 border-purple-500/30 text-purple-100"
                          />
                          <Button 
                            onClick={handleSavePreset}
                            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600"
                          >
                            <i className="fas fa-save mr-2"></i>
                            현재 파라미터 저장
                          </Button>
                        </div>
                      </div>
                      
                      <Separator className="bg-purple-500/30" />
                      
                      {/* 내보내기/가져오기 섹션 */}
                      <div className="p-4 bg-gradient-to-br from-blue-900/40 to-cyan-900/40 rounded-lg border border-blue-500/30">
                        <h4 className="font-semibold text-blue-200 mb-3">
                          <i className="fas fa-file-export mr-2"></i>
                          내보내기 / 가져오기
                        </h4>
                        <div className="space-y-2">
                          <Button 
                            onClick={handleExportPreset}
                            className="w-full bg-gradient-to-r from-blue-600 to-cyan-600"
                          >
                            <i className="fas fa-download mr-2"></i>
                            JSON으로 내보내기
                          </Button>
                          <Button 
                            onClick={() => document.getElementById('preset-file-input')?.click()}
                            className="w-full bg-gradient-to-r from-cyan-600 to-teal-600"
                          >
                            <i className="fas fa-upload mr-2"></i>
                            JSON 파일 가져오기
                          </Button>
                          <input
                            id="preset-file-input"
                            type="file"
                            accept=".json"
                            onChange={handleImportPreset}
                            className="hidden"
                          />
                        </div>
                        <p className="text-xs text-blue-300 mt-3">
                          <i className="fas fa-info-circle mr-1"></i>
                          내보낸 JSON 파일에는 모든 파라미터와 파트 설정이 포함됩니다
                        </p>
                      </div>
                      
                      <Separator className="bg-purple-500/30" />
                      
                      {/* 저장된 프리셋 목록 */}
                      <div>
                        <Label className="text-purple-200 mb-3 block">
                          저장된 프리셋 ({savedPresets.length}개)
                        </Label>
                        
                        {savedPresets.length === 0 ? (
                          <div className="text-center py-8 text-purple-400">
                            <i className="fas fa-box-open text-4xl mb-3"></i>
                            <p>저장된 프리셋이 없습니다</p>
                            <p className="text-sm mt-2">파라미터를 조정하고 위에서 저장하세요</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {savedPresets.map((preset: any, index: number) => (
                              <div 
                                key={index}
                                className="p-3 bg-purple-900/20 rounded-lg border border-purple-500/30"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <p className="font-semibold text-purple-100">{preset.name}</p>
                                    <p className="text-xs text-purple-400">
                                      {Object.keys(preset.parameters).length}개 파라미터
                                    </p>
                                    {preset.timestamp && (
                                      <p className="text-xs text-purple-500 mt-1">
                                        {new Date(preset.timestamp).toLocaleString('ko-KR')}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() => handleLoadPreset(preset.parameters)}
                                      className="bg-indigo-600 hover:bg-indigo-700"
                                    >
                                      <i className="fas fa-check mr-1"></i>
                                      적용
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => handleDeletePreset(preset.name)}
                                    >
                                      <i className="fas fa-trash"></i>
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {/* 사용 안내 */}
                      <div className="p-4 bg-yellow-900/20 rounded-lg border border-yellow-500/30">
                        <h4 className="font-semibold text-yellow-200 mb-2 flex items-center">
                          <i className="fas fa-lightbulb mr-2"></i>
                          프리셋 사용 팁
                        </h4>
                        <ul className="text-sm text-yellow-300 space-y-1">
                          <li>• 원하는 포즈/표정을 만든 후 프리셋으로 저장하세요</li>
                          <li>• JSON 파일로 내보내면 다른 환경에서도 사용 가능합니다</li>
                          <li>• 프리셋은 브라우저 로컬에 저장됩니다</li>
                        </ul>
                      </div>
                    </TabsContent>
                    
                    {/* 텍스처 편집 탭 */}
                    <TabsContent value="texture" className="space-y-4">
                      <div className="p-4 bg-gradient-to-br from-cyan-900/40 to-blue-900/40 rounded-lg border border-cyan-500/30">
                        <h4 className="font-semibold text-cyan-200 mb-3 flex items-center">
                          <i className="fas fa-image mr-2"></i>
                          텍스처 이미지 편집기
                        </h4>
                        <p className="text-sm text-cyan-300 mb-4">
                          현재 모델의 texture_00.png 파일을 캔버스에서 직접 편집
                        </p>
                        
                        {/* 텍스처 로드 버튼 */}
                        {!isImageEditorOpen ? (
                          <Button
                            onClick={loadCurrentTexture}
                            className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-lg py-6"
                          >
                            <i className="fas fa-paint-brush mr-2"></i>
                            텍스처 이미지 불러오기
                          </Button>
                        ) : (
                          <div className="space-y-4">
                            {/* 캔버스 영역 */}
                            <div className="bg-black/50 rounded-lg p-4 border-2 border-cyan-500/30">
                              <div 
                                className="overflow-auto" 
                                style={{
                                  maxHeight: '600px',
                                  display: 'flex',
                                  justifyContent: 'center',
                                  alignItems: 'flex-start',
                                }}
                              >
                                <canvas
                                  ref={canvasRef}
                                  onMouseDown={startDrawing}
                                  onMouseMove={draw}
                                  onMouseUp={stopDrawing}
                                  onMouseLeave={stopDrawing}
                                  className="shadow-2xl border-2 border-cyan-400"
                                  style={{ 
                                    imageRendering: 'auto',
                                    maxWidth: '100%',
                                    maxHeight: '600px',
                                    width: 'auto',
                                    height: 'auto',
                                    transform: `scale(${canvasZoom})`,
                                    transformOrigin: 'top left',
                                    transition: 'transform 0.2s',
                                    cursor: drawMode === 'brush' ? 'crosshair' 
                                          : drawMode === 'eraser' ? 'not-allowed'
                                          : 'default',
                                  }}
                                />
                              </div>
                              {editingImage && (
                                <div className="text-xs text-cyan-400 mt-2 flex justify-between">
                                  <span>원본: {editingImage.width} x {editingImage.height}px</span>
                                  <span>줌: {Math.round(canvasZoom * 100)}%</span>
                                  <span>히스토리: {historyStep + 1}/{canvasHistory.length}</span>
                                </div>
                              )}
                            </div>
                            
                            {/* 도구 선택 */}
                            <div className="p-3 bg-cyan-900/20 rounded-lg border border-cyan-500/30">
                              <Label className="text-sm text-cyan-300 mb-2 block">
                                <i className="fas fa-tools mr-2"></i>
                                그리기 도구
                              </Label>
                              <div className="grid grid-cols-7 gap-2">
                                <Button
                                  size="sm"
                                  variant={drawMode === 'brush' ? 'default' : 'outline'}
                                  onClick={() => setDrawMode('brush')}
                                  className={drawMode === 'brush' ? 'bg-cyan-600' : ''}
                                  title="브러시"
                                >
                                  <i className="fas fa-pen"></i>
                                </Button>
                                <Button
                                  size="sm"
                                  variant={drawMode === 'eraser' ? 'default' : 'outline'}
                                  onClick={() => setDrawMode('eraser')}
                                  className={drawMode === 'eraser' ? 'bg-cyan-600' : ''}
                                  title="지우개"
                                >
                                  <i className="fas fa-eraser"></i>
                                </Button>
                                <Button
                                  size="sm"
                                  variant={drawMode === 'select' ? 'default' : 'outline'}
                                  onClick={() => setDrawMode('select')}
                                  className={drawMode === 'select' ? 'bg-purple-600' : ''}
                                  title="수동 영역 선택"
                                >
                                  <i className="fas fa-vector-square"></i>
                                </Button>
                                <Button
                                  size="sm"
                                  variant={drawMode === 'magic-wand' ? 'default' : 'outline'}
                                  onClick={() => setDrawMode('magic-wand')}
                                  className={drawMode === 'magic-wand' ? 'bg-purple-600' : ''}
                                  title="자동 선택 (Magic Wand)"
                                >
                                  <i className="fas fa-hand-sparkles"></i>
                                </Button>
                                <div className="flex items-center gap-2 ml-2 pl-2 border-l border-purple-500/30">
                                  <input
                                    type="color"
                                    value={fillColor}
                                    onChange={(e) => setFillColor(e.target.value)}
                                    className="w-8 h-8 rounded cursor-pointer border-2 border-pink-500/50"
                                    title="칠하기 색상"
                                  />
                                  <Button
                                    size="sm"
                                    onClick={handleFillSelection}
                                    disabled={selectionRects.length === 0}
                                    className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
                                    title="선택 영역 칠하기"
                                  >
                                    <i className="fas fa-fill-drip mr-1"></i>
                                    칠하기
                                  </Button>
                                </div>
                              </div>
                            </div>
                            
                            {/* Magic Wand 설정 (자동 선택 모드일 때만 표시) */}
                            {drawMode === 'magic-wand' && (
                              <div className="p-3 bg-purple-900/20 rounded-lg border border-purple-500/30">
                                <Label className="text-sm text-purple-300 mb-2 block">
                                  <i className="fas fa-sliders-h mr-2"></i>
                                  자동 선택 허용 오차
                                </Label>
                                <div className="flex items-center gap-3">
                                  <Slider
                                    min={0}
                                    max={128}
                                    step={1}
                                    value={[magicWandTolerance]}
                                    onValueChange={(v) => setMagicWandTolerance(v[0])}
                                    className="flex-1"
                                  />
                                  <span className="text-sm text-purple-300 w-12 text-right">
                                    {magicWandTolerance}
                                  </span>
                                </div>
                                <p className="text-xs text-purple-400 mt-2">
                                  💡 값이 클수록 더 넓은 영역 선택 (0~128)
                                </p>
                              </div>
                            )}
                            
                            {/* 편집 도구 */}
                            <div className="grid grid-cols-2 gap-4">
                              {/* 브러시 설정 */}
                              <div className="p-3 bg-cyan-900/20 rounded-lg border border-cyan-500/30">
                                <Label className="text-sm text-cyan-300 mb-2 block">
                                  <i className="fas fa-brush mr-2"></i>
                                  브러시 크기
                                </Label>
                                <Slider
                                  min={1}
                                  max={50}
                                  step={1}
                                  value={[canvasBrushSize]}
                                  onValueChange={(v) => setCanvasBrushSize(v[0])}
                                  className="mb-2"
                                />
                                <div className="flex justify-between text-xs text-cyan-400">
                                  <span>1px</span>
                                  <span className="font-bold">{canvasBrushSize}px</span>
                                  <span>50px</span>
                                </div>
                              </div>
                              
                              {/* 색상 선택 */}
                              <div className="p-3 bg-cyan-900/20 rounded-lg border border-cyan-500/30">
                                <Label className="text-sm text-cyan-300 mb-2 block">
                                  <i className="fas fa-palette mr-2"></i>
                                  브러시 색상
                                </Label>
                                <input
                                  type="color"
                                  value={canvasBrushColor}
                                  onChange={(e) => setCanvasBrushColor(e.target.value)}
                                  className="w-full h-12 rounded cursor-pointer border-2 border-cyan-500/30"
                                />
                                <p className="text-xs text-cyan-400 mt-1">{canvasBrushColor}</p>
                              </div>
                            </div>
                            
                            {/* 줌 컨트롤 */}
                            <div className="p-3 bg-cyan-900/20 rounded-lg border border-cyan-500/30">
                              <Label className="text-sm text-cyan-300 mb-2 block">
                                <i className="fas fa-search-plus mr-2"></i>
                                확대/축소 ({Math.round(canvasZoom * 100)}%)
                              </Label>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setCanvasZoom(Math.max(0.25, canvasZoom - 0.25))}
                                  disabled={canvasZoom <= 0.25}
                                >
                                  <i className="fas fa-minus"></i>
                                </Button>
                                <Slider
                                  min={0.25}
                                  max={3}
                                  step={0.25}
                                  value={[canvasZoom]}
                                  onValueChange={(v) => setCanvasZoom(v[0])}
                                  className="flex-1"
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setCanvasZoom(Math.min(3, canvasZoom + 0.25))}
                                  disabled={canvasZoom >= 3}
                                >
                                  <i className="fas fa-plus"></i>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setCanvasZoom(1)}
                                >
                                  <i className="fas fa-redo"></i>
                                </Button>
                              </div>
                            </div>
                            
                            {/* Undo/Redo 버튼 */}
                            <div className="grid grid-cols-4 gap-2">
                              <Button
                                onClick={undo}
                                disabled={historyStep <= 0}
                                variant="outline"
                                size="sm"
                                className="border-purple-500/50 text-purple-300"
                              >
                                <i className="fas fa-undo mr-1"></i>
                                Undo
                              </Button>
                              <Button
                                onClick={redo}
                                disabled={historyStep >= canvasHistory.length - 1}
                                variant="outline"
                                size="sm"
                                className="border-purple-500/50 text-purple-300"
                              >
                                <i className="fas fa-redo mr-1"></i>
                                Redo
                              </Button>
                              <Button
                                onClick={() => {
                                  if (editingImage && canvasRef.current && ctxRef.current) {
                                    const ctx = ctxRef.current;
                                    const canvas = canvasRef.current;
                                    canvas.width = editingImage.width;
                                    canvas.height = editingImage.height;
                                    // 투명 배경 유지
                                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                                    ctx.drawImage(editingImage, 0, 0);
                                    saveHistory();
                                  }
                                }}
                                variant="outline"
                                size="sm"
                                className="border-yellow-500/50 text-yellow-300"
                              >
                                <i className="fas fa-image mr-1"></i>
                                원본
                              </Button>
                              <Button
                                onClick={() => {
                                  setIsImageEditorOpen(false);
                                  setSelectedTexture(null);
                                  setCanvasZoom(1);
                                }}
                                variant="outline"
                                size="sm"
                                className="border-red-500/50 text-red-300"
                              >
                                <i className="fas fa-times mr-1"></i>
                                닫기
                              </Button>
                            </div>
                            
                            {/* 저장 버튼 */}
                            <Button
                              onClick={saveTextureToServer}
                              className="w-full bg-green-600 hover:bg-green-700 text-lg py-6"
                            >
                              <i className="fas fa-save mr-2"></i>
                              서버에 저장하고 모델에 적용
                            </Button>
                            
                            <Separator className="bg-purple-500/30" />
                            
                            {/* 선택 영역 AI 변환 */}
                            <div className="p-4 bg-gradient-to-br from-indigo-900/40 to-purple-900/40 rounded-lg border border-indigo-500/30">
                              <h5 className="font-semibold text-indigo-200 mb-3 flex items-center">
                                <i className="fas fa-crop-simple mr-2"></i>
                                부품별 AI 변환 (Inpainting)
                              </h5>
                              <p className="text-sm text-indigo-300 mb-4">
                                DALL-E 2 Inpainting으로 부품 영역만 AI 변환. 기존 형태와 위치는 유지됩니다.
                              </p>
                              
                              {selectionRects.length > 0 ? (
                                <div className="space-y-3">
                                  {/* 선택 영역 정보 */}
                                  <div className="p-3 bg-indigo-950/50 rounded border border-indigo-500/30">
                                    <p className="text-sm text-indigo-200 mb-2">
                                      <i className="fas fa-check-circle mr-1 text-green-400"></i>
                                      영역 선택 완료 ({selectionRects.length}개)
                                    </p>
                                    <div className="text-xs text-indigo-400 space-y-1">
                                      {selectionRects.map((rect, idx) => (
                                        <div key={idx}>
                                          영역 {idx + 1}: {Math.round(rect.width)} × {Math.round(rect.height)}
                                        </div>
                                      ))}
                                    </div>
                                    <p className="text-xs text-indigo-300 mt-2">
                                      💡 Ctrl + 클릭으로 여러 영역 추가 선택 가능
                                    </p>
                                  </div>
                                  
                                  {/* 부품 설명 (프롬프트) 입력 */}
                                  <div>
                                    <Label className="text-sm text-indigo-300 mb-2 block">
                                      부품 설명 (프롬프트)
                                    </Label>
                                    <textarea
                                      value={regionAiPrompt}
                                      onChange={(e) => setRegionAiPrompt(e.target.value)}
                                      placeholder="예: 파란색 큰 눈, 긴 속눈썹, 반짝이는 홍채"
                                      className="w-full h-20 px-3 py-2 bg-indigo-900/30 border border-indigo-500/30 rounded-md text-indigo-100 placeholder-indigo-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                    <p className="text-xs text-indigo-400 mt-1">
                                      💡 선택한 부품(눈, 입, 머리 등)에 대한 상세한 설명 입력
                                    </p>
                                  </div>
                                  
                                  {/* AI 변환 버튼 */}
                                  <Button
                                    onClick={handleRegionAiTransform}
                                    disabled={isAiProcessing || !regionAiPrompt.trim()}
                                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-lg py-6"
                                  >
                                    {isAiProcessing ? (
                                      <>
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                        AI 변환 중...
                                      </>
                                    ) : (
                                      <>
                                        <i className="fas fa-wand-magic-sparkles mr-2"></i>
                                        선택 영역 AI 변환
                                      </>
                                    )}
                                  </Button>
                                  
                                  {/* 선택 취소 버튼 */}
                                  <Button
                                    onClick={() => {
                                      setSelectionRects([]);
                                      // 캔버스 원본 복원
                                      const canvas = canvasRef.current;
                                      const ctx = ctxRef.current;
                                      if (canvas && ctx && canvasHistory.length > 0 && historyStep >= 0) {
                                        ctx.putImageData(canvasHistory[historyStep], 0, 0);
                                      }
                                    }}
                                    variant="outline"
                                    className="w-full"
                                  >
                                    <i className="fas fa-times mr-2"></i>
                                    모든 선택 취소 ({selectionRects.length}개)
                                  </Button>
                                </div>
                              ) : (
                                <div className="p-4 bg-indigo-950/30 rounded border border-indigo-500/20 text-center">
                                  <i className="fas fa-vector-square text-4xl text-indigo-400 mb-3"></i>
                                  <p className="text-sm text-indigo-300 mb-2">
                                    영역 선택 모드를 활성화하고
                                  </p>
                                  <p className="text-sm text-indigo-300 mb-3">
                                    변환할 부품 영역을 드래그하세요
                                  </p>
                                  <p className="text-xs text-indigo-400">
                                    (상단 도구에서 네모 선택 아이콘 클릭)
                                  </p>
                                </div>
                              )}
                              
                              {/* 사용 안내 */}
                              <div className="p-3 bg-indigo-950/30 rounded border border-indigo-500/20 mt-3">
                                <p className="text-xs text-indigo-300 mb-2">
                                  <i className="fas fa-lightbulb mr-1"></i>
                                  사용 방법 & 특징:
                                </p>
                                <ul className="text-xs text-indigo-400 space-y-1 ml-4">
                                  <li><strong>방법 1: 자동 선택 (추천 ✨)</strong></li>
                                  <li>1. <strong>자동 선택 도구 (지팡이 아이콘)</strong> 클릭</li>
                                  <li>2. 변환할 부품을 클릭 → 자동으로 영역 선택</li>
                                  <li>3. <strong>Ctrl + 클릭</strong>으로 여러 부품 추가 선택 가능 ⭐</li>
                                  <li>4. 부품 설명 입력 후 AI 변환</li>
                                  <li className="mt-2"><strong>방법 2: 수동 선택</strong></li>
                                  <li>1. <strong>수동 선택 도구 (네모 아이콘)</strong> 클릭</li>
                                  <li>2. 부품 영역을 드래그하여 직접 선택</li>
                                  <li>3. <strong>Ctrl + 드래그</strong>로 여러 영역 추가 선택 가능 ⭐</li>
                                  <li>4. 부품 설명 입력 후 AI 변환</li>
                                  <li className="mt-2">💡 <strong>DALL-E 2 Inpainting</strong>으로 기존 형태 유지</li>
                                  <li>💡 선택 영역 주변과 자연스럽게 블렌딩</li>
                                  <li>💡 부품 위치와 크기 정확히 유지</li>
                                  <li>💡 여러 부품을 한 번에 선택하여 일괄 변환 가능 🚀</li>
                                </ul>
                              </div>
                            </div>
                            
                            <Separator className="bg-cyan-500/30" />
                            
                            {/* 도움말 */}
                            <div className="p-3 bg-cyan-950/30 rounded border border-cyan-500/20">
                              <p className="text-xs text-cyan-300 mb-2">
                                <i className="fas fa-info-circle mr-1"></i>
                                편집 팁 & 단축키:
                              </p>
                              <ul className="text-xs text-cyan-400 space-y-1 ml-4">
                                <li>• <strong>Ctrl+Z</strong>: 실행 취소 (Undo)</li>
                                <li>• <strong>Ctrl+Y</strong>: 다시 실행 (Redo)</li>
                                <li>• 7가지 도구: 브러시, 지우개, 선, 사각형, 원, 수동선택, 자동선택</li>
                                <li>• <strong>자동 선택 (Magic Wand)</strong>: 클릭한 부품 자동 인식</li>
                                <li>• 확대/축소로 세밀한 작업 가능 (25% ~ 300%)</li>
                                <li>• 최대 50단계 실행 취소 지원</li>
                                <li>• 저장하면 서버의 실제 파일이 업데이트됩니다</li>
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                    
                    {/* 편집 탭 */}
                    <TabsContent value="editor" className="space-y-4">
                      {/* 신규 모델로 저장 섹션 */}
                      <div className="p-4 bg-gradient-to-br from-emerald-900/40 to-teal-900/40 rounded-lg border border-emerald-500/30">
                        <h4 className="font-semibold text-emerald-200 mb-3 flex items-center">
                          <i className="fas fa-copy mr-2"></i>
                          다른 이름으로 저장
                        </h4>
                        <p className="text-sm text-emerald-300 mb-4">
                          현재 모델과 파라미터 상태를 기반으로 신규 모델 생성
                        </p>
                        
                        {!isSavingAsNew ? (
                          <Button
                            onClick={() => setIsSavingAsNew(true)}
                            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600"
                          >
                            <i className="fas fa-save mr-2"></i>
                            신규 모델로 저장
                          </Button>
                        ) : (
                          <div className="space-y-3">
                            <Input
                              placeholder="새 모델 이름 입력..."
                              value={newModelNameForSave}
                              onChange={(e) => setNewModelNameForSave(e.target.value)}
                              className="bg-emerald-900/20 border-emerald-500/30 text-emerald-100"
                            />
                            <div className="flex gap-2">
                              <Button
                                onClick={handleSaveAsNewModel}
                                className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600"
                              >
                                <i className="fas fa-check mr-2"></i>
                                저장
                              </Button>
                              <Button
                                onClick={() => {
                                  setIsSavingAsNew(false);
                                  setNewModelNameForSave('');
                                }}
                                variant="outline"
                                className="flex-1"
                              >
                                취소
                              </Button>
                            </div>
                          </div>
                        )}
                        
                        <div className="mt-3 p-3 bg-emerald-950/30 rounded border border-emerald-500/20">
                          <p className="text-xs text-emerald-300">
                            <i className="fas fa-info-circle mr-1"></i>
                            저장 시 생성되는 것:
                          </p>
                          <ul className="text-xs text-emerald-400 mt-2 space-y-1 ml-4">
                            <li>• 새 모델 정의 (URL 자동 생성)</li>
                            <li>• 현재 파라미터 상태 프리셋</li>
                            <li>• 전체 설정 JSON 파일 다운로드</li>
                          </ul>
                        </div>
                      </div>
                      
                      <Separator className="bg-purple-500/30" />
                      
                      {/* Cubism Editor 안내 */}
                      <div className="p-4 bg-gradient-to-br from-indigo-900/40 to-blue-900/40 rounded-lg border border-indigo-500/30">
                        <h4 className="font-semibold text-indigo-200 mb-2 flex items-center">
                          <i className="fas fa-graduation-cap mr-2"></i>
                          전문 편집 도구
                        </h4>
                        <p className="text-sm text-indigo-300 mb-3">
                          완전한 Live2D 모델 제작을 위해서는 Live2D Cubism Editor가 필요합니다.
                        </p>
                        <div className="space-y-2">
                          <a
                            href="https://www.live2d.com/en/download/cubism/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                          >
                            <Button className="w-full bg-gradient-to-r from-indigo-600 to-blue-600">
                              <i className="fas fa-external-link-alt mr-2"></i>
                              Cubism Editor 다운로드
                            </Button>
                          </a>
                          <p className="text-xs text-indigo-400">
                            Cubism Editor에서는 다음 기능을 사용할 수 있습니다:
                          </p>
                          <ul className="text-xs text-indigo-300 ml-4 space-y-1">
                            <li>• PSD 파일에서 모델 생성</li>
                            <li>• 메쉬 변형 및 파라미터 바인딩</li>
                            <li>• 물리 연산 설정</li>
                            <li>• 모션 및 표정 애니메이션</li>
                            <li>• 완전한 모델 내보내기</li>
                          </ul>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvatarStudio;

