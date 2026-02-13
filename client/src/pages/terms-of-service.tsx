import React from "react";
import {
  FileText,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Shield,
  User,
  AlertCircle,
  Scale,
  CheckCircle,
} from "lucide-react";
import Footer from "@/components/footer";
import Navigation from "@/components/navigation";

const TermsOfService: React.FC = () => {
  return (
    <>
      <div className="min-h-screen bg-gray-900 pb-24">
        <div className="max-w-4xl mx-auto px-4 py-12">
          {/* 헤더 */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-green-600 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
                <Scale className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-blue-400 to-indigo-500">
                  이용약관
                </h1>
                <p className="text-gray-300 mt-2">
                  AI아바타세상 서비스 이용약관
                </p>
              </div>
            </div>
            <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 inline-block">
              <p className="text-green-300 font-medium">
                시행일자: 2025년 1월 1일 | 최종 수정일: 2025년 1월 1일
              </p>
            </div>
          </div>

          {/* 메인 콘텐츠 */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-lg p-8 space-y-8">
            {/* 제1조 목적 */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">제1조 (목적)</h2>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
                <p className="text-gray-300 leading-relaxed">
                  이 약관은 디컴소프트(이하 "회사")가 운영하는 AI아바타세상
                  웹사이트(http://aiavatar.decomsoft.com)에서 제공하는 AI 아바타
                  생성, AI 음성 대화 및 관련 서비스(이하 "서비스")를 이용함에
                  있어 회사와 이용자의 권리·의무 및 책임사항을 규정함을 목적으로
                  합니다.
                </p>
              </div>
            </section>

            {/* 제2조 정의 */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">제2조 (정의)</h2>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
                <p className="text-gray-300 mb-4">
                  이 약관에서 사용하는 용어의 정의는 다음과 같습니다.
                </p>
                <div className="space-y-3">
                  <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold text-white mb-2">
                      1. "웹사이트"
                    </h3>
                    <p className="text-gray-300 text-sm">
                      회사가 AI 서비스를 이용자에게 제공하기 위하여 컴퓨터 등
                      정보통신설비를 이용하여 AI 콘텐츠를 생성할 수 있도록
                      설정한 가상의 서비스 공간
                    </p>
                  </div>
                  <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold text-white mb-2">
                      2. "이용자"
                    </h3>
                    <p className="text-gray-300 text-sm">
                      회사의 웹사이트에 접속하여 이 약관에 따라 회사가 제공하는
                      AI 서비스를 받는 회원 및 비회원
                    </p>
                  </div>
                  <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold text-white mb-2">3. "회원"</h3>
                    <p className="text-gray-300 text-sm">
                      회사에 개인정보를 제공하여 회원등록을 한 자로서, 회사의
                      정보를 지속적으로 제공받으며, 회사가 제공하는 AI 서비스를
                      계속적으로 이용할 수 있는 자
                    </p>
                  </div>
                  <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold text-white mb-2">
                      4. "AI 서비스"
                    </h3>
                    <p className="text-gray-300 text-sm">
                      회사가 제공하는 AI 아바타 생성, AI 음성 대화, 이미지 편집,
                      맞춤형 콘텐츠 제작 등의 인공지능 기반 서비스
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* 제3조 약관의 명시와 설명 및 개정 */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-lg flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">
                  제3조 (약관의 명시와 설명 및 개정)
                </h2>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-white mb-2">
                      ① 약관의 명시
                    </h3>
                    <p className="text-gray-300 text-sm">
                      회사는 이 약관의 내용과 상호 및 대표자 성명, 영업소 소재지
                      주소(소비자의 불만을 처리할 수 있는 곳의 주소를 포함),
                      전화번호·모사전송번호·전자우편주소, 사업자등록번호,
                      통신판매업 신고번호, 개인정보보호책임자 등을 이용자가 쉽게
                      알 수 있도록 웹사이트의 초기 서비스화면에 게시합니다.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-2">
                      ② 약관의 개정
                    </h3>
                    <p className="text-gray-300 text-sm">
                      회사는 「약관의 규제에 관한 법률」, 「전자상거래 등에서의
                      소비자보호에 관한 법률」, 「정보통신망 이용촉진 및
                      정보보호 등에 관한 법률」 등 관련 법을 위배하지 않는
                      범위에서 이 약관을 개정할 수 있습니다.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-2">
                      ③ 개정 공지
                    </h3>
                    <p className="text-gray-300 text-sm">
                      회사가 약관을 개정할 경우에는 적용일자 및 개정사유를
                      명시하여 현행약관과 함께 웹사이트의 초기화면에 그 적용일자
                      7일 이전부터 적용일자 전일까지 공지합니다.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* 제4조 서비스의 제공 및 변경 */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">
                  제4조 (서비스의 제공 및 변경)
                </h2>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-white mb-2">
                      ① 제공 서비스
                    </h3>
                    <p className="text-gray-300 text-sm mb-3">
                      회사는 다음과 같은 서비스를 제공합니다.
                    </p>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-gray-300 text-sm">
                          AI 아바타 생성 서비스
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-gray-300 text-sm">
                          AI 음성 대화 및 텍스트 생성
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-gray-300 text-sm">
                          이미지 편집 및 커스터마이징
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-gray-300 text-sm">
                          맞춤형 콘텐츠 제작 지원
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-gray-300 text-sm">
                          고객 지원 및 기술 상담
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-gray-300 text-sm">
                          기타 회사가 정하는 AI 관련 서비스
                        </span>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-2">
                      ② 서비스 변경
                    </h3>
                    <p className="text-gray-300 text-sm">
                      회사는 AI 기술의 업그레이드 또는 기술적 사양의 변경 등의
                      경우에는 제공할 서비스의 내용을 변경할 수 있습니다. 이
                      경우에는 변경된 서비스의 내용 및 제공일자를 명시하여
                      웹사이트를 통해 사전에 공지합니다.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* 제5조 회원가입 */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-pink-500 to-rose-500 rounded-lg flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">
                  제5조 (회원가입)
                </h2>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-white mb-2">
                      ① 가입 신청
                    </h3>
                    <p className="text-gray-300 text-sm">
                      이용자는 회사가 정한 가입 양식에 따라 회원정보를 기입한 후
                      이 약관에 동의한다는 의사표시를 함으로서 회원가입을
                      신청합니다.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-2">
                      ② 가입 승낙
                    </h3>
                    <p className="text-gray-300 text-sm">
                      회사는 제1항과 같이 회원으로 가입할 것을 신청한 이용자 중
                      다음 각 호에 해당하지 않는 한 회원으로 등록합니다.
                    </p>
                    <ul className="mt-2 space-y-1">
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-gray-500 rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-gray-400 text-sm">
                          가입신청자가 이 약관에 의하여 이전에 회원자격을 상실한
                          적이 있는 경우
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-gray-500 rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-gray-400 text-sm">
                          등록 내용에 허위, 기재누락, 오기가 있는 경우
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-gray-500 rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-gray-400 text-sm">
                          기타 회원으로 등록하는 것이 회사의 기술상 현저히
                          지장이 있다고 판단되는 경우
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            {/* 제6조 계약 체결 */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-lg flex items-center justify-center">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">
                  제6조 (계약 체결)
                </h2>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-white mb-2">
                      ① 서비스 이용 신청
                    </h3>
                    <p className="text-gray-300 text-sm">
                      이용자는 회사가 제공하는 AI 서비스를 이용하고자 하는 경우
                      회원가입 후 서비스를 신청할 수 있습니다.
                    </p>
                    <ul className="mt-2 space-y-1">
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-gray-500 rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-gray-400 text-sm">
                          이메일 또는 소셜 계정을 통한 회원가입
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-gray-500 rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-gray-400 text-sm">
                          프로필 정보 입력 (이름, 연락처 등)
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-gray-500 rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-gray-400 text-sm">
                          구독 요금제 선택 (무료/유료)
                        </span>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-2">
                      ② 이용 승낙
                    </h3>
                    <p className="text-gray-300 text-sm">
                      회사는 이용자의 서비스 이용 신청에 대하여 승낙하며,
                      회원가입 완료 시 즉시 서비스를 이용할 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* 제7조 대금결제 */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">
                  제7조 (대금결제)
                </h2>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-white mb-2">
                      ① 결제 방법
                    </h3>
                    <p className="text-gray-300 text-sm mb-3">
                      이용자는 다음 각 호의 방법 중 하나를 선택하여 대금을
                      결제할 수 있습니다.
                    </p>
                    <ul className="space-y-1">
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-gray-500 rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-gray-400 text-sm">계좌이체</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-gray-500 rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-gray-400 text-sm">신용카드</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-gray-500 rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-gray-400 text-sm">
                          온라인무통장입금
                        </span>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-2">
                      ② 세금계산서 발행
                    </h3>
                    <p className="text-gray-300 text-sm">
                      회사는 대금 결제 완료 후 관련 법령에 따라 세금계산서를
                      발행합니다.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* 제8조 회원 탈퇴 및 자격 상실 */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-red-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">
                  제8조 (회원 탈퇴 및 자격 상실)
                </h2>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-white mb-2">
                      ① 회원 탈퇴
                    </h3>
                    <p className="text-gray-300 text-sm">
                      회원은 회사에 언제든지 탈퇴를 요청할 수 있으며 회사는 즉시
                      회원탈퇴를 처리합니다.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-2">
                      ② 자격 상실
                    </h3>
                    <p className="text-gray-300 text-sm mb-3">
                      회사는 회원이 다음 각 호의 사유에 해당하는 경우,
                      회원자격을 제한 또는 정지시킬 수 있습니다.
                    </p>
                    <ul className="space-y-1">
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-gray-500 rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-gray-400 text-sm">
                          가입 신청 시에 허위 내용을 등록한 경우
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-gray-500 rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-gray-400 text-sm">
                          대금 결제를 기일 내에 하지 않거나 부정한 방법으로
                          결제한 경우
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-gray-500 rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-gray-400 text-sm">
                          다른 사람의 서비스 이용을 방해하거나 그 정보를
                          도용하는 등 질서를 위협하는 경우
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-gray-500 rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-gray-400 text-sm">
                          AI 서비스를 이용하여 불법 콘텐츠 생성, 저작권 침해,
                          명예훼손 등 법령 또는 공서양속에 반하는 행위를 하는
                          경우
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            {/* 제9조 개인정보보호 */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
                  <Shield className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">
                  제9조 (개인정보보호)
                </h2>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-white mb-2">
                      ① 개인정보 수집
                    </h3>
                    <p className="text-gray-300 text-sm">
                      회사는 AI 서비스 제공을 위해 필요한 최소한의 개인정보를
                      수집합니다.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-2">
                      ② 개인정보 보호
                    </h3>
                    <p className="text-gray-300 text-sm">
                      회사는 개인정보보호법에 따라 이용자의 개인정보를 보호하며,
                      개인정보처리방침에 따라 개인정보를 처리합니다.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-2">
                      ③ AI 학습 데이터 사용
                    </h3>
                    <p className="text-gray-300 text-sm">
                      회사는 서비스 개선을 위해 익명화된 데이터를 AI 학습에
                      활용할 수 있으며, 이용자의 동의 없이 개인정보를 제3자에게
                      제공하지 않습니다.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* 제10조 회사의 의무 */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">
                  제10조 (회사의 의무)
                </h2>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-white mb-2">
                      ① 서비스 제공
                    </h3>
                    <p className="text-gray-300 text-sm">
                      회사는 AI 서비스를 지속적이고 안정적으로 제공하여야
                      합니다.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-2">
                      ② 고객 지원
                    </h3>
                    <p className="text-gray-300 text-sm">
                      회사는 이용자가 AI 서비스를 원활하게 이용할 수 있도록 고객
                      지원 및 기술 상담을 제공합니다.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-2">
                      ③ 개인정보 보호
                    </h3>
                    <p className="text-gray-300 text-sm">
                      회사는 개인정보보호법 등 관련 법령이 정하는 바에 따라
                      이용자의 개인정보를 보호하기 위한 보안시스템을 구축하며
                      개인정보보호정책을 공시하고 준수합니다.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* 제11조 면책조항 */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-gray-600 to-gray-700 rounded-lg flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">
                  제11조 (면책조항)
                </h2>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-white mb-2">
                      ① 천재지변 등
                    </h3>
                    <p className="text-gray-300 text-sm">
                      회사는 천재지변 또는 이에 준하는 불가항력으로 인하여
                      서비스를 제공할 수 없는 경우에는 서비스 제공에 관한 책임이
                      면제됩니다.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-2">
                      ② 이용자 귀책사유
                    </h3>
                    <p className="text-gray-300 text-sm">
                      회사는 이용자의 귀책사유로 인한 서비스 이용의 장애에
                      대하여는 책임을 지지 않습니다.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-2">
                      ③ 무료 서비스
                    </h3>
                    <p className="text-gray-300 text-sm">
                      회사는 무료로 제공되는 서비스의 이용과 관련하여 관련법에
                      특별한 규정이 없는 한 책임을 지지 않습니다.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* 제12조 준거법 및 관할법원 */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-violet-500 to-purple-500 rounded-lg flex items-center justify-center">
                  <Scale className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">
                  제12조 (준거법 및 관할법원)
                </h2>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-white mb-2">① 준거법</h3>
                    <p className="text-gray-300 text-sm">
                      회사와 이용자 간에 제기된 전자상거래 소송에는 대한민국법을
                      적용합니다.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-2">
                      ② 관할법원
                    </h3>
                    <p className="text-gray-300 text-sm">
                      회사와 이용자 간에 발생한 전자상거래 분쟁에 관한 소송은
                      민사소송법상의 관할법원에 제기합니다.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* 부칙 */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">부칙</h2>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
                <p className="text-gray-300 text-sm">
                  이 약관은 2025년 1월 1일부터 시행됩니다.
                </p>
              </div>
            </section>
          </div>

          {/* 푸터 */}
          <div className="mt-12 text-center">
            <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                문의사항
              </h3>
              <p className="text-gray-400 mb-4">
                이용약관에 대한 문의사항이 있으시면 언제든지 연락주시기
                바랍니다.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-gray-300">055-762-9703</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-gray-300">
                    decom2soft@gmail.com
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-green-400" />
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

export default TermsOfService;
