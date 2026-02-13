import React from 'react';
import { Cookie, Calendar, Phone, Mail, MapPin, Settings, AlertCircle, Shield, Eye } from 'lucide-react';
import Footer from '@/components/footer';
import Navigation from '@/components/navigation';

const CookiePolicy: React.FC = () => {
  return (
    <>
      <div className="min-h-screen bg-gray-900 pb-24">
        <div className="max-w-4xl mx-auto px-4 py-12">
        {/* 헤더 */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-600 to-yellow-600 rounded-full flex items-center justify-center shadow-lg">
              <Cookie className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-yellow-400 to-amber-500">
                쿠키 정책
              </h1>
              <p className="text-gray-300 mt-2">AI아바타세상 쿠키 사용 정책</p>
            </div>
          </div>
          <div className="bg-orange-900/30 border border-orange-700 rounded-lg p-4 inline-block">
            <p className="text-orange-300 font-medium">
              시행일자: 2025년 1월 1일 | 최종 수정일: 2025년 1월 1일
            </p>
          </div>
        </div>

        {/* 메인 콘텐츠 */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-lg p-8 space-y-8">
          {/* 1. 쿠키란 무엇인가요? */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-lg flex items-center justify-center">
                <Cookie className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white">1. 쿠키란 무엇인가요?</h2>
            </div>
            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
              <p className="text-gray-300 mb-4 leading-relaxed">
                쿠키(Cookie)는 웹사이트를 방문할 때 브라우저에 저장되는 작은 텍스트 파일입니다. 
                쿠키는 웹사이트가 사용자의 브라우저를 인식하고, 사용자의 선호도를 기억하며, 
                개인화된 경험을 제공하는 데 도움을 줍니다.
              </p>
              <div className="bg-orange-900/30 border border-orange-700 rounded-lg p-4">
                <h3 className="font-semibold text-orange-300 mb-2">쿠키의 특징</h3>
                <ul className="text-orange-300/80 text-sm space-y-1">
                  <li>• 사용자의 컴퓨터나 모바일 기기에 저장되는 작은 파일</li>
                  <li>• 웹사이트 방문 시 자동으로 생성되거나 삭제됨</li>
                  <li>• 개인정보를 직접 식별하지 않음</li>
                  <li>• 사용자가 언제든지 삭제하거나 차단할 수 있음</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 2. AI아바타세상의 쿠키 사용 목적 */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                <Settings className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white">2. AI아바타세상의 쿠키 사용 목적</h2>
            </div>
            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
              <p className="text-gray-300 mb-4">
                AI아바타세상은 다음과 같은 목적으로 쿠키를 사용합니다:
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-2">필수적 기능</h3>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• 로그인 상태 유지</li>
                    <li>• 보안 기능 제공</li>
                    <li>• 웹사이트 기본 기능 작동</li>
                    <li>• 언어 설정 기억</li>
                  </ul>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-2">성능 및 분석</h3>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• 웹사이트 성능 모니터링</li>
                    <li>• 사용자 행동 분석</li>
                    <li>• 오류 진단 및 해결</li>
                    <li>• AI 서비스 개선</li>
                  </ul>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-2">개인화</h3>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• 맞춤형 AI 아바타 추천</li>
                    <li>• 사용자 선호도 기억</li>
                    <li>• 아바타 설정값 저장</li>
                    <li>• 인터페이스 개인화</li>
                  </ul>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-2">마케팅</h3>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• AI 서비스 정보 제공</li>
                    <li>• 마케팅 효과 측정</li>
                    <li>• 업데이트 알림</li>
                    <li>• 이벤트 정보 제공</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* 3. 쿠키의 종류 */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-lg flex items-center justify-center">
                <Eye className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white">3. 쿠키의 종류</h2>
            </div>
            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
              <div className="space-y-6">
                {/* 지속 기간별 분류 */}
                <div>
                  <h3 className="font-semibold text-white mb-3">지속 기간별 분류</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border border-gray-700 rounded-lg">
                      <thead className="bg-gray-900">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-300 border-b border-gray-700">쿠키 유형</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-300 border-b border-gray-700">설명</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-300 border-b border-gray-700">보존 기간</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="px-4 py-3 text-sm text-gray-300 border-b border-gray-700 font-medium">세션 쿠키</td>
                          <td className="px-4 py-3 text-sm text-gray-300 border-b border-gray-700">브라우저 세션 동안만 유지</td>
                          <td className="px-4 py-3 text-sm text-gray-300 border-b border-gray-700">브라우저 종료 시 삭제</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 text-sm text-gray-300 font-medium">영구 쿠키</td>
                          <td className="px-4 py-3 text-sm text-gray-300">설정된 기간까지 유지</td>
                          <td className="px-4 py-3 text-sm text-gray-300">최대 2년</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 기능별 분류 */}
                <div>
                  <h3 className="font-semibold text-white mb-3">기능별 분류</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-gray-800 border border-green-700 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <h4 className="font-semibold text-white">필수 쿠키</h4>
                      </div>
                      <p className="text-sm text-gray-300 mb-2">웹사이트 기본 기능에 필요한 쿠키</p>
                      <p className="text-xs text-green-400">사용자 동의 없이 사용됩니다.</p>
                    </div>
                    <div className="bg-gray-800 border border-blue-700 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <h4 className="font-semibold text-white">기능 쿠키</h4>
                      </div>
                      <p className="text-sm text-gray-300 mb-2">향상된 기능 제공을 위한 쿠키</p>
                      <p className="text-xs text-blue-400">사용자 동의 후 사용됩니다.</p>
                    </div>
                    <div className="bg-gray-800 border border-purple-700 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                        <h4 className="font-semibold text-white">분석 쿠키</h4>
                      </div>
                      <p className="text-sm text-gray-300 mb-2">웹사이트 사용 분석을 위한 쿠키</p>
                      <p className="text-xs text-purple-400">사용자 동의 후 사용됩니다.</p>
                    </div>
                    <div className="bg-gray-800 border border-orange-700 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                        <h4 className="font-semibold text-white">마케팅 쿠키</h4>
                      </div>
                      <p className="text-sm text-gray-300 mb-2">맞춤형 정보 제공을 위한 쿠키</p>
                      <p className="text-xs text-orange-400">사용자 동의 후 사용됩니다.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 4. 사용 중인 쿠키 목록 */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                <Settings className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white">4. 사용 중인 쿠키 목록</h2>
            </div>
            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
              <div className="overflow-x-auto">
                <table className="w-full border border-gray-700 rounded-lg">
                  <thead className="bg-gray-900">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-300 border-b border-gray-700">쿠키명</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-300 border-b border-gray-700">목적</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-300 border-b border-gray-700">유형</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-300 border-b border-gray-700">보존기간</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-4 py-3 text-sm text-gray-300 border-b border-gray-700 font-mono">ai_session</td>
                      <td className="px-4 py-3 text-sm text-gray-300 border-b border-gray-700">AI 서비스 로그인 세션 유지</td>
                      <td className="px-4 py-3 text-sm text-gray-300 border-b border-gray-700">
                        <span className="bg-green-900/50 text-green-300 px-2 py-1 rounded text-xs border border-green-700">필수</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300 border-b border-gray-700">세션</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm text-gray-300 border-b border-gray-700 font-mono">csrf_token</td>
                      <td className="px-4 py-3 text-sm text-gray-300 border-b border-gray-700">보안 토큰 저장</td>
                      <td className="px-4 py-3 text-sm text-gray-300 border-b border-gray-700">
                        <span className="bg-green-900/50 text-green-300 px-2 py-1 rounded text-xs border border-green-700">필수</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300 border-b border-gray-700">세션</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm text-gray-300 border-b border-gray-700 font-mono">lang_preference</td>
                      <td className="px-4 py-3 text-sm text-gray-300 border-b border-gray-700">사용자 언어 설정</td>
                      <td className="px-4 py-3 text-sm text-gray-300 border-b border-gray-700">
                        <span className="bg-blue-900/50 text-blue-300 px-2 py-1 rounded text-xs border border-blue-700">기능</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300 border-b border-gray-700">1년</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm text-gray-300 border-b border-gray-700 font-mono">user_settings</td>
                      <td className="px-4 py-3 text-sm text-gray-300 border-b border-gray-700">AI 서비스 개인화 설정</td>
                      <td className="px-4 py-3 text-sm text-gray-300 border-b border-gray-700">
                        <span className="bg-blue-900/50 text-blue-300 px-2 py-1 rounded text-xs border border-blue-700">기능</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300 border-b border-gray-700">6개월</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm text-gray-300 border-b border-gray-700 font-mono">_ga</td>
                      <td className="px-4 py-3 text-sm text-gray-300 border-b border-gray-700">Google Analytics 사용자 구분</td>
                      <td className="px-4 py-3 text-sm text-gray-300 border-b border-gray-700">
                        <span className="bg-purple-900/50 text-purple-300 px-2 py-1 rounded text-xs border border-purple-700">분석</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300 border-b border-gray-700">2년</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm text-gray-300 font-mono">marketing_consent</td>
                      <td className="px-4 py-3 text-sm text-gray-300">마케팅 정보 수신 동의</td>
                      <td className="px-4 py-3 text-sm text-gray-300">
                        <span className="bg-orange-900/50 text-orange-300 px-2 py-1 rounded text-xs border border-orange-700">마케팅</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">1년</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* 5. 쿠키 관리 방법 */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-r from-red-500 to-pink-500 rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white">5. 쿠키 관리 방법</h2>
            </div>
            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
              <div className="space-y-6">
                {/* 브라우저별 설정 */}
                <div>
                  <h3 className="font-semibold text-white mb-3">브라우저별 쿠키 설정 방법</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                      <h4 className="font-semibold text-white mb-2">Chrome</h4>
                      <ol className="text-sm text-gray-300 space-y-1">
                        <li>1. 설정 → 개인정보 및 보안</li>
                        <li>2. 쿠키 및 기타 사이트 데이터</li>
                        <li>3. 원하는 설정 선택</li>
                      </ol>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                      <h4 className="font-semibold text-white mb-2">Firefox</h4>
                      <ol className="text-sm text-gray-300 space-y-1">
                        <li>1. 옵션 → 개인정보 및 보안</li>
                        <li>2. 쿠키 및 사이트 데이터</li>
                        <li>3. 설정 관리</li>
                      </ol>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                      <h4 className="font-semibold text-white mb-2">Safari</h4>
                      <ol className="text-sm text-gray-300 space-y-1">
                        <li>1. 환경설정 → 개인정보</li>
                        <li>2. 쿠키 및 웹사이트 데이터</li>
                        <li>3. 차단 설정 선택</li>
                      </ol>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                      <h4 className="font-semibold text-white mb-2">Edge</h4>
                      <ol className="text-sm text-gray-300 space-y-1">
                        <li>1. 설정 → 쿠키 및 사이트 권한</li>
                        <li>2. 쿠키 및 저장된 데이터</li>
                        <li>3. 차단 또는 허용 설정</li>
                      </ol>
                    </div>
                  </div>
                </div>

                {/* 쿠키 동의 관리 */}
                <div>
                  <h3 className="font-semibold text-white mb-3">쿠키 동의 관리</h3>
                  <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-300 mb-3">
                      AI아바타세상 웹사이트에서는 쿠키 동의 설정을 언제든지 변경할 수 있습니다.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                        쿠키 설정 관리
                      </button>
                      <button className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                        모든 쿠키 거부
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 6. 쿠키 거부 시 영향 */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white">6. 쿠키 거부 시 영향</h2>
            </div>
            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
              <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-yellow-300 font-medium mb-1">중요 안내</p>
                    <p className="text-yellow-300/80 text-sm">
                      쿠키를 거부하시면 일부 서비스 이용에 제한이 있을 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                  <h3 className="font-semibold text-red-400 mb-2">제한되는 기능</h3>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• 자동 로그인 기능</li>
                    <li>• 개인화된 AI 아바타 추천</li>
                    <li>• 언어 설정 기억</li>
                    <li>• 맞춤형 콘텐츠 제공</li>
                    <li>• 사용성 개선 기능</li>
                  </ul>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                  <h3 className="font-semibold text-green-400 mb-2">정상 이용 가능</h3>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• AI 서비스 기본 기능</li>
                    <li>• 아바타 생성 및 콘텐츠 확인</li>
                    <li>• 고객지원 서비스</li>
                    <li>• 기본적인 웹사이트 이용</li>
                    <li>• 문의 및 상담 요청</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* 7. 개인정보보호 */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white">7. 개인정보보호</h2>
            </div>
            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-white mb-2">① 데이터 보안</h3>
                  <p className="text-gray-300 text-sm">
                    AI아바타세상은 쿠키를 통해 수집된 정보를 안전하게 보호하며, 
                    업계 표준 보안 조치를 적용하여 무단 접근을 방지합니다.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-2">② 제3자 공유</h3>
                  <p className="text-gray-300 text-sm">
                    쿠키를 통해 수집된 정보는 법적 요구사항이 있는 경우를 제외하고 
                    제3자와 공유되지 않습니다.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-2">③ 데이터 보존</h3>
                  <p className="text-gray-300 text-sm">
                    쿠키 데이터는 설정된 보존 기간이 만료되거나 사용자가 삭제할 때까지만 보관됩니다.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 8. 정책 변경 */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-lg flex items-center justify-center">
                <Calendar className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white">8. 정책 변경</h2>
            </div>
            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-white mb-2">① 변경 통지</h3>
                  <p className="text-gray-300 text-sm">
                    이 쿠키 정책이 변경되는 경우, 변경사항은 웹사이트에 게시되며 
                    중요한 변경사항의 경우 별도 통지를 실시합니다.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-2">② 시행일</h3>
                  <p className="text-gray-300 text-sm">
                    변경된 정책은 웹사이트에 게시된 날로부터 7일 후에 시행됩니다.
                  </p>
                </div>
              </div>
              <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 mt-4">
                <div className="flex items-start gap-2">
                  <Calendar className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-blue-300 font-medium mb-1">현재 정책 버전</p>
                    <p className="text-blue-300/80 text-sm">
                      버전: v1.0 | 시행일: 2025년 1월 1일
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* 푸터 */}
        <div className="mt-12 text-center">
          <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">문의사항</h3>
            <p className="text-gray-400 mb-4">
              쿠키 정책에 대한 문의사항이 있으시면 언제든지 연락주시기 바랍니다.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-orange-400" />
                <span className="text-sm text-gray-300">055-762-9703</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-orange-400" />
                <span className="text-sm text-gray-300">decom2soft@gmail.com</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-orange-400" />
                <span className="text-sm text-gray-300">경남 진주시</span>
              </div>
            </div>
          </div>
        </div>
        </div>
        <Footer />
      </div>
      <Navigation />
    </>
  );
};

export default CookiePolicy;
