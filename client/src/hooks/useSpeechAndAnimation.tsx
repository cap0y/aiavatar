import { useCallback, useState, useRef, useEffect } from 'react';
import { Live2DModel } from 'pixi-live2d-display';
import { parseEmotionMessage } from '@/lib/utils';

interface SpeechAndAnimationOptions {
  model: Live2DModel | null;
  voice?: string;
  rate?: number;
  pitch?: number;
}

export const useSpeechAndAnimation = (model: Live2DModel | null) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isSpeakingRef = useRef(false); // speak ?대??먯꽌 stale closure ?놁씠 李몄“
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const volumeDataRef = useRef<Float32Array | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // ???앹꽦 濡쒓렇 ?쒓굅 (?깅뒫 媛쒖꽑)

  // ?ㅻ뵒??而⑦뀓?ㅽ듃? 遺꾩꽍湲?珥덇린??  const initializeAudioAnalysis = useCallback(() => {
    if (audioContextRef.current) return;

    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyzerRef.current = audioContextRef.current.createAnalyser();
      analyzerRef.current.fftSize = 256;
      volumeDataRef.current = new Float32Array(analyzerRef.current.frequencyBinCount);
    } catch (_) {
      // ?ㅻ뵒??遺꾩꽍湲?珥덇린???ㅽ뙣 - 臾댁떆
    }
  }, []);

  // 二쇳뙆?????퀎 ?먮꼫吏 怨꾩궛 ?ы띁 ?⑥닔
  const calculateFrequencyEnergy = useCallback((frequencyData: Float32Array, startBin: number, endBin: number, totalBins: number): number => {
    const actualEnd = Math.min(endBin, totalBins);
    const actualStart = Math.min(startBin, actualEnd);

    if (actualStart >= actualEnd) return 0;

    let energy = 0;
    for (let i = actualStart; i < actualEnd; i++) {
      // dB瑜?由щ땲??媛믪쑝濡?蹂?? 10^(dB/20)
      const linearValue = Math.pow(10, frequencyData[i] / 20);
      energy += linearValue;
    }

    return energy / (actualEnd - actualStart); // ?됯퇏媛?諛섑솚
  }, []);

  // ?ㅼ떆媛?二쇳뙆??湲곕컲 鍮꾩꽭???좏깮 ?⑥닔
  const selectVisemeFromFrequency = useCallback((frequencyData: Float32Array): { param: string; value: number; name: string } => {
    // 二쇳뙆???곗씠?곌? ?좏슚?쒖? ?뺤씤
    if (!frequencyData || frequencyData.length === 0) {
      return { param: 'ParamA', value: 0, name: '臾댁쓬(二쇳뙆?섏뾾??' };
    }

    // 二쇳뙆?????퀎濡??먮꼫吏 怨꾩궛 (dB瑜?由щ땲?대줈 蹂??
    const binCount = Math.min(frequencyData.length, 128); // 理쒕? 128媛?鍮덈쭔 ?ъ슜
    const lowFreq = calculateFrequencyEnergy(frequencyData, 0, 8, binCount);      // ???(50-200Hz)
    const midLowFreq = calculateFrequencyEnergy(frequencyData, 8, 24, binCount);  // 以묒???(200-600Hz) 
    const midFreq = calculateFrequencyEnergy(frequencyData, 24, 48, binCount);    // 以묒쓬 (600-1200Hz)
    const highFreq = calculateFrequencyEnergy(frequencyData, 48, 80, binCount);   // 怨좎쓬 (1200-2000Hz)
    const veryHighFreq = calculateFrequencyEnergy(frequencyData, 80, binCount, binCount); // 珥덇퀬??(2000Hz+)

    // ?꾩껜 ?먮꼫吏 怨꾩궛
    const totalEnergy = lowFreq + midLowFreq + midFreq + highFreq + veryHighFreq;
    const volume = Math.min(1, Math.max(0, totalEnergy * 10)); // 蹂쇰ⅷ 誘쇨컧???붿슧 利앷? (5 ??10)


    // 理쒖냼 蹂쇰ⅷ ?꾧퀎媛??뺤씤 (濡쒓렇 ?놁씠) - ??誘쇨컧?섍쾶 議곗젙
    if (volume < 0.005) { // 0.02?먯꽌 0.005濡??????땄
      return { param: 'ParamA', value: 0, name: '臾댁쓬(?꾧퀎媛믩?留?' };
    }

    // 二쇳뙆?????퀎 媛뺣룄瑜??뺢퇋??    if (totalEnergy < 0.001) {
      return { param: 'ParamA', value: volume, name: '????-湲곕낯' };
    }

    const lowRatio = lowFreq / totalEnergy;
    const midLowRatio = midLowFreq / totalEnergy;
    const midRatio = midFreq / totalEnergy;
    const highRatio = highFreq / totalEnergy;
    const veryHighRatio = veryHighFreq / totalEnergy;

    // 鍮꾩꽭???좏깮 濡쒖쭅 (?쒓뎅???뚯꽦??湲곕컲)
    let selectedParam = 'ParamA';
    let selectedName = '????';
    let confidence = 0;

    // 媛?鍮꾩꽭?꾨퀎 ?먯닔 怨꾩궛 (??誘쇨컧?섍쾶 議곗젙)
    const visemeScores = {
      ParamU: lowRatio * 3.0 + midLowRatio * 1.0, // ?? ??- ???媛뺤“ (??誘쇨컧)
      ParamO: lowRatio * 2.0 + midLowRatio * 2.5 + midRatio * 0.8, // ??- ???以묒???(??誘쇨컧)
      ParamE: midRatio * 3.0 + highRatio * 2.0, // ?? ??- 以묒쓬+怨좎쓬 (??誘쇨컧)
      ParamI: highRatio * 3.5 + veryHighRatio * 2.5, // ??- 怨좎쓬+珥덇퀬??(??誘쇨컧)
      ParamA: midLowRatio * 1.5 + midRatio * 1.5 + lowRatio * 0.5 // ??- 踰붿슜??利앷?
    };

    // 媛???믪? ?먯닔??鍮꾩꽭???좏깮
    const maxScore = Math.max(...Object.values(visemeScores));
    if (maxScore > 0.1) { // ?좊ː???꾧퀎媛???땄 (0.3 ??0.1)
      for (const [param, score] of Object.entries(visemeScores)) {
        if (score === maxScore) {
          selectedParam = param;
          confidence = score;

          switch (param) {
            case 'ParamU': selectedName = '????'; break;
            case 'ParamO': selectedName = '????'; break;
            case 'ParamE': selectedName = '????'; break;
            case 'ParamI': selectedName = '????'; break;
            default: selectedName = '????'; break;
          }
          break;
        }
      }
    }

    return {
      param: selectedParam,
      value: Math.min(1, volume * (1 + confidence)), // ?좊ː?꾨줈 蹂쇰ⅷ 蹂댁젙
      name: selectedName
    };
  }, [calculateFrequencyEnergy]); // calculateFrequencyEnergy ?⑥닔瑜??섏〈?깆뿉 異붽?

  const applyRealtimeViseme = useCallback((selectedViseme: { param: string; value: number; name: string }) => {
    if (!model) return;

    try {
      const internalModel = (model as any).internalModel;
      if (!internalModel?.coreModel) return;

      const coreModel = internalModel.coreModel;

      // 紐⑤뱺 鍮꾩꽭???뚮씪誘명꽣瑜?0?쇰줈 珥덇린??(ParamMouthOpenY ?ы븿)
      const allVisemes = ['ParamA', 'ParamO', 'ParamU', 'ParamE', 'ParamI', 'ParamMouthOpenY'];

      // ParamMouthOpenY ?몃뜳??李얘린 (誘몃━ 李얠븘??理쒖쟻??
      let mouthOpenYIndex = -1;
      try {
        if (coreModel.getParameterIndex) {
          mouthOpenYIndex = coreModel.getParameterIndex('ParamMouthOpenY');
        }
      } catch (e) { }

      for (const viseme of allVisemes) {
        try {
          let paramIndex = -1;
          if (coreModel.getParameterIndex) {
            paramIndex = coreModel.getParameterIndex(viseme);
          }

          if (paramIndex >= 0) {
            let value = 0;

            // ?좏깮??鍮꾩꽭?꾩씠硫?媛??ㅼ젙
            if (viseme === selectedViseme.param) {
              value = selectedViseme.value;
            }
            // ParamMouthOpenY???좏깮??鍮꾩꽭?꾩씠 紐⑥쓬(ParamA ?????뚮룄 媛숈씠 ?吏곸씠?꾨줉 ?ㅼ젙
            else if (viseme === 'ParamMouthOpenY' && selectedViseme.value > 0.01) {
              // 紐⑥쓬 ?뚮씪誘명꽣媛 ?쒖꽦?붾릺硫?ParamMouthOpenY??媛숈씠 ?댁뼱以?(mao 紐⑤뜽 ???명솚??
              value = selectedViseme.value;
            }

            coreModel.setParameterValueByIndex(paramIndex, value);
          }
        } catch (error) {
          // 媛쒕퀎 ?뚮씪誘명꽣 ?ㅼ젙 ?ㅽ뙣 臾댁떆
        }
      }

      // 紐⑤뜽 ?낅뜲?댄듃
      if (coreModel.update) coreModel.update();
      if (model.update) model.update(0.016);

    } catch (error) {
      // 鍮꾩꽭???곸슜 ?ㅻ쪟 臾댁떆
    }
  }, [model]);

  const animateMouthWithVolume = useCallback((isMoving: boolean) => {
    if (!model || !(model as any)?.internalModel) return;

    try {
      const coreModel = (model as any).internalModel?.coreModel || (model as any).internalModel?._coreModel || (model as any)._coreModel;

      if (!coreModel) {
        console.warn('?렚 coreModel??李얠쓣 ???놁쓬');
        return;
      }

      // ???뚮씪誘명꽣 李얘린 (湲곗〈 肄붾뱶? ?숈씪)
      const allMouthParams = [
        // mao 紐⑤뜽???ㅼ젣 ?뚮씪誘명꽣?ㅼ쓣 理쒖슦?좎쑝濡?諛곗튂
        'ParamA',              // mao 紐⑤뜽??二쇱슂 由쎌떛???뚮씪誘명꽣 (??
        'ParamO',              // mao 紐⑤뜽??由쎌떛???뚮씪誘명꽣 (??
        'ParamU',              // mao 紐⑤뜽??由쎌떛???뚮씪誘명꽣 (??
        'ParamE',              // mao 紐⑤뜽??由쎌떛???뚮씪誘명꽣 (?? 
        'ParamI',              // mao 紐⑤뜽??由쎌떛???뚮씪誘명꽣 (??
        'ParamMouthUp',        // mao 紐⑤뜽???낃섕由??щ┝
        'ParamMouthDown',      // mao 紐⑤뜽???낃섕由?泥섏쭚
        'ParamMouthAngry',     // mao 紐⑤뜽??遺? ??        // 湲곗〈 踰붿슜 ?뚮씪誘명꽣??(諛깆뾽??
        'ParamMouthOpenY',     // 湲곕낯 Live2D ?쒖?
        'ParamMouthOpen',      // ?ㅻⅨ 蹂??        'MouthOpenY',          // 吏㏃? 踰꾩쟾
        'MouthOpen',           // 媛??媛꾨떒??踰꾩쟾
        'PARAM_MOUTH_OPEN_Y',  // ?臾몄옄 踰꾩쟾
        'PARAM_MOUTH_OPEN',    // ?臾몄옄 ?⑥닚 踰꾩쟾
        'mouth_open_y',        // ?뚮Ц???ㅻ꽕?댄겕 耳?댁뒪
        'mouth_open',          // ?뚮Ц???⑥닚
        'PARAM_A',             // ?臾몄옄 踰꾩쟾
        'ParamLipSync',        // 吏곸젒?곸씤 由쎌떛??        'LipSync',             // 媛꾨떒??踰꾩쟾
        'param_mouth_open_y',  // ?뚮Ц???꾩껜
        'ParamMouthY'          // Y異????닿린
      ];

      let mouthOpenParam = -1;
      let usedParamName = '';
      let mouthParamMin = 0;  // mao 紐⑤뜽 ?뚮씪誘명꽣 踰붿쐞??留욊쾶 ?섏젙
      let mouthParamMax = 1;  // mao 紐⑤뜽 ?뚮씪誘명꽣 踰붿쐞??留욊쾶 ?섏젙

      for (const paramName of allMouthParams) {
        let paramIndex = -1;
      try {
          if (coreModel?.getParameterIndex) {
            paramIndex = coreModel.getParameterIndex(paramName);
          } else if (coreModel?.getParameterIndexById) {
            paramIndex = coreModel.getParameterIndexById(paramName);
          }
        } catch {
          continue;
        }

        if (paramIndex !== undefined && paramIndex >= 0) {
          mouthOpenParam = paramIndex;
          usedParamName = paramName;

          // ?뚮씪誘명꽣 踰붿쐞 議고쉶
          try {
            if (coreModel.getParameterMinimumValueByIndex) {
              mouthParamMin = coreModel.getParameterMinimumValueByIndex(paramIndex);
              mouthParamMax = coreModel.getParameterMaximumValueByIndex(paramIndex);
            } else if (coreModel.getParameterMinValueByIndex) {
              mouthParamMin = coreModel.getParameterMinValueByIndex(paramIndex);
              mouthParamMax = coreModel.getParameterMaxValueByIndex(paramIndex);
            } else {
              mouthParamMin = 0; // mao 紐⑤뜽 ?뚮씪誘명꽣 踰붿쐞??留욊쾶 ?섏젙
              mouthParamMax = 1; // mao 紐⑤뜽 ?뚮씪誘명꽣 踰붿쐞??留욊쾶 ?섏젙
            }
          } catch (error) {
            mouthParamMin = 0; // mao 紐⑤뜽 ?뚮씪誘명꽣 踰붿쐞??留욊쾶 ?섏젙
            mouthParamMax = 1; // mao 紐⑤뜽 ?뚮씪誘명꽣 踰붿쐞??留욊쾶 ?섏젙
          }
          break;
        }
      }

      if (mouthOpenParam < 0) return;

      if (isMoving) {
        let zeroVolumeFrameCount = 0;

        // ?렦 ?ㅼ떆媛??ㅻ뵒??蹂쇰ⅷ 湲곕컲 ?좊땲硫붿씠??        const animate = () => {
          if (!isMoving || !animationFrameRef.current || !analyzerRef.current || !volumeDataRef.current) {
            return;
          }

          if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
            try {
              audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
              audioContextRef.current.resume();
              analyzerRef.current = audioContextRef.current.createAnalyser();
              analyzerRef.current.fftSize = 512;
              analyzerRef.current.smoothingTimeConstant = 0.3;
              analyzerRef.current.minDecibels = -90;
              analyzerRef.current.maxDecibels = -10;
              volumeDataRef.current = new Float32Array(analyzerRef.current.frequencyBinCount);
            } catch {
              return;
            }
          }

          // ?ㅻ뵒??二쇳뙆???곗씠??遺꾩꽍 (鍮꾩꽭???좏깮??
          analyzerRef.current.getFloatFrequencyData(volumeDataRef.current as any);

          // 二쇳뙆??湲곕컲 鍮꾩꽭???좏깮
          let selectedViseme = selectVisemeFromFrequency(volumeDataRef.current as any);

          if (selectedViseme.value < 0.01) {
            zeroVolumeFrameCount++;
            if (zeroVolumeFrameCount > 3) {
              const time = Date.now() / 80;
              const fakeValue = Math.abs(Math.sin(time)) * 0.5;
              const vowels = ['ParamA', 'ParamO', 'ParamE', 'ParamI', 'ParamU'];
              const randomVowel = vowels[Math.floor((Date.now() / 150) % vowels.length)];
              selectedViseme = { param: randomVowel, value: fakeValue, name: 'Simulated' };
            }
          } else {
            zeroVolumeFrameCount = 0;
          }

          applyRealtimeViseme(selectedViseme);
          animationFrameRef.current = requestAnimationFrame(animate);
        };

        if (analyzerRef.current && volumeDataRef.current) {
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          let animationStep = 0;
          const visemeSequence = [
            { param: 'ParamA', name: '????' },
            { param: 'ParamO', name: '????' },
            { param: 'ParamE', name: '????' },
            { param: 'ParamI', name: '????' },
            { param: 'ParamU', name: '????' }
          ];

          const backupAnimate = () => {
            if (!isMoving || !animationFrameRef.current) return;

            // 0.25??利앷? ????25?④퀎?????ъ씠??= ??0.4珥?二쇨린 (鍮좊Ⅸ 媛쒗룓)
            animationStep += 0.25;
            const baseIntensity = Math.abs(Math.sin(animationStep)) * 0.55;

            // ??鍮좊Ⅴ寃?鍮꾩꽭???쒗솚 (0.5諛?二쇨린)
            const visemeIndex = Math.floor((animationStep * 0.5) % visemeSequence.length);
            const currentViseme = visemeSequence[visemeIndex];

            applyRealtimeViseme({
              param: currentViseme.param,
              value: baseIntensity,
              name: currentViseme.name + '-諛깆뾽'
            });
            animationFrameRef.current = requestAnimationFrame(backupAnimate);
          };
          animationFrameRef.current = requestAnimationFrame(backupAnimate);
        }
      } else {
        // ???リ린 - 紐⑤뱺 鍮꾩꽭???뚮씪誘명꽣瑜?0?쇰줈 ?ㅼ젙
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }

        // 紐⑤뱺 鍮꾩꽭?꾩쓣 0?쇰줈 ?ㅼ젙?섏뿬 ???リ린
        applyRealtimeViseme({ param: 'ParamA', value: 0, name: '臾댁쓬' });
      }
    } catch (_) {
      // animateMouth ?ㅻ쪟 臾댁떆
    }
  }, [model, selectVisemeFromFrequency, applyRealtimeViseme]);

  // ?뚮씪誘명꽣 罹먯떆 (??踰?李얠쑝硫???ν븯??以묐났 ?먯깋 諛⑹?)
  const mouthParamCache = useRef<{ index: number; name: string } | null>(null);

  // isSpeaking 蹂寃???ref???숆린??  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    mouthParamCache.current = null;
  }, [model]);

  // ?뱀젙 蹂쇰ⅷ 媛믪쑝濡????吏곸엫 ?ㅼ젙 (蹂쇰ⅷ 諛곗뿴 湲곕컲 由쎌떛?ъ슜)
  const animateMouthWithVolumeValue = useCallback((volume: number) => {
    if (!model) return;
    const normalizedVolume = Math.max(0, Math.min(1, volume));
    applyRealtimeViseme({ param: 'ParamA', value: normalizedVolume, name: normalizedVolume > 0 ? '????-蹂쇰ⅷ' : '臾댁쓬' });
  }, [model, applyRealtimeViseme]);

  const speakWithVolumeData = useCallback((audioUrl: string, volumes: number[]) => {
    try {
      const audio = new Audio(audioUrl);
      audio.crossOrigin = 'anonymous';
      setIsSpeaking(true);

      let volumeIndex = 0;
      // let intervalId: NodeJS.Timeout | null = null; // intervalRef ?ъ슜
      let audioContext: AudioContext | null = null;
      let analyzer: AnalyserNode | null = null;
      let source: MediaElementAudioSourceNode | null = null;

      const setupRealtimeAnalysis = async () => {
        try {
          audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          analyzer = audioContext.createAnalyser();
          analyzer.fftSize = 512;
          analyzer.smoothingTimeConstant = 0.3;
          analyzer.minDecibels = -90;
          analyzer.maxDecibels = -10;
          source = audioContext.createMediaElementSource(audio);
          source.connect(analyzer);
          analyzer.connect(audioContext.destination);
        } catch {
          analyzer = null;
          audioContext = null;
        }
      };

      audio.oncanplay = () => {
        setupRealtimeAnalysis();
      };

      let indexScale = 1.0;

      audio.onloadedmetadata = () => {
        if (audio.duration && volumes.length > 0) {
          const audioDurationMs = audio.duration * 1000;
          const volumesDurationMs = volumes.length * 20;
          if (audioDurationMs > 0) {
            indexScale = volumesDurationMs / audioDurationMs;
          }
        }
      };

      audio.onplay = () => {

        // ?섏씠釉뚮━??由쎌떛?? 蹂쇰ⅷ ?곗씠??+ ?ㅼ떆媛?遺꾩꽍
        let zeroVolumeFrameCount = 0; // 臾댁쓬 ?꾨젅??移댁슫??(speakWithVolumeData??
        let currentSmoothedValue = 0; // 遺?쒕윭???吏곸엫???꾪븳 ?꾩옱 媛????
        // 湲곗〈 ?명꽣踰??뺣━
        if (intervalRef.current) clearInterval(intervalRef.current);

        intervalRef.current = setInterval(() => {
          let selectedViseme = { param: 'ParamA', value: 0, name: '臾댁쓬' };

          // ?ㅻ뵒???꾩옱 ?쒓컙 湲곕컲?쇰줈 ?몃뜳??怨꾩궛 (20ms ?⑥쐞 - 諛깆뿏???ㅼ젙怨??쇱튂)
          // indexScale???곸슜?섏뿬 ?ㅻ뵒??湲몄씠? 蹂쇰ⅷ ?곗씠??湲몄씠瑜?留욎땄
          const currentTimeMs = audio.currentTime * 1000;
          const calculatedIndex = Math.floor((currentTimeMs * indexScale) / 20);

          // ?몃뜳???낅뜲?댄듃 (?쒓컙 湲곕컲)
          volumeIndex = calculatedIndex;

          // ?ㅼ떆媛?二쇳뙆??遺꾩꽍?쇰줈 鍮꾩꽭??醫낅쪟 寃곗젙 (??긽 ?ㅽ뻾)
          if (analyzer && audioContext) {
            const frequencyData = new Float32Array(analyzer.frequencyBinCount);
            analyzer.getFloatFrequencyData(frequencyData);

            // 二쇳뙆??湲곕컲 鍮꾩꽭???좏깮 (鍮꾩꽭??醫낅쪟 寃곗젙)
            const frequencyBasedViseme = selectVisemeFromFrequency(frequencyData);

            // 蹂쇰ⅷ ?곗씠?곕줈 媛뺣룄 蹂댁젙
            if (volumeIndex < volumes.length) {
              const volumeIntensity = volumes[volumeIndex];
              selectedViseme = {
                param: frequencyBasedViseme.param,
                value: Math.max(volumeIntensity * 1.5, frequencyBasedViseme.value * 0.6),
                name: `${frequencyBasedViseme.name}-?섏씠釉뚮━??
              };
            } else {
              // 蹂쇰ⅷ ?곗씠???놁쑝硫??쒖닔 二쇳뙆??湲곕컲 (利앺룺)
              selectedViseme = {
                ...frequencyBasedViseme,
                value: frequencyBasedViseme.value * 2.0
              };
            }
          } else if (volumeIndex < volumes.length) {
            // 二쇳뙆??遺꾩꽍 ?놁쑝硫?蹂쇰ⅷ ?곗씠?곕쭔 (湲곗〈 諛⑹떇, ParamA留??ъ슜)
            const volumeData = volumes[volumeIndex];
            selectedViseme = { param: 'ParamA', value: volumeData * 1.5, name: '????-蹂쇰ⅷ?곗씠?? };
          }

          if (selectedViseme.value < 0.15 && !audio.paused && !audio.ended) {
            zeroVolumeFrameCount++;
            if (zeroVolumeFrameCount > 1) {
              const time = Date.now() / 80;
              const fakeValue = Math.abs(Math.sin(time)) * 0.5;
              const vowels = ['ParamA', 'ParamO', 'ParamE', 'ParamI', 'ParamU'];
              const randomVowel = vowels[Math.floor((Date.now() / 150) % vowels.length)];
              selectedViseme = { param: randomVowel, value: fakeValue, name: 'Simulated' };
            }
          } else {
            zeroVolumeFrameCount = 0;
          }

          // smoothing 0.25 ??遺?쒕읇寃??쒖옉?섎릺 諛섏쓳 鍮좊쫫
          const smoothingFactor = 0.25;
          currentSmoothedValue = currentSmoothedValue * (1 - smoothingFactor) + selectedViseme.value * smoothingFactor;
          selectedViseme.value = currentSmoothedValue;

          applyRealtimeViseme(selectedViseme);
        }, 16); // 60fps ?낅뜲?댄듃 二쇨린???좎??섎릺, ?곗씠???섑뵆留곸? ?쒓컙 湲곕컲?쇰줈 ??      };

      audio.onended = () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        // ?섏씠釉뚮━??由쎌떛???뺣━
        if (audioContext) {
          audioContext.close();
          audioContext = null;
        }
        if (source) {
          source.disconnect();
          source = null;
        }
        analyzer = null;

        // ?쎄컙??吏???????リ린 (?먯뿰?ㅻ읇寃?
        setTimeout(() => {
          // 紐⑤뱺 鍮꾩꽭?꾩쓣 0?쇰줈 ?ㅼ젙?섏뿬 ???リ린
          applyRealtimeViseme({ param: 'ParamA', value: 0, name: '臾댁쓬' });
          setIsSpeaking(false);
        }, 200);
      };

      audio.onerror = () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        // ?섏씠釉뚮━??由쎌떛???뺣━
        if (audioContext) {
          audioContext.close();
          audioContext = null;
        }
        if (source) {
          source.disconnect();
          source = null;
        }
        analyzer = null;

        // 紐⑤뱺 鍮꾩꽭?꾩쓣 0?쇰줈 ?ㅼ젙?섏뿬 ???リ린  
        applyRealtimeViseme({ param: 'ParamA', value: 0, name: '臾댁쓬' });
        setIsSpeaking(false);
      };

      audio.play().catch(() => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        animateMouthWithVolumeValue(0);
        setIsSpeaking(false);
      });

    } catch {
      applyRealtimeViseme({ param: 'ParamA', value: 0, name: '臾댁쓬' });
      setIsSpeaking(false);
    }
  }, [applyRealtimeViseme]);

  const speak = useCallback((input: string, type: 'text' | 'audio' = 'text', volumes?: number[]) => {
    stopSpeaking();
    if (!input.trim()) return;

    if (type === 'audio') {
      if (volumes && volumes.length > 0) {
        speakWithVolumeData(input, volumes);
        return;
      }

      try {
        const audio = new Audio(input);
        audio.crossOrigin = 'anonymous';
        initializeAudioAnalysis();

        if (audioContextRef.current && analyzerRef.current) {
          const source = audioContextRef.current.createMediaElementSource(audio);
          source.connect(analyzerRef.current);
          analyzerRef.current.connect(audioContextRef.current.destination);
        }

        setIsSpeaking(true);
        audio.oncanplay = () => { animateMouthWithVolume(true); };
        audio.onended = () => {
          applyRealtimeViseme({ param: 'ParamA', value: 0, name: '臾댁쓬' });
          setIsSpeaking(false);
        };
        audio.onerror = () => {
          applyRealtimeViseme({ param: 'ParamA', value: 0, name: '臾댁쓬' });
          setIsSpeaking(false);
        };
        audio.play().catch(() => {
          animateMouthWithVolume(false);
          setIsSpeaking(false);
        });
        return;

      } catch {
        return;
      }
    }

    const finalText = input.trim();
    const { cleanText } = parseEmotionMessage(input);
    const finalTextForTTS = cleanText || finalText;

    initializeAudioAnalysis();

    if ('speechSynthesis' in window) {
      try {
        const testUtterance = new SpeechSynthesisUtterance('');
        testUtterance.volume = 0;
        window.speechSynthesis.speak(testUtterance);
        window.speechSynthesis.cancel();
      } catch {
        // 沅뚰븳 ?쒖꽦???ㅽ뙣 臾댁떆
      }
    }

    const utterance = new SpeechSynthesisUtterance(finalTextForTTS);
    const voices = window.speechSynthesis.getVoices();
    const koreanVoice = voices.find(voice => voice.lang.includes('ko'));

    if (koreanVoice) {
      utterance.voice = koreanVoice;
    }

    utterance.lang = 'ko-KR';
    utterance.rate = 0.9;
    utterance.pitch = 1.1;
    utterance.volume = 1.0;

    const originalOnEnd = utterance.onend;
    const originalOnError = utterance.onerror;

    setIsSpeaking(true);

    const backupTimer = setTimeout(() => {
      if (!isSpeakingRef.current && utteranceRef.current === utterance) {
        setIsSpeaking(true);
        animateMouthWithVolume(true);
        const duration = Math.min(finalText.length * 80, 8000);
        setTimeout(() => {
          setIsSpeaking(false);
          applyRealtimeViseme({ param: 'ParamA', value: 0, name: '臾댁쓬' });
        }, duration);
      }
    }, 5000);

    utterance.onstart = () => {
      clearTimeout(backupTimer);
      animateMouthWithVolume(true);
    };

    utterance.onend = (event) => {
      applyRealtimeViseme({ param: 'ParamA', value: 0, name: '臾댁쓬' });
      setIsSpeaking(false);
      clearTimeout(backupTimer);
      if (originalOnEnd) originalOnEnd.call(utterance, event);
    };

    utterance.onerror = (event) => {
      if (event.error === 'interrupted' || event.error === 'canceled') return;
      setIsSpeaking(false);
      applyRealtimeViseme({ param: 'ParamA', value: 0, name: '臾댁쓬' });
      clearTimeout(backupTimer);
      if (originalOnError) originalOnError.call(utterance, event);
    };

    utteranceRef.current = utterance;

    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      setIsSpeaking(false);
      applyRealtimeViseme({ param: 'ParamA', value: 0, name: '臾댁쓬' });
    }
  // isSpeaking? isSpeakingRef濡?李몄“?섎?濡??섏〈?깆뿉???쒓굅 (紐⑤뜽 蹂寃??쒖뿉留??ъ깮??
  }, [model, animateMouthWithVolume, initializeAudioAnalysis, applyRealtimeViseme, speakWithVolumeData]);

  const stopSpeaking = useCallback(() => {
    if (utteranceRef.current) {
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
    }
    setIsSpeaking(false);
    applyRealtimeViseme({ param: 'ParamA', value: 0, name: '臾댁쓬' });
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, [applyRealtimeViseme]);

  const cleanup = useCallback(() => {
    if (utteranceRef.current) {
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
      analyzerRef.current = null;
      volumeDataRef.current = null;
    }
    if (model) {
      applyRealtimeViseme({ param: 'ParamA', value: 0, name: '臾댁쓬' });
    }
    setIsSpeaking(false);
  }, [model, applyRealtimeViseme]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // ??諛섑솚 濡쒓렇 ?쒓굅 (?깅뒫 媛쒖꽑)

  return {
    speak,
    stopSpeaking,
    isSpeaking,
    cleanup
  };
}; 
