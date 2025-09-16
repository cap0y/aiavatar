import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MessageCircle, User, Lock, Send, Mic, MicOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const AvatarChatPage = () => {
  const { user, isLoading, setShowAuthModal } = useAuth();
  const { toast } = useToast();
  
  const vtuberBaseUrl = useMemo(() => {
    const envUrl = (import.meta as any).env?.VITE_VTUBER_URL as
      | string
      | undefined;
    // 기본값은 로컬 서버 포트
    const url =
      envUrl && envUrl.trim().length > 0
        ? envUrl.trim()
        : "https://decomsoft.com/vtuber";
    // 마지막 슬래시 정리
    return url.endsWith("/") ? url.slice(0, -1) : url;
  }, []);

  // VTuber WebSocket 연결 상태
  const [wsConnected, setWsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const maxReconnectAttempts = 5;

  // 채팅 상태
  const [messages, setMessages] = useState<Array<{
    id: string;
    type: 'user' | 'ai' | 'system';
    content: string;
    timestamp: Date;
  }>>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  // 음성 인식 상태 (향후 구현용)
  const [isListening, setIsListening] = useState(false);

  // 메인 UI가 없는 경우(404) 사용자가 직접 주소창에서 /web-tool로 이동할 수 있도록
  const iframeSrc = `${vtuberBaseUrl}/`;

  // 모바일 화면 유지 + 설정(사이드바) 접근용 데스크톱 보기 토글
  const [desktopMode, setDesktopMode] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const desktopWidth = 800; // 내부 앱이 사이드바를 노출하는 기준 폭

  // Discord 레이아웃 내에서 사용될 때는 간단한 레이아웃 사용
  const isInDiscord = window.location.pathname.includes('/discord') || window.location.pathname.includes('/chat');

  // 뷰포트 실측 기반 가용 높이 계산(하단 공백 제거)
  const [containerPxHeight, setContainerPxHeight] = useState<number | null>(
    null,
  );

  // WebSocket 연결 함수
  const connectToVTuber = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN || isConnecting) {
      return;
    }

    setIsConnecting(true);
    
    try {
      // WebSocket URL 생성 (http를 ws로, https를 wss로 변경)
      const wsUrl = vtuberBaseUrl.replace(/^https?:/, vtuberBaseUrl.startsWith('https:') ? 'wss:' : 'ws:') + '/client-ws';
      console.log('VTuber WebSocket 연결 시도:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('VTuber WebSocket 연결 성공');
        setWsConnected(true);
        setIsConnecting(false);
        setConnectionAttempts(0);
        
        // 연결 성공 메시지 추가
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: 'system',
          content: 'AI 아바타와 연결되었습니다. 대화를 시작해보세요!',
          timestamp: new Date()
        }]);

        // 초기화 메시지 전송 (필요한 경우)
        ws.send(JSON.stringify({
          type: 'request-init-config'
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('VTuber 서버로부터 메시지:', data);
          
          // AI 응답 처리
          if (data.type === 'llm-response' || data.type === 'ai-response') {
            setMessages(prev => [...prev, {
              id: Date.now().toString(),
              type: 'ai',
              content: data.text || data.content || '응답을 받았습니다.',
              timestamp: new Date()
            }]);
          }
          
          // 기타 시스템 메시지 처리
          if (data.type === 'system' || data.type === 'status') {
            console.log('시스템 메시지:', data.message || data.content);
          }
        } catch (error) {
          console.error('메시지 파싱 오류:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('VTuber WebSocket 오류:', error);
        setIsConnecting(false);
        
        toast({
          title: "연결 오류",
          description: "AI 아바타 서버에 연결할 수 없습니다.",
          variant: "destructive",
        });
      };

      ws.onclose = (event) => {
        console.log('VTuber WebSocket 연결 종료:', event.code, event.reason);
        setWsConnected(false);
        setIsConnecting(false);
        
        // 자동 재연결 시도 (최대 시도 횟수 제한)
        if (connectionAttempts < maxReconnectAttempts && !event.wasClean) {
          setConnectionAttempts(prev => prev + 1);
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`재연결 시도 ${connectionAttempts + 1}/${maxReconnectAttempts}`);
            connectToVTuber();
          }, 3000 * (connectionAttempts + 1)); // 점진적 지연
        } else if (connectionAttempts >= maxReconnectAttempts) {
          toast({
            title: "연결 실패",
            description: "AI 아바타 서버에 연결할 수 없습니다. 나중에 다시 시도해주세요.",
            variant: "destructive",
          });
          
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            type: 'system',
            content: 'AI 아바타 서버와의 연결이 끊어졌습니다. 페이지를 새로고침해서 다시 시도해주세요.',
            timestamp: new Date()
          }]);
        }
      };

      wsRef.current = ws;
      
    } catch (error) {
      console.error('WebSocket 연결 오류:', error);
      setIsConnecting(false);
      
      toast({
        title: "연결 오류",
        description: "AI 아바타 서버에 연결할 수 없습니다.",
        variant: "destructive",
      });
    }
  }, [vtuberBaseUrl, isConnecting, connectionAttempts, toast]);

  // 메시지 전송 함수
  const sendMessage = useCallback(async () => {
    if (!inputMessage.trim() || !wsConnected || isSending) {
      return;
    }

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      toast({
        title: "연결 오류",
        description: "AI 아바타 서버에 연결되지 않았습니다.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    const messageText = inputMessage.trim();
    
    try {
      // 사용자 메시지 추가
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'user',
        content: messageText,
        timestamp: new Date()
      }]);

      // VTuber 서버로 메시지 전송
      const message = {
        type: 'text-input',
        text: messageText
      };
      
      wsRef.current.send(JSON.stringify(message));
      console.log('메시지 전송:', message);
      
      setInputMessage("");
      
    } catch (error) {
      console.error('메시지 전송 오류:', error);
      toast({
        title: "전송 오류",
        description: "메시지를 전송할 수 없습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  }, [inputMessage, wsConnected, isSending, toast]);

  // Enter 키 처리
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 사용자 로그인 시 WebSocket 연결
  useEffect(() => {
    if (user && !wsConnected && !isConnecting) {
      connectToVTuber();
    }
    
    return () => {
      // 컴포넌트 언마운트 시 연결 정리
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [user, wsConnected, isConnecting, connectToVTuber]);

  useEffect(() => {
    const updateHeight = () => {
      const el = containerRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const vv = (window as any).visualViewport;
      const viewportH = vv?.height ?? window.innerHeight;
      // 약간의 여유 픽셀(스크롤바/경계) 보정
      const padding = 4;
      const next = Math.max(50, Math.floor(viewportH - top - padding));
      setContainerPxHeight(next);
    };

    updateHeight();
    const vv = (window as any).visualViewport;
    vv?.addEventListener("resize", updateHeight);
    vv?.addEventListener("scroll", updateHeight);
    window.addEventListener("resize", updateHeight);
    window.addEventListener("orientationchange", updateHeight);
    return () => {
      vv?.removeEventListener("resize", updateHeight);
      vv?.removeEventListener("scroll", updateHeight);
      window.removeEventListener("resize", updateHeight);
      window.removeEventListener("orientationchange", updateHeight);
    };
  }, []);

  useEffect(() => {
    if (!desktopMode) {
      setScale(1);
      return;
    }
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      const newScale = Math.min(1, width / desktopWidth);
      setScale(newScale);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [desktopMode]);

  // 로딩 중인 경우 로딩 화면 표시
  if (isLoading) {
    return (
      <div className={`${isInDiscord ? 'h-full' : 'min-h-[100dvh]'} w-full ${isInDiscord ? 'bg-gray-600' : 'bg-gradient-to-br from-slate-50 to-blue-50'} flex items-center justify-center`}>
        <Card className="w-full max-w-md mx-4">
          <CardContent className="p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              로딩 중...
            </h3>
            <p className="text-gray-600 text-sm">
              사용자 정보를 확인하고 있습니다.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 로그인되지 않은 경우 로그인 안내 화면 표시
  if (!user) {
    return (
      <div className={`${isInDiscord ? 'h-full' : 'min-h-[100dvh]'} w-full ${isInDiscord ? 'bg-gray-600' : 'bg-gradient-to-br from-slate-50 to-blue-50'} flex items-center justify-center`}>
        <Card className="w-full max-w-md mx-4">
          <CardContent className="p-8 text-center">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <MessageCircle className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              AI 아바타 채팅
            </h2>
            <p className="text-gray-600 mb-6 leading-relaxed">
              AI 아바타와 대화하려면 로그인이 필요합니다.
              <br />
              로그인 후 실시간으로 AI와 음성 및 텍스트 대화를 즐겨보세요.
            </p>
            
            <div className="space-y-4 mb-6">
              <div className="flex items-center text-sm text-gray-500">
                <User className="w-4 h-4 mr-2 text-blue-500" />
                개인화된 대화 경험
              </div>
              <div className="flex items-center text-sm text-gray-500">
                <MessageCircle className="w-4 h-4 mr-2 text-blue-500" />
                실시간 음성 및 텍스트 채팅
              </div>
              <div className="flex items-center text-sm text-gray-500">
                <Lock className="w-4 h-4 mr-2 text-blue-500" />
                안전한 개인 정보 보호
              </div>
            </div>

            <Button
              onClick={() => setShowAuthModal(true)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-base font-medium"
              size="lg"
            >
              로그인하여 시작하기
            </Button>
            
            <p className="text-xs text-gray-500 mt-4">
              구글 또는 카카오 계정으로 간편 로그인
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Discord 레이아웃 내에서 사용될 때는 간단한 레이아웃 사용
  if (isInDiscord) {
    return (
      <div className="flex-1 bg-gray-600 flex flex-col h-full">
        {/* 채널 헤더 */}
        <div className="h-12 bg-gray-600 border-b border-gray-500 flex items-center px-4 shadow-sm">
          <div className="flex items-center">
            <i className="fas fa-hashtag text-gray-300 mr-2"></i>
            <h2 className="text-white font-semibold">아바타-채팅</h2>
          </div>
          <div className="ml-4 text-sm text-gray-300">
            AI 아바타와 실시간으로 대화하는 채널입니다
          </div>
          <div className="ml-auto flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full mr-2 ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-xs text-gray-300">{wsConnected ? '연결됨' : '연결 중...'}</span>
          </div>
        </div>

        {/* 채팅과 아바타를 나란히 배치 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 채팅 인터페이스 */}
          <div className="w-1/2 flex flex-col border-r border-gray-500">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs px-4 py-2 rounded-lg ${
                    msg.type === 'user' 
                      ? 'bg-blue-500 text-white' 
                      : msg.type === 'ai'
                      ? 'bg-gray-200 text-gray-800'
                      : 'bg-yellow-100 text-yellow-800 text-sm'
                  }`}>
                    <p className="text-sm">{msg.content}</p>
                    <p className={`text-xs mt-1 ${
                      msg.type === 'user' ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {msg.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              {isSending && (
                <div className="flex justify-start">
                  <div className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg">
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* 메시지 입력 */}
            <div className="p-4 bg-gray-700 border-t border-gray-500">
              <div className="flex space-x-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="AI 아바타에게 메시지를 보내세요..."
                  disabled={!wsConnected || isSending}
                  className="flex-1 bg-gray-600 border-gray-500 text-white placeholder-gray-400"
                />
                <Button
                  onClick={sendMessage}
                  disabled={!wsConnected || !inputMessage.trim() || isSending}
                  size="sm"
                  className="px-3 bg-blue-600 hover:bg-blue-700"
                >
                  <Send className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => setIsListening(!isListening)}
                  disabled={!wsConnected}
                  size="sm"
                  variant={isListening ? "destructive" : "outline"}
                  className="px-3"
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </Button>
              </div>
              
              {!wsConnected && (
                <div className="mt-2 text-center">
                  <Button
                    onClick={connectToVTuber}
                    disabled={isConnecting}
                    size="sm"
                    variant="outline"
                    className="text-xs"
                  >
                    {isConnecting ? '연결 중...' : '다시 연결'}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* VTuber iframe */}
          <div className="w-1/2 relative bg-white">
            {/* 토글 버튼 */}
            <div className="absolute right-3 top-3 z-10 flex gap-2">
              {!desktopMode ? (
                <button
                  className="px-3 py-1 rounded-md text-xs bg-indigo-600 text-white shadow hover:bg-indigo-700 transition-colors"
                  onClick={() => setDesktopMode(true)}
                >
                  설정 열기
                </button>
              ) : (
                <button
                  className="px-3 py-1 rounded-md text-xs bg-gray-700 text-white shadow hover:bg-gray-800 transition-colors"
                  onClick={() => setDesktopMode(false)}
                >
                  기본 보기
                </button>
              )}
            </div>

            {desktopMode ? (
              <div
                ref={containerRef}
                style={{
                  width: `${desktopWidth}px`,
                  height: `100%`,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }}
              >
                <iframe
                  title="Open-LLM-VTuber"
                  src={iframeSrc}
                  className="w-full h-full border-0 block"
                  allow="microphone; camera; clipboard-read; clipboard-write; autoplay"
                />
              </div>
            ) : (
              <iframe
                title="Open-LLM-VTuber"
                src={iframeSrc}
                className="w-full h-full border-0 block"
                allow="microphone; camera; clipboard-read; clipboard-write; autoplay"
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // 독립적인 페이지로 사용될 때는 원래 레이아웃 사용
  return (
    <div className="min-h-[100dvh] w-full bg-black/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-4 py-1">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-1xl sm:text-1xl font-bold text-gray-800">
            AI 아바타 채팅
          </h2>
          <div className="flex items-center space-x-4">
            <div className="flex items-center text-sm text-gray-600">
              <div className={`w-2 h-2 rounded-full mr-2 ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              {wsConnected ? '연결됨' : '연결 중...'}
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <User className="w-4 h-4 mr-1" />
              {user.displayName || user.email?.split('@')[0] || '사용자'}님
            </div>
          </div>
        </div>
        
        {/* 채팅 인터페이스와 VTuber iframe을 나란히 배치 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ height: "calc(100dvh - 120px - env(safe-area-inset-bottom, 0px))" }}>
          
          {/* 채팅 인터페이스 */}
          <Card className="flex flex-col">
            <CardContent className="flex-1 p-4 flex flex-col">
              <div className="flex-1 overflow-y-auto mb-4 space-y-3 max-h-96">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      msg.type === 'user' 
                        ? 'bg-blue-500 text-white' 
                        : msg.type === 'ai'
                        ? 'bg-gray-200 text-gray-800'
                        : 'bg-yellow-100 text-yellow-800 text-sm'
                    }`}>
                      <p className="text-sm">{msg.content}</p>
                      <p className={`text-xs mt-1 ${
                        msg.type === 'user' ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                        {msg.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
                {isSending && (
                  <div className="flex justify-start">
                    <div className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg">
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* 메시지 입력 */}
              <div className="flex space-x-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="메시지를 입력하세요..."
                  disabled={!wsConnected || isSending}
                  className="flex-1"
                />
                <Button
                  onClick={sendMessage}
                  disabled={!wsConnected || !inputMessage.trim() || isSending}
                  size="sm"
                  className="px-3"
                >
                  <Send className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => setIsListening(!isListening)}
                  disabled={!wsConnected}
                  size="sm"
                  variant={isListening ? "destructive" : "outline"}
                  className="px-3"
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </Button>
              </div>
              
              {!wsConnected && (
                <div className="mt-2 text-center">
                  <Button
                    onClick={connectToVTuber}
                    disabled={isConnecting}
                    size="sm"
                    variant="outline"
                  >
                    {isConnecting ? '연결 중...' : '다시 연결'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* VTuber iframe */}
          <div
            ref={containerRef}
            className="relative rounded-xl shadow border bg-white overflow-hidden"
          >
            {/* 토글 버튼 */}
            <div className="absolute right-3 top-3 z-10 flex gap-2">
              {!desktopMode ? (
                <button
                  className="px-3 py-1 rounded-md text-xs bg-indigo-600 text-white shadow hover:bg-indigo-700 transition-colors"
                  onClick={() => setDesktopMode(true)}
                >
                  설정 열기
                </button>
              ) : (
                <button
                  className="px-3 py-1 rounded-md text-xs bg-gray-700 text-white shadow hover:bg-gray-800 transition-colors"
                  onClick={() => setDesktopMode(false)}
                >
                  기본 보기
                </button>
              )}
            </div>

            {desktopMode ? (
              <div
                style={{
                  width: `${desktopWidth}px`,
                  height: `100%`,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }}
              >
                <iframe
                  title="Open-LLM-VTuber"
                  src={iframeSrc}
                  className="w-full h-full border-0 block"
                  allow="microphone; camera; clipboard-read; clipboard-write; autoplay"
                />
              </div>
            ) : (
              <iframe
                title="Open-LLM-VTuber"
                src={iframeSrc}
                className="w-full h-full border-0 block"
                allow="microphone; camera; clipboard-read; clipboard-write; autoplay"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvatarChatPage;
