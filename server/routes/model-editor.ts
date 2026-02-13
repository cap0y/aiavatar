import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import FormData from 'form-data';
import { Readable } from 'stream';
import os from 'os';
import axios from 'axios';
import AdmZip from 'adm-zip';

const router = express.Router();

// OpenAI API 응답 타입 정의
interface OpenAIImageResponse {
  data: Array<{
    url: string;
    revised_prompt?: string;
  }>;
}

interface OpenAIErrorResponse {
  error: {
    message: string;
    type?: string;
    code?: string;
  };
}

const { cp: copyDir, mkdir, writeFile, readdir, stat } = fs.promises;

// 모든 Live2D 모델 자동 감지
router.get('/scan-models', async (req: Request, res: Response) => {
  try {
    const publicPath = path.join(process.cwd(), 'public');
    const modelsPath = path.join(publicPath, 'live2d-models');
    
    console.log('🔍 모델 폴더 스캔 시작:', modelsPath);
    
    if (!fs.existsSync(modelsPath)) {
      return res.status(404).json({ 
        error: 'live2d-models 폴더를 찾을 수 없습니다.' 
      });
    }
    
    const modelFolders = await readdir(modelsPath);
    const models: any[] = [];
    
    for (const folderName of modelFolders) {
      const folderPath = path.join(modelsPath, folderName);
      const folderStat = await stat(folderPath);
      
      // 디렉토리만 처리
      if (!folderStat.isDirectory()) {
        continue;
      }
      
      let modelUrl = '';
      let modelJsonFile = '';
      
      // 1. runtime 폴더에서 .model3.json 파일 찾기 (Cubism SDK 형식)
      const runtimePath = path.join(folderPath, 'runtime');
      
      if (fs.existsSync(runtimePath)) {
        const runtimeFiles = await readdir(runtimePath);
        modelJsonFile = runtimeFiles.find(f => f.endsWith('.model3.json')) || '';
        
        if (modelJsonFile) {
          modelUrl = `/live2d-models/${folderName}/runtime/${modelJsonFile}`;
          console.log(`✅ 모델 발견 (runtime): ${folderName}`);
        }
      }
      
      // 2. runtime이 없으면 루트에서 .model3.json 파일 찾기 (Project Sekai 형식)
      if (!modelUrl) {
        const rootFiles = await readdir(folderPath);
        modelJsonFile = rootFiles.find(f => f.endsWith('.model3.json')) || '';
        
        if (modelJsonFile) {
          modelUrl = `/live2d-models/${folderName}/${modelJsonFile}`;
          console.log(`✅ 모델 발견 (root): ${folderName}`);
        }
      }
      
      // 모델 정보 생성
      if (modelUrl && modelJsonFile) {
        const model = {
          name: folderName,
          description: folderName.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
          url: modelUrl,
          kScale: 0.5,  // 기본 스케일
          initialXshift: 0.15,
          initialYshift: 0
        };
        
        models.push(model);
      } else {
        console.log(`⚠️ .model3.json 파일 없음: ${folderName}`);
      }
    }
    
    console.log(`✅ 총 ${models.length}개 모델 발견`);
    
    res.json(models);
    
  } catch (error: any) {
    console.error('모델 스캔 오류:', error);
    res.status(500).json({ 
      error: '모델 스캔 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// 파일 업로드 설정
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.'));
    }
  }
});

// ZIP 파일 업로드 설정 (개인 아바타용)
const zipUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.includes('zip') || file.originalname.toLowerCase().endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('ZIP 파일만 업로드 가능합니다.'));
    }
  }
});

// 모델 폴더 복사
router.post('/copy-model', async (req: Request, res: Response) => {
  try {
    const { sourceModel, newModelName } = req.body;
    
    if (!sourceModel || !newModelName) {
      return res.status(400).json({ 
        error: '소스 모델과 새 모델 이름이 필요합니다.' 
      });
    }
    
    const publicPath = path.join(process.cwd(), 'public');
    const sourcePath = path.join(publicPath, 'live2d-models', sourceModel);
    const targetPath = path.join(publicPath, 'live2d-models', newModelName);
    
    // 소스 폴더 존재 확인
    if (!fs.existsSync(sourcePath)) {
      return res.status(404).json({ 
        error: `소스 모델 "${sourceModel}"을 찾을 수 없습니다.` 
      });
    }
    
    // 대상 폴더가 이미 존재하는지 확인
    if (fs.existsSync(targetPath)) {
      return res.status(409).json({ 
        error: `"${newModelName}" 모델이 이미 존재합니다.` 
      });
    }
    
    // 폴더 복사 (재귀적으로)
    await copyDir(sourcePath, targetPath, { recursive: true });
    
    // model3.json 파일만 이름 변경 (내부 파일들은 원본 이름 유지)
    let modelJsonFile = '';
    let modelJsonPath = '';
    
    // 1. runtime 폴더 체크 (Cubism SDK 형식)
    const runtimePath = path.join(targetPath, 'runtime');
    if (fs.existsSync(runtimePath)) {
      const files = await readdir(runtimePath);
      modelJsonFile = files.find(f => f.endsWith('.model3.json')) || '';
      if (modelJsonFile) {
        modelJsonPath = path.join(runtimePath, modelJsonFile);
      }
    }
    
    // 2. runtime이 없으면 루트에서 찾기 (Project Sekai 형식)
    if (!modelJsonPath) {
      const files = await readdir(targetPath);
      modelJsonFile = files.find(f => f.endsWith('.model3.json')) || '';
      if (modelJsonFile) {
        modelJsonPath = path.join(targetPath, modelJsonFile);
      }
    }
    
    if (modelJsonPath) {
      const newPath = path.join(path.dirname(modelJsonPath), `${newModelName}.model3.json`);
      
      // 파일 이름이 다를 경우에만 변경
      if (modelJsonPath !== newPath) {
        fs.renameSync(modelJsonPath, newPath);
      }
      
      // 참조는 원본 그대로 유지 (파일 이름 변경 안 함)
    }
    
    res.json({ 
      success: true,
      message: '모델 폴더가 성공적으로 복사되었습니다.',
      modelPath: `/live2d-models/${newModelName}`,
      modelUrl: `/live2d-models/${newModelName}/runtime/${newModelName}.model3.json`
    });
    
  } catch (error: any) {
    console.error('모델 복사 오류:', error);
    res.status(500).json({ 
      error: '모델 복사 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// 텍스처 파일 저장 (캔버스에서 편집한 이미지를 Base64로 받아서 저장)
router.post('/save-texture', async (req: Request, res: Response) => {
  try {
    const { modelName, imageData } = req.body;
    
    if (!modelName || !imageData) {
      return res.status(400).json({ 
        error: '모델 이름과 이미지 데이터가 필요합니다.' 
      });
    }
    
    console.log('💾 텍스처 저장 시작:', modelName);
    
    // Base64 데이터에서 실제 이미지 데이터 추출
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    const publicPath = path.join(process.cwd(), 'public');
    const runtimePath = path.join(publicPath, 'live2d-models', modelName, 'runtime');
    
    // model3.json에서 실제 텍스처 경로 찾기
    const modelJsonFiles = (await readdir(runtimePath)).filter(f => f.endsWith('.model3.json'));
    
    if (modelJsonFiles.length === 0) {
      return res.status(404).json({ error: 'model3.json 파일을 찾을 수 없습니다.' });
    }
    
    const modelJsonPath = path.join(runtimePath, modelJsonFiles[0]);
    const modelJson = JSON.parse(fs.readFileSync(modelJsonPath, 'utf-8'));
    
    if (!modelJson.FileReferences?.Textures?.[0]) {
      return res.status(404).json({ error: '텍스처 참조를 찾을 수 없습니다.' });
    }
    
    const textureRelPath = modelJson.FileReferences.Textures[0];
    const actualTexturePath = path.join(runtimePath, textureRelPath);
    
    console.log('📝 저장 경로:', actualTexturePath);
    
    // 디렉토리가 없으면 생성
    const textureDir = path.dirname(actualTexturePath);
    if (!fs.existsSync(textureDir)) {
      await mkdir(textureDir, { recursive: true });
    }
    
    // 파일 저장
    await writeFile(actualTexturePath, buffer);
    
    console.log('✅ 텍스처 저장 완료');
    
    res.json({ 
      success: true,
      message: '텍스처가 성공적으로 저장되었습니다.',
      path: actualTexturePath.replace(publicPath, '').replace(/\\/g, '/')
    });
    
  } catch (error: any) {
    console.error('텍스처 저장 오류:', error);
    res.status(500).json({ 
      error: '텍스처 저장 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// 모델 설정 파일 저장
router.post('/save-config', async (req: Request, res: Response) => {
  try {
    const { modelName, config } = req.body;
    
    if (!modelName || !config) {
      return res.status(400).json({ 
        error: '모델 이름과 설정 데이터가 필요합니다.' 
      });
    }
    
    const publicPath = path.join(process.cwd(), 'public');
    const modelPath = path.join(publicPath, 'live2d-models', modelName);
    
    // 모델 폴더 존재 확인
    if (!fs.existsSync(modelPath)) {
      return res.status(404).json({ 
        error: `모델 "${modelName}"을 찾을 수 없습니다.` 
      });
    }
    
    // config.json 파일 저장
    const configPath = path.join(modelPath, `${modelName}_config.json`);
    await writeFile(configPath, JSON.stringify(config, null, 2));
    
    res.json({ 
      success: true,
      message: '설정 파일이 성공적으로 저장되었습니다.',
      path: `/live2d-models/${modelName}/${modelName}_config.json`
    });
    
  } catch (error: any) {
    console.error('설정 저장 오류:', error);
    res.status(500).json({ 
      error: '설정 저장 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// 모델의 텍스처 목록 가져오기
router.get('/textures/:modelName', async (req: Request, res: Response) => {
  try {
    const { modelName } = req.params;
    console.log('🔍 텍스처 검색:', modelName);
    
    const publicPath = path.join(process.cwd(), 'public');
    const modelPath = path.join(publicPath, 'live2d-models', modelName);
    
    // 1. runtime 폴더 체크 (Cubism SDK 형식)
    const runtimePath = path.join(modelPath, 'runtime');
    let modelJsonPath = '';
    let modelJsonFile = '';
    let basePath = '';
    let baseUrl = '';
    
    if (fs.existsSync(runtimePath)) {
      console.log('📂 런타임 경로:', runtimePath);
      const modelJsonFiles = (await readdir(runtimePath)).filter(f => f.endsWith('.model3.json'));
      
      if (modelJsonFiles.length > 0) {
        modelJsonFile = modelJsonFiles[0];
        modelJsonPath = path.join(runtimePath, modelJsonFile);
        basePath = runtimePath;
        baseUrl = `/live2d-models/${modelName}/runtime`;
      }
    }
    
    // 2. runtime이 없으면 루트에서 찾기 (Project Sekai 형식)
    if (!modelJsonPath) {
      console.log('📂 루트 경로:', modelPath);
      const rootFiles = (await readdir(modelPath)).filter(f => f.endsWith('.model3.json'));
      
      if (rootFiles.length > 0) {
        modelJsonFile = rootFiles[0];
        modelJsonPath = path.join(modelPath, modelJsonFile);
        basePath = modelPath;
        baseUrl = `/live2d-models/${modelName}`;
      }
    }
    
    if (!modelJsonPath) {
      console.log('❌ model3.json 파일을 찾을 수 없습니다');
      return res.json({ textures: [] });
    }
    
    const modelJson = JSON.parse(fs.readFileSync(modelJsonPath, 'utf-8'));
    
    console.log('📋 Model JSON:', modelJsonFile);
    console.log('🎨 텍스처 참조:', modelJson.FileReferences?.Textures);
    
    const textures: Array<{name: string, url: string, path: string}> = [];
    
    if (modelJson.FileReferences?.Textures && Array.isArray(modelJson.FileReferences.Textures)) {
      for (const texturePath of modelJson.FileReferences.Textures) {
        const fullPath = path.join(basePath, texturePath);
        console.log('🔎 텍스처 파일 확인:', fullPath, '존재:', fs.existsSync(fullPath));
        
        if (fs.existsSync(fullPath)) {
          const fileName = path.basename(texturePath);
          const textureUrl = `${baseUrl}/${texturePath.replace(/\\/g, '/')}`;
          textures.push({
            name: fileName,
            url: textureUrl,
            path: texturePath
          });
          console.log('✅ 텍스처 추가:', textureUrl);
        }
      }
    }
    
    console.log('📦 응답:', textures.length, '개의 텍스처');
    res.json({ textures });
    
  } catch (error: any) {
    console.error('텍스처 목록 조회 오류:', error);
    res.status(500).json({ 
      error: '텍스처 목록을 가져오는 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// AI 이미지 변환 (OpenAI DALL-E 3 사용)
router.post('/ai-transform', async (req: Request, res: Response) => {
  try {
    const { prompt, style } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ 
        error: '프롬프트가 필요합니다.' 
      });
    }
    
    console.log('🤖 AI 이미지 생성 시작');
    console.log('📝 프롬프트:', prompt);
    console.log('🎨 스타일:', style);
    
    // OpenAI API 키 확인
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return res.status(500).json({ 
        error: 'OpenAI API 키가 설정되지 않았습니다. 서버 환경변수에 OPENAI_API_KEY를 추가해주세요.' 
      });
    }
    
    // 스타일에 따른 프롬프트 보강
    const stylePrompts: {[key: string]: string} = {
      anime: 'anime style, high quality, detailed, Japanese animation art',
      realistic: 'realistic, photorealistic, high detail, professional photography',
      cartoon: 'cartoon style, vibrant colors, simplified, comic book art',
      fantasy: 'fantasy art style, magical atmosphere, detailed, epic',
      cyberpunk: 'cyberpunk style, neon lights, futuristic, sci-fi',
      watercolor: 'watercolor painting style, soft colors, artistic, traditional art'
    };
    
    const enhancedPrompt = `${prompt}, ${stylePrompts[style] || stylePrompts.anime}, character portrait, clean white background, full body, professional quality`;
    
    console.log('✨ 강화된 프롬프트:', enhancedPrompt);
    
    // OpenAI DALL-E 3 API 호출
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: enhancedPrompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        response_format: 'url'
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json() as OpenAIErrorResponse;
      console.error('OpenAI API 오류:', errorData);
      throw new Error(errorData.error?.message || 'OpenAI API 호출 실패');
    }
    
    const result = await response.json() as OpenAIImageResponse;
    console.log('✅ AI 이미지 생성 완료');
    
    // 생성된 이미지 URL 반환
    const imageUrl = result.data[0]?.url;
    if (!imageUrl) {
      throw new Error('생성된 이미지 URL을 찾을 수 없습니다');
    }
    
    console.log('🖼️ 생성된 이미지 URL:', imageUrl);
    
    // CORS 문제 해결: 서버에서 이미지를 다운로드하여 Base64로 인코딩
    console.log('📥 이미지 다운로드 중...');
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error('이미지 다운로드 실패');
    }
    
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    const imageDataUrl = `data:image/png;base64,${base64Image}`;
    
    console.log('✅ 이미지 다운로드 및 인코딩 완료');
    
    // 응답 전송 (Base64 데이터 URL로 전달)
    const responseData = { 
      success: true,
      imageUrl: imageDataUrl, // Base64 데이터 URL로 변경
      revisedPrompt: result.data[0]?.revised_prompt,
      message: 'AI 이미지 생성이 완료되었습니다.'
    };
    
    console.log('📤 응답 전송 중...');
    res.json(responseData);
    console.log('✅ 응답 전송 완료');
    
  } catch (error: any) {
    console.error('AI 이미지 생성 오류:', error);
    res.status(500).json({ 
      error: 'AI 이미지 생성 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// 선택 영역 AI 변환 (DALL-E 2 이미지 편집 - inpainting)
router.post('/ai-transform-region', async (req: Request, res: Response) => {
  try {
    const { fullImageData, maskImageData, prompt, style } = req.body;
    
    if (!fullImageData || !maskImageData || !prompt) {
      return res.status(400).json({
        error: '전체 이미지, 마스크 이미지, 프롬프트가 필요합니다.'
      });
    }
    
    console.log('🎨 영역 AI 변환 시작 (DALL-E 2 Inpainting)');
    console.log('📝 프롬프트:', prompt);
    console.log('🎨 스타일:', style);
    
    // OpenAI API 키 확인
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return res.status(500).json({
        error: 'OpenAI API 키가 설정되지 않았습니다.'
      });
    }
    
    // 스타일에 따른 프롬프트 보강
    const stylePrompts: {[key: string]: string} = {
      anime: 'anime style, high quality, detailed, Japanese animation art',
      realistic: 'realistic, photorealistic, high detail',
      cartoon: 'cartoon style, vibrant colors, simplified',
      fantasy: 'fantasy art style, magical atmosphere, detailed',
      cyberpunk: 'cyberpunk style, neon lights, futuristic',
      watercolor: 'watercolor painting style, soft colors, artistic'
    };
    
    // 기존 형태 유지를 위한 강화된 프롬프트
    // CRITICAL: 동일한 부품 타입 유지 강조
    const enhancedPrompt = `${prompt}, ${stylePrompts[style] || stylePrompts.anime}, CRITICAL RULES: only edit the selected masked area, do NOT generate faces, do NOT add facial features like eyes nose or mouth, do NOT change what the part is (if hair keep as hair only, if clothing keep as clothing only), only change color style or texture of the EXISTING part, preserve exact original shape and boundaries, maintain same position and size, seamless blend with surrounding, professional inpainting edit only, keep original silhouette identical, do not add or remove elements, texture and color change only within existing outlines`;
    console.log('✨ 강화된 프롬프트:', enhancedPrompt);
    
    // Base64 데이터에서 헤더 제거
    const base64Image = fullImageData.replace(/^data:image\/\w+;base64,/, '');
    const base64Mask = maskImageData.replace(/^data:image\/\w+;base64,/, '');
    
    // Buffer로 변환
    const imageBuffer = Buffer.from(base64Image, 'base64');
    const maskBuffer = Buffer.from(base64Mask, 'base64');
    
    // 임시 파일 경로 생성
    const tmpDir = os.tmpdir();
    const imagePath = path.join(tmpDir, `dalle-image-${Date.now()}.png`);
    const maskPath = path.join(tmpDir, `dalle-mask-${Date.now()}.png`);
    
    try {
      // 임시 파일로 저장
      await fs.promises.writeFile(imagePath, imageBuffer);
      await fs.promises.writeFile(maskPath, maskBuffer);
      
      console.log('💾 임시 파일 저장 완료:', { imagePath, maskPath });
      
      // FormData 생성
      const formData = new FormData();
      
      // 파일 스트림으로 추가
      formData.append('image', fs.createReadStream(imagePath), {
        filename: 'image.png',
        contentType: 'image/png'
      });
      
      formData.append('mask', fs.createReadStream(maskPath), {
        filename: 'mask.png',
        contentType: 'image/png'
      });
      
      formData.append('prompt', enhancedPrompt);
      formData.append('n', '1');
      formData.append('size', '1024x1024');
      
      console.log('📤 DALL-E 2 이미지 편집 API 호출...');
      
      // DALL-E 2 이미지 편집 API 호출 (axios 사용)
      const response = await axios.post(
        'https://api.openai.com/v1/images/edits',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            ...formData.getHeaders()
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );
      
      const result = response.data as OpenAIImageResponse;
      console.log('✅ 영역 AI 변환 완료');
      
      const imageUrl = result.data[0]?.url;
      if (!imageUrl) {
        throw new Error('생성된 이미지 URL을 찾을 수 없습니다');
      }
      
      // 이미지 다운로드 및 Base64 인코딩
      console.log('📥 결과 이미지 다운로드 중...');
      const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const base64Result = Buffer.from(imageResponse.data).toString('base64');
      const imageDataUrl = `data:image/png;base64,${base64Result}`;
      
      console.log('✅ 이미지 다운로드 완료');
      
      res.json({
        success: true,
        imageUrl: imageDataUrl,
        message: '영역 AI 변환이 완료되었습니다. (형태 유지)'
      });
      
    } finally {
      // 임시 파일 삭제
      try {
        await fs.promises.unlink(imagePath).catch(() => {});
        await fs.promises.unlink(maskPath).catch(() => {});
        console.log('🗑️ 임시 파일 삭제 완료');
      } catch (cleanupError) {
        console.warn('⚠️ 임시 파일 삭제 실패:', cleanupError);
      }
    }
    
  } catch (error: any) {
    console.error('영역 AI 변환 오류:', error);
    
    // axios 오류 처리
    if (axios.isAxiosError(error) && error.response) {
      console.error('OpenAI API 응답:', error.response.data);
      res.status(500).json({
        error: '영역 AI 변환 중 오류가 발생했습니다.',
        details: error.response.data?.error?.message || error.message
      });
    } else {
      res.status(500).json({
        error: '영역 AI 변환 중 오류가 발생했습니다.',
        details: error.message
      });
    }
  }
});

// 모델 폴더 삭제
router.delete('/delete-model/:modelName', async (req: Request, res: Response) => {
  try {
    const { modelName } = req.params;
    
    // 기본 모델 삭제 방지
    if (modelName === 'mao' || modelName === 'ichika') {
      return res.status(403).json({
        error: '기본 모델은 삭제할 수 없습니다.'
      });
    }
    
    const publicPath = path.join(process.cwd(), 'public');
    const modelPath = path.join(publicPath, 'live2d-models', modelName);
    
    // 모델 폴더 존재 확인
    if (!fs.existsSync(modelPath)) {
      return res.status(404).json({
        error: `모델 "${modelName}"을 찾을 수 없습니다.`
      });
    }
    
    // 폴더 삭제 (재귀적으로)
    await fs.promises.rm(modelPath, { recursive: true, force: true });
    
    console.log('✅ 모델 폴더 삭제 완료:', modelPath);
    
    res.json({
      success: true,
      message: `"${modelName}" 모델 폴더가 삭제되었습니다.`
    });
    
  } catch (error: any) {
    console.error('모델 삭제 오류:', error);
    res.status(500).json({
      error: '모델 폴더 삭제 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

// ===== 개인 아바타 관리 엔드포인트 =====

// 사용자의 개인 아바타 목록 조회
router.get('/user-avatars/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    console.log('📂 개인 아바타 목록 조회:', userId);
    
    const publicPath = path.join(process.cwd(), 'public');
    const userAvatarsPath = path.join(publicPath, 'personal-avatars', userId);
    
    // 사용자 폴더가 없으면 빈 배열 반환
    if (!fs.existsSync(userAvatarsPath)) {
      return res.json({ avatars: [] });
    }
    
    const avatarFolders = await readdir(userAvatarsPath);
    const avatars: any[] = [];
    
    for (const folderName of avatarFolders) {
      const folderPath = path.join(userAvatarsPath, folderName);
      const folderStat = await stat(folderPath);
      
      if (!folderStat.isDirectory()) continue;
      
      // model3.json 파일 찾기
      let modelUrl = '';
      const files = await readdir(folderPath);
      const modelJsonFile = files.find(f => f.endsWith('.model3.json'));
      
      if (modelJsonFile) {
        modelUrl = `/personal-avatars/${userId}/${folderName}/${modelJsonFile}`;
        
        avatars.push({
          id: folderName,
          displayName: folderName,
          modelUrl: modelUrl,
          userId: userId,
          createdAt: folderStat.birthtime
        });
        
        console.log('✅ 개인 아바타 발견:', folderName);
      }
    }
    
    console.log(`✅ 총 ${avatars.length}개 개인 아바타 발견`);
    res.json({ avatars });
    
  } catch (error: any) {
    console.error('개인 아바타 목록 조회 오류:', error);
    res.status(500).json({
      error: '개인 아바타 목록 조회 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

// 개인 아바타 업로드
router.post('/upload-avatar', zipUpload.single('avatarZip'), async (req: Request, res: Response) => {
  try {
    const { userId, avatarName } = req.body;
    const file = req.file;
    
    console.log('📤 개인 아바타 업로드 요청:', {
      userId,
      avatarName,
      fileSize: file?.size,
      fileName: file?.originalname
    });
    
    if (!userId || !avatarName || !file) {
      return res.status(400).json({
        error: '필수 정보가 누락되었습니다. (userId, avatarName, file)'
      });
    }
    
    const publicPath = path.join(process.cwd(), 'public');
    const userAvatarsPath = path.join(publicPath, 'personal-avatars', userId);
    const avatarPath = path.join(userAvatarsPath, avatarName);
    
    // 사용자 폴더가 없으면 생성
    if (!fs.existsSync(userAvatarsPath)) {
      await mkdir(userAvatarsPath, { recursive: true });
      console.log('✅ 사용자 폴더 생성:', userAvatarsPath);
    }
    
    // 같은 이름의 아바타가 이미 있는지 확인
    if (fs.existsSync(avatarPath)) {
      return res.status(409).json({
        error: `"${avatarName}" 아바타가 이미 존재합니다.`
      });
    }
    
    // 아바타 폴더 생성
    await mkdir(avatarPath, { recursive: true });
    
    // ZIP 파일을 임시 위치에 저장
    const tempZipPath = path.join(avatarPath, 'temp.zip');
    await writeFile(tempZipPath, file.buffer);
    console.log('📦 ZIP 파일 저장 완료:', tempZipPath);
    
    // ZIP 파일 압축 해제
    const zip = new AdmZip(tempZipPath);
    zip.extractAllTo(avatarPath, true);
    console.log('📂 ZIP 압축 해제 완료');
    
    // 임시 ZIP 파일 삭제
    await fs.promises.unlink(tempZipPath);
    
    // model3.json 파일 찾기
    const files = await readdir(avatarPath);
    const modelJsonFile = files.find(f => f.endsWith('.model3.json'));
    
    if (!modelJsonFile) {
      // model3.json이 없으면 폴더 삭제
      await fs.promises.rm(avatarPath, { recursive: true, force: true });
      return res.status(400).json({
        error: 'Live2D Cubism 3.0 모델 파일(.model3.json)을 찾을 수 없습니다.'
      });
    }
    
    const modelUrl = `/personal-avatars/${userId}/${avatarName}/${modelJsonFile}`;
    
    console.log('✅ 개인 아바타 업로드 완료:', modelUrl);
    
    res.json({
      success: true,
      message: '개인 아바타가 성공적으로 업로드되었습니다.',
      avatar: {
        id: avatarName,
        displayName: avatarName,
        modelUrl: modelUrl,
        userId: userId,
        createdAt: new Date()
      }
    });
    
  } catch (error: any) {
    console.error('개인 아바타 업로드 오류:', error);
    res.status(500).json({
      error: '개인 아바타 업로드 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

// 개인 아바타 삭제
router.delete('/user-avatar/:userId/:avatarName', async (req: Request, res: Response) => {
  try {
    const { userId, avatarName } = req.params;
    console.log('🗑️ 개인 아바타 삭제 요청:', { userId, avatarName });
    
    const publicPath = path.join(process.cwd(), 'public');
    const avatarPath = path.join(publicPath, 'personal-avatars', userId, avatarName);
    
    // 아바타 폴더 존재 확인
    if (!fs.existsSync(avatarPath)) {
      return res.status(404).json({
        error: `"${avatarName}" 아바타를 찾을 수 없습니다.`
      });
    }
    
    // 폴더 삭제
    await fs.promises.rm(avatarPath, { recursive: true, force: true });
    console.log('✅ 개인 아바타 삭제 완료:', avatarPath);
    
    res.json({
      success: true,
      message: `"${avatarName}" 아바타가 삭제되었습니다.`
    });
    
  } catch (error: any) {
    console.error('개인 아바타 삭제 오류:', error);
    res.status(500).json({
      error: '개인 아바타 삭제 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

export default router;

