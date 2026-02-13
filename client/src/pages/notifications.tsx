import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Bell, 
  BellRing, 
  Mail, 
  MessageSquare, 
  Calendar,
  Shield,
  Settings
} from "lucide-react";

interface NotificationSettings {
  pushNotifications: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  bookingReminders: boolean;
  serviceUpdates: boolean;
  promotions: boolean;
  newMessages: boolean;
  systemAlerts: boolean;
  weeklyReport: boolean;
  marketingEmails: boolean;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // 알림 설정 상태 (기본값)
  const [settings, setSettings] = useState<NotificationSettings>({
    pushNotifications: true,
    emailNotifications: true,
    smsNotifications: false,
    bookingReminders: true,
    serviceUpdates: true,
    promotions: false,
    newMessages: true,
    systemAlerts: true,
    weeklyReport: false,
    marketingEmails: false,
  });

  const [isSaving, setIsSaving] = useState(false);

  // 설정 저장 뮤테이션
  const saveSettingsMutation = useMutation({
    mutationFn: async (newSettings: NotificationSettings) => {
      // 실제 API 호출로 대체 예정
      await new Promise(resolve => setTimeout(resolve, 1000));
      return newSettings;
    },
    onSuccess: () => {
      toast({
        title: "설정 저장 완료",
        description: "알림 설정이 성공적으로 저장되었습니다.",
      });
      setIsSaving(false);
    },
    onError: () => {
      toast({
        title: "설정 저장 실패",
        description: "설정 저장 중 오류가 발생했습니다.",
        variant: "destructive",
      });
      setIsSaving(false);
    }
  });

  const handleSettingChange = (key: keyof NotificationSettings, value: boolean) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSaveSettings = () => {
    setIsSaving(true);
    saveSettingsMutation.mutate(settings);
  };

  const handleResetSettings = () => {
    setSettings({
      pushNotifications: true,
      emailNotifications: true,
      smsNotifications: false,
      bookingReminders: true,
      serviceUpdates: true,
      promotions: false,
      newMessages: true,
      systemAlerts: true,
      weeklyReport: false,
      marketingEmails: false,
    });
    toast({
      title: "설정 초기화",
      description: "알림 설정이 기본값으로 초기화되었습니다.",
    });
  };

  if (!user) {
    setLocation('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* 헤더 */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => setLocation('/profile')}
          className="mb-4 text-white hover:text-gray-300"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          마이페이지로 돌아가기
        </Button>

        <div className="flex items-center gap-3 mb-2">
          <Bell className="h-6 w-6 text-purple-600" />
          <h1 className="text-2xl font-bold text-white">알림 설정</h1>
        </div>
        <p className="text-gray-400">작품 제작 완성 알림 및 플랫폼 소식 설정을 관리할 수 있습니다.</p>
      </div>

      <div className="space-y-6">
        {/* 알림 방식 설정 */}
        <Card className="bg-gray-800/70 border-gray-600/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <BellRing className="h-5 w-5 text-blue-400" />
              알림 방식
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="push" className="text-sm font-medium text-white">
                  푸시 알림
                </Label>
                <p className="text-xs text-gray-400">
                  앱을 통한 실시간 푸시 알림을 받습니다
                </p>
              </div>
              <Switch
                id="push"
                checked={settings.pushNotifications}
                onCheckedChange={(checked) => handleSettingChange('pushNotifications', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="email" className="text-sm font-medium text-white">
                  이메일 알림
                </Label>
                <p className="text-xs text-gray-400">
                  등록된 이메일로 알림을 받습니다
                </p>
              </div>
              <Switch
                id="email"
                checked={settings.emailNotifications}
                onCheckedChange={(checked) => handleSettingChange('emailNotifications', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="sms" className="text-sm font-medium text-white">
                  SMS 알림
                </Label>
                <p className="text-xs text-gray-400">
                  등록된 전화번호로 문자 알림을 받습니다
                </p>
              </div>
              <Switch
                id="sms"
                checked={settings.smsNotifications}
                onCheckedChange={(checked) => handleSettingChange('smsNotifications', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* 서비스 알림 설정 */}
        <Card className="bg-gray-800/70 border-gray-600/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Calendar className="h-5 w-5 text-green-400" />
              서비스 알림
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="bookingReminders" className="text-sm font-medium text-white">
                  작품 완성 알림
                </Label>
                <p className="text-xs text-gray-400">
                  의뢰한 아바타 작품 완성 시 알림을 받습니다
                </p>
              </div>
              <Switch
                id="bookingReminders"
                checked={settings.bookingReminders}
                onCheckedChange={(checked) => handleSettingChange('bookingReminders', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="serviceUpdates" className="text-sm font-medium text-white">
                  플랫폼 업데이트
                </Label>
                <p className="text-xs text-gray-400">
                  새로운 AI 아바타나 기능 업데이트 소식을 받습니다
                </p>
              </div>
              <Switch
                id="serviceUpdates"
                checked={settings.serviceUpdates}
                onCheckedChange={(checked) => handleSettingChange('serviceUpdates', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="newMessages" className="text-sm font-medium text-white">
                  새 메시지
                </Label>
                <p className="text-xs text-gray-400">
                  AI 크리에이터로부터 새 메시지가 도착했을 때 알림을 받습니다
                </p>
              </div>
              <Switch
                id="newMessages"
                checked={settings.newMessages}
                onCheckedChange={(checked) => handleSettingChange('newMessages', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* 시스템 알림 설정 */}
        <Card className="bg-gray-800/70 border-gray-600/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Shield className="h-5 w-5 text-red-400" />
              시스템 알림
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="systemAlerts" className="text-sm font-medium text-white">
                  시스템 알림
                </Label>
                <p className="text-xs text-gray-400">
                  보안, 결제, 중요 시스템 관련 알림을 받습니다
                </p>
              </div>
              <Switch
                id="systemAlerts"
                checked={settings.systemAlerts}
                onCheckedChange={(checked) => handleSettingChange('systemAlerts', checked)}
                disabled
              />
            </div>
            <p className="text-xs text-gray-500">
              * 시스템 알림은 보안상 필수 알림으로 비활성화할 수 없습니다.
            </p>
          </CardContent>
        </Card>

        {/* 마케팅 알림 설정 */}
        <Card className="bg-gray-800/70 border-gray-600/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Mail className="h-5 w-5 text-purple-400" />
              마케팅 알림
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="promotions" className="text-sm font-medium text-white">
                  프로모션 및 할인
                </Label>
                <p className="text-xs text-gray-400">
                  특별 할인이나 프로모션 정보를 받습니다
                </p>
              </div>
              <Switch
                id="promotions"
                checked={settings.promotions}
                onCheckedChange={(checked) => handleSettingChange('promotions', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="weeklyReport" className="text-sm font-medium text-white">
                  주간 리포트
                </Label>
                <p className="text-xs text-gray-400">
                  일주일간의 AI 아바타 이용 현황을 요약해서 받습니다
                </p>
              </div>
              <Switch
                id="weeklyReport"
                checked={settings.weeklyReport}
                onCheckedChange={(checked) => handleSettingChange('weeklyReport', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="marketingEmails" className="text-sm font-medium text-white">
                  마케팅 이메일
                </Label>
                <p className="text-xs text-gray-400">
                  새 아바타 출시나 이벤트 소식을 이메일로 받습니다
                </p>
              </div>
              <Switch
                id="marketingEmails"
                checked={settings.marketingEmails}
                onCheckedChange={(checked) => handleSettingChange('marketingEmails', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* 저장 버튼 */}
        <div className="flex gap-4 pt-4">
          <Button 
            onClick={handleSaveSettings}
            disabled={isSaving || saveSettingsMutation.isPending}
            className="flex-1"
          >
            {isSaving || saveSettingsMutation.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                저장 중...
              </>
            ) : (
              <>
                <Settings className="h-4 w-4 mr-2" />
                설정 저장
              </>
            )}
          </Button>
          
          <Button 
            variant="default"
            onClick={handleResetSettings}
            disabled={isSaving || saveSettingsMutation.isPending}
          >
            초기화
          </Button>
        </div>

        {/* 안내사항 */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Bell className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900 mb-1">알림 설정 안내</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• 시스템 알림은 보안과 안전을 위해 필수적으로 받게 됩니다.</li>
                  <li>• 작품 완성 알림을 끄면 중요한 완성 소식을 놓칠 수 있습니다.</li>
                  <li>• 마케팅 알림은 언제든지 수신 거부할 수 있습니다.</li>
                  <li>• 설정 변경 후 반드시 '설정 저장' 버튼을 눌러주세요.</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
     </div>
  );
} 