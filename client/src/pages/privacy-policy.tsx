import React from "react";
import {
  Shield,
  Calendar,
  Phone,
  Mail,
  MapPin,
  FileText,
  User,
  Lock,
  Database,
  Eye,
  AlertCircle,
} from "lucide-react";
import Footer from "@/components/footer";
import Navigation from "@/components/navigation";

const PrivacyPolicy: React.FC = () => {
  return (
    <>
      <div className="min-h-screen bg-gray-900 pb-24">
        <div className="max-w-4xl mx-auto px-4 py-12">
          {/* 헤더 */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center shadow-lg">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-purple-500">
                  개인정보처리방침
                </h1>
                <p className="text-gray-300 mt-2">
                  AI아바타세상 개인정보보호 정책
                </p>
              </div>
            </div>
            <div className="bg-purple-900/30 border border-purple-700 rounded-lg p-4 inline-block">
              <p className="text-purple-300 font-medium">
                시행일자: 2025년 1월 1일 | 최종 수정일: 2025년 1월 1일
              </p>
            </div>
          </div>

          {/* 메인 콘텐츠 */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-lg p-8 space-y-8">
            {/* 1. 개인정보의 처리 목적 */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">
                  1. 개인정보의 처리 목적
                </h2>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
                <p className="text-gray-300 mb-4">
                  AI아바타세상('http://aiavatar.decomsoft.com' 이하 '회사')는
                  다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는
                  개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용
                  목적이 변경되는 경우에는 개인정보 보호법 제18조에 따라 별도의
                  동의를 받는 등 필요한 조치를 이행할 예정입니다.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-gray-300">
                      회원 가입 및 관리: 회원 가입의사 확인, 회원제 서비스
                      제공에 따른 본인 식별·인증, 회원자격 유지·관리, 서비스
                      부정이용 방지
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-gray-300">
                      AI 서비스 제공: AI 아바타 생성, 음성 대화, 이미지 편집,
                      맞춤형 콘텐츠 생성 서비스
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-gray-300">
                      결제 및 정산: 서비스 이용료 결제, 환불 처리, 세금계산서
                      발행, 결제 내역 관리
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-gray-300">
                      고객 지원: 문의 사항 처리, 불만 처리, 공지사항 전달,
                      서비스 개선을 위한 피드백 수집
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-gray-300">
                      마케팅 및 광고: 신규 서비스 안내, 맞춤형 서비스 제공,
                      이벤트 및 프로모션 정보 제공
                    </span>
                  </li>
                </ul>
              </div>
            </section>

            {/* 2. 개인정보의 처리 및 보유 기간 */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">
                  2. 개인정보의 처리 및 보유 기간
                </h2>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
                <p className="text-gray-300 mb-4">
                  회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터
                  개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서
                  개인정보를 처리·보유합니다.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full border border-gray-700 rounded-lg">
                    <thead className="bg-gray-900">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300 border-b border-gray-700">
                          처리 목적
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300 border-b border-gray-700">
                          보유 기간
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-4 py-3 text-sm text-gray-300 border-b border-gray-700">
                          회원 가입 및 관리
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300 border-b border-gray-700">
                          회원 탈퇴 시까지
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm text-gray-300 border-b border-gray-700">
                          AI 서비스 제공
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300 border-b border-gray-700">
                          서비스 종료 후 1년
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm text-gray-300 border-b border-gray-700">
                          결제 및 정산
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300 border-b border-gray-700">
                          관련 법령에 따라 5년
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm text-gray-300 border-b border-gray-700">
                          고객 지원
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300 border-b border-gray-700">
                          문의 완료 후 3년
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          마케팅 및 광고
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          동의 철회 시까지
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* 3. 개인정보의 제3자 제공 */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-lg flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">
                  3. 개인정보의 제3자 제공
                </h2>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
                <p className="text-gray-300 mb-4">
                  회사는 원칙적으로 정보주체의 개인정보를 수집·이용 목적으로
                  명시한 범위 내에서 처리하며, 정보주체의 사전 동의 없이는
                  본래의 목적 범위를 초과하여 처리하거나 제3자에게 제공하지
                  않습니다.
                </p>
                <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-yellow-300 font-medium mb-1">
                        예외사항
                      </p>
                      <ul className="text-yellow-300/80 text-sm space-y-1">
                        <li>• 정보주체로부터 별도의 동의를 받은 경우</li>
                        <li>
                          • 법률에 특별한 규정이 있거나 법령상 의무를 준수하기
                          위하여 불가피한 경우
                        </li>
                        <li>
                          • 정보주체 또는 그 법정대리인이 의사표시를 할 수 없는
                          상태에 있거나 주소불명 등으로 사전 동의를 받을 수 없는
                          경우
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 4. 개인정보처리의 위탁 */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                  <Database className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">
                  4. 개인정보처리의 위탁
                </h2>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
                <p className="text-gray-300 mb-4">
                  회사는 원활한 개인정보 업무처리를 위하여 다음과 같이 개인정보
                  처리업무를 위탁하고 있습니다.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full border border-gray-700 rounded-lg">
                    <thead className="bg-gray-900">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300 border-b border-gray-700">
                          위탁받는 자
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300 border-b border-gray-700">
                          위탁하는 업무의 내용
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-4 py-3 text-sm text-gray-300 border-b border-gray-700">
                          AWS
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300 border-b border-gray-700">
                          클라우드 서비스 및 데이터 저장
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm text-gray-300 border-b border-gray-700">
                          OpenAI
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300 border-b border-gray-700">
                          AI 음성 및 이미지 생성 서비스
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          포트원(PortOne)
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          결제 서비스 및 결제 정보 처리
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* 5. 정보주체의 권리·의무 */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-pink-500 to-rose-500 rounded-lg flex items-center justify-center">
                  <Eye className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">
                  5. 정보주체의 권리·의무
                </h2>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
                <p className="text-gray-300 mb-4">
                  정보주체는 회사에 대해 언제든지 다음 각 호의 개인정보 보호
                  관련 권리를 행사할 수 있습니다.
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold text-white mb-2">
                      행사 가능한 권리
                    </h3>
                    <ul className="text-sm text-gray-300 space-y-1">
                      <li>• 개인정보 처리현황 통지요구</li>
                      <li>• 개인정보 열람요구</li>
                      <li>• 개인정보 정정·삭제요구</li>
                      <li>• 개인정보 처리정지요구</li>
                    </ul>
                  </div>
                  <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold text-white mb-2">
                      권리 행사 방법
                    </h3>
                    <ul className="text-sm text-gray-300 space-y-1">
                      <li>• 개인정보 보호법 시행규칙 별지 제8호에 따라 작성</li>
                      <li>
                        • 서면, 전자우편, 모사전송(FAX) 등을 통하여 하실 수 있음
                      </li>
                      <li>• 회사는 지체 없이 조치하겠습니다</li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            {/* 6. 개인정보의 안전성 확보 조치 */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-red-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <Lock className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">
                  6. 개인정보의 안전성 확보 조치
                </h2>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
                <p className="text-gray-300 mb-4">
                  회사는 개인정보보호법 제29조에 따라 다음과 같이 안전성 확보에
                  필요한 기술적/관리적 및 물리적 조치를 하고 있습니다.
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold text-white mb-2">
                      기술적 조치
                    </h3>
                    <ul className="text-sm text-gray-300 space-y-1">
                      <li>• 개인정보처리시스템 등의 접근권한 관리</li>
                      <li>• 개인정보의 암호화</li>
                      <li>• 해킹 등에 대비한 기술적 대책</li>
                      <li>
                        • 개인정보처리시스템 접속기록의 보관 및 위변조 방지
                      </li>
                    </ul>
                  </div>
                  <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold text-white mb-2">
                      관리적 조치
                    </h3>
                    <ul className="text-sm text-gray-300 space-y-1">
                      <li>• 개인정보 취급직원의 최소화 및 교육</li>
                      <li>• 개인정보 보호책임자 등의 지정</li>
                      <li>• 정기적인 자체 감사 실시</li>
                      <li>• 개인정보 취급규정의 수립 및 시행</li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            {/* 7. 개인정보 보호책임자 */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-lg flex items-center justify-center">
                  <Phone className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">
                  7. 개인정보 보호책임자
                </h2>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
                <p className="text-gray-300 mb-4">
                  회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보
                  처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여
                  아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
                </p>
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-semibold text-white mb-3">
                        개인정보 보호책임자
                      </h3>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-300">
                            성명: 김영철
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-300">
                            연락처: 055-762-9703
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-300">
                            이메일: decom2soft@gmail.com
                          </span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-3">
                        개인정보 보호 담당부서
                      </h3>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-300">
                            부서명: 개발팀
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-300">
                            연락처: 055-762-9703
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-300">
                            이메일: decom2soft@gmail.com
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 8. 개인정보 처리방침 변경 */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-violet-500 to-purple-500 rounded-lg flex items-center justify-center">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">
                  8. 개인정보 처리방침 변경
                </h2>
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
                <p className="text-gray-300 mb-4">
                  이 개인정보처리방침은 시행일로부터 적용되며, 법령 및 방침에
                  따른 변경내용의 추가, 삭제 및 정정이 있는 경우에는 변경사항의
                  시행 7일 전부터 공지사항을 통하여 고지할 것입니다.
                </p>
                <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <Calendar className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-blue-300 font-medium mb-1">
                        개인정보처리방침 버전
                      </p>
                      <p className="text-blue-300/80 text-sm">
                        현재 버전: v1.0 (2025.01.01 시행)
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
              <h3 className="text-lg font-semibold text-white mb-4">
                문의사항
              </h3>
              <p className="text-gray-400 mb-4">
                개인정보 처리방침에 대한 문의사항이 있으시면 언제든지 연락주시기
                바랍니다.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-gray-300">055-762-9703</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-gray-300">
                    decom2soft@gmail.com
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-purple-400" />
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

export default PrivacyPolicy;
