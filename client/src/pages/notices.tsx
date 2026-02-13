import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, ChevronDown, ChevronUp, ArrowLeft } from "lucide-react";
import Header from "@/components/header";
import Footer from "@/components/footer";
import BottomNavigation from "@/components/bottom-navigation";
import type { Notice } from "@shared/schema";

const NoticesPage = () => {
  const [, setLocation] = useLocation();
  const [expandedNoticeId, setExpandedNoticeId] = useState<number | null>(null);

  // 공지사항 데이터 가져오기
  const { data: notices = [], isLoading } = useQuery<Notice[]>({
    queryKey: ['/api/notices'],
  });

  // 날짜 포맷팅 함수
  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric"
      });
    } catch (e) {
      console.error("날짜 포맷팅 오류:", e);
      return dateString;
    }
  };

  // 아코디언 토글 핸들러
  const toggleNotice = (noticeId: number) => {
    setExpandedNoticeId(expandedNoticeId === noticeId ? null : noticeId);
  };

  // 뒤로 가기 핸들러
  const handleGoBack = () => {
    setLocation('/');
  };

  return (
    <div 
      className="min-h-screen pb-2 relative bg-fixed bg-center bg-cover"
      style={{
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), url('/images/background.png')`,
        backgroundAttachment: 'fixed'
      }}
    >
      <Header />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 뒤로 가기 버튼 */}
        <div className="mb-6">
          <Button
            onClick={handleGoBack}
            variant="ghost"
            className="text-white hover:bg-white/10 flex items-center gap-2"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>뒤로 가기</span>
          </Button>
        </div>

        {/* 페이지 헤더 */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-500 text-white p-4 rounded-full">
              <i className="fas fa-bullhorn text-3xl"></i>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              공지사항
            </span>
          </h1>
          <p className="text-gray-300 text-lg">
            AI아바타 플랫폼의 중요한 소식과 업데이트를 확인하세요
          </p>
        </div>

        {/* 로딩 상태 */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-400"></div>
          </div>
        ) : notices.length > 0 ? (
          /* 공지사항 아코디언 목록 */
          <div className="space-y-4">
            {notices.map((notice) => {
              const isExpanded = expandedNoticeId === notice.id;
              
              return (
                <Card
                  key={notice.id}
                  className="bg-black/40 backdrop-blur-sm border-gray-500/30 hover:border-purple-400/50 transition-all duration-300"
                >
                  {/* 아코디언 헤더 (클릭 가능) */}
                  <div
                    className="cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => toggleNotice(notice.id)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          {/* 제목 및 태그 */}
                          <div className="flex items-center gap-2 mb-3">
                            {notice.title?.includes('중요') && (
                              <span className="inline-block px-3 py-1 bg-red-500 text-white text-xs rounded-full font-semibold">
                                <i className="fas fa-exclamation-circle mr-1"></i>
                                중요
                              </span>
                            )}
                            {notice.title?.toLowerCase().includes('시스템') && (
                              <span className="inline-block px-3 py-1 bg-blue-500 text-white text-xs rounded-full font-semibold">
                                <i className="fas fa-cog mr-1"></i>
                                시스템
                              </span>
                            )}
                            {notice.title?.includes('이벤트') && (
                              <span className="inline-block px-3 py-1 bg-green-500 text-white text-xs rounded-full font-semibold">
                                <i className="fas fa-gift mr-1"></i>
                                이벤트
                              </span>
                            )}
                            {notice.title?.includes('업데이트') && (
                              <span className="inline-block px-3 py-1 bg-purple-500 text-white text-xs rounded-full font-semibold">
                                <i className="fas fa-rocket mr-1"></i>
                                업데이트
                              </span>
                            )}
                          </div>

                          {/* 제목 */}
                          <h3 className="text-xl font-bold text-white mb-2">
                            {notice.title}
                          </h3>

                          {/* 날짜 */}
                          <div className="flex items-center text-gray-400 text-sm">
                            <Calendar className="h-4 w-4 mr-2" />
                            {formatDate(notice.createdAt?.toString() || '')}
                          </div>
                        </div>

                        {/* 확장/축소 아이콘 */}
                        <div className="ml-4 flex items-center text-purple-400">
                          {isExpanded ? (
                            <ChevronUp className="h-6 w-6" />
                          ) : (
                            <ChevronDown className="h-6 w-6" />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </div>

                  {/* 아코디언 내용 (확장 시 표시) */}
                  {isExpanded && (
                    <div className="border-t border-gray-500/30 animate-accordion-down bg-white/5">
                      <CardContent className="p-6">
                        <p className="text-white whitespace-pre-wrap leading-relaxed text-base" style={{ color: '#ffffff' }}>
                          {notice.content}
                        </p>
                      </CardContent>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          /* 공지사항이 없을 때 */
          <Card className="bg-black/40 backdrop-blur-sm border-gray-500/30">
            <CardContent className="py-20">
              <div className="text-center">
                <div className="text-6xl mb-4">📢</div>
                <h3 className="text-2xl font-semibold text-white mb-3">
                  공지사항이 없습니다
                </h3>
                <p className="text-gray-300 mb-6">
                  아직 등록된 공지사항이 없습니다. 나중에 다시 확인해주세요.
                </p>
                <Button
                  onClick={() => setLocation("/")}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                >
                  <i className="fas fa-home mr-2"></i>
                  홈으로 돌아가기
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 하단 안내 */}
        {notices.length > 0 && (
          <div className="mt-8 text-center">
            <p className="text-gray-400 text-sm">
              <i className="fas fa-info-circle mr-2"></i>
              공지사항을 클릭하면 내용이 펼쳐집니다
            </p>
          </div>
        )}

        {/* 뒤로 가기 버튼 (하단) */}
        <div className="mt-8 text-center">
          <Button
            onClick={handleGoBack}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-3 rounded-xl"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            홈으로 돌아가기
          </Button>
        </div>
      </div>

      <Footer />
      <BottomNavigation />

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .line-clamp-2 {
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              overflow: hidden;
            }

            @keyframes accordion-down {
              from {
                opacity: 0;
                max-height: 0;
                overflow: hidden;
              }
              to {
                opacity: 1;
                max-height: 1000px;
                overflow: visible;
              }
            }

            .animate-accordion-down {
              animation: accordion-down 0.3s ease-out;
            }
          `,
        }}
      />
    </div>
  );
};

export default NoticesPage;

