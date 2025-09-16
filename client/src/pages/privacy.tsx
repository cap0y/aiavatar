import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Shield, 
  Eye, 
  EyeOff, 
  Download, 
  Trash2,
  AlertTriangle,
  Lock,
  Database,
  UserCheck,
  Settings
} from "lucide-react";

interface PrivacySettings {
  profileVisible: boolean;
  showLocation: boolean;
  allowDataCollection: boolean;
  allowMarketingData: boolean;
  twoFactorAuth: boolean;
}

export default function PrivacyPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // 개인정보 설정 상태
  const [settings, setSettings] = useState<PrivacySettings>({
    profileVisible: true,
    showLocation: true,
    allowDataCollection: false,
    allowMarketingData: false,
    twoFactorAuth: false,
  });

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 설정 저장 뮤테이션
  const saveSettingsMutation = useMutation({
    mutationFn: async (newSettings: PrivacySettings) => {
      // 실제 API 호출로 대체 예정
      await new Promise(resolve => setTimeout(resolve, 1000));
      return newSettings;
    },
    onSuccess: () => {
      toast({
        title: "설정 저장 완료",
        description: "개인정보 보호 설정이 성공적으로 저장되었습니다.",
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

  // 데이터 다운로드 뮤테이션
  const downloadDataMutation = useMutation({
    mutationFn: async () => {
      // 실제 API 호출로 대체 예정
      await new Promise(resolve => setTimeout(resolve, 2000));
      return true;
    },
    onSuccess: () => {
      toast({
        title: "데이터 다운로드 완료",
        description: "개인정보가 포함된 파일이 다운로드되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "데이터 다운로드 실패",
        description: "데이터 다운로드 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  });

  // 계정 삭제 뮤테이션
  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      // 실제 API 호출로 대체 예정
      await new Promise(resolve => setTimeout(resolve, 2000));
      return true;
    },
    onSuccess: () => {
      toast({
        title: "계정 삭제 요청 완료",
        description: "계정 삭제 요청이 접수되었습니다. 7일 내에 처리됩니다.",
      });
      setShowDeleteDialog(false);
      // 로그아웃 처리
      setTimeout(() => {
        setLocation('/');
      }, 2000);
    },
    onError: () => {
      toast({
        title: "계정 삭제 실패",
        description: "계정 삭제 요청 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  });

  const handleSettingChange = (key: keyof PrivacySettings, value: boolean) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSaveSettings = () => {
    setIsSaving(true);
    saveSettingsMutation.mutate(settings);
  };

  const handleDownloadData = () => {
    downloadDataMutation.mutate();
  };

  const handleDeleteAccount = () => {
    deleteAccountMutation.mutate();
  };

  if (!user) {
    setLocation('/');
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* 헤더 */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => setLocation('/profile')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          마이페이지로 돌아가기
        </Button>

        <div className="flex items-center gap-3 mb-2">
          <Shield className="h-6 w-6 text-green-600" />
          <h1 className="text-2xl font-bold text-gray-800">개인정보 보호</h1>
        </div>
        <p className="text-gray-600">개인정보 보호 설정과 데이터 관리를 할 수 있습니다.</p>
      </div>

      <div className="space-y-6">
        {/* 프로필 공개 설정 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-600" />
              프로필 공개 설정
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="profileVisible" className="text-sm font-medium">
                  프로필 공개
                </Label>
                <p className="text-xs text-gray-500">
                  다른 사용자가 내 프로필을 볼 수 있습니다
                </p>
              </div>
              <Switch
                id="profileVisible"
                checked={settings.profileVisible}
                onCheckedChange={(checked) => handleSettingChange('profileVisible', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="showLocation" className="text-sm font-medium">
                  위치 정보 공개
                </Label>
                <p className="text-xs text-gray-500">
                  케어 매니저가 내 위치를 확인할 수 있습니다
                </p>
              </div>
              <Switch
                id="showLocation"
                checked={settings.showLocation}
                onCheckedChange={(checked) => handleSettingChange('showLocation', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* 데이터 수집 설정 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-purple-600" />
              데이터 수집 설정
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="allowDataCollection" className="text-sm font-medium">
                  서비스 개선을 위한 데이터 수집
                </Label>
                <p className="text-xs text-gray-500">
                  익명화된 이용 패턴 데이터를 서비스 개선에 활용합니다
                </p>
              </div>
              <Switch
                id="allowDataCollection"
                checked={settings.allowDataCollection}
                onCheckedChange={(checked) => handleSettingChange('allowDataCollection', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="allowMarketingData" className="text-sm font-medium">
                  마케팅 데이터 활용
                </Label>
                <p className="text-xs text-gray-500">
                  개인화된 서비스 추천을 위해 데이터를 활용합니다
                </p>
              </div>
              <Switch
                id="allowMarketingData"
                checked={settings.allowMarketingData}
                onCheckedChange={(checked) => handleSettingChange('allowMarketingData', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* 보안 설정 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-red-600" />
              보안 설정
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="twoFactorAuth" className="text-sm font-medium">
                  2단계 인증
                </Label>
                <p className="text-xs text-gray-500">
                  로그인 시 추가 인증 단계를 거칩니다
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  권장
                </Badge>
                <Switch
                  id="twoFactorAuth"
                  checked={settings.twoFactorAuth}
                  onCheckedChange={(checked) => handleSettingChange('twoFactorAuth', checked)}
                />
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium mb-1">보안 권장 사항</p>
                  <p>정기적으로 비밀번호를 변경하고, 2단계 인증을 활성화하는 것을 권장합니다.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 데이터 관리 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-indigo-600" />
              데이터 관리
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 데이터 다운로드 */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Download className="h-5 w-5 text-blue-600" />
                  <h4 className="font-medium">데이터 다운로드</h4>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  내가 제공한 모든 개인정보를 다운로드할 수 있습니다.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadData}
                  disabled={downloadDataMutation.isPending}
                  className="w-full"
                >
                  {downloadDataMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                      다운로드 중...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      데이터 다운로드
                    </>
                  )}
                </Button>
              </div>

              {/* 계정 삭제 */}
              <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                <div className="flex items-center gap-2 mb-2">
                  <Trash2 className="h-5 w-5 text-red-600" />
                  <h4 className="font-medium text-red-800">계정 삭제</h4>
                </div>
                <p className="text-sm text-red-700 mb-3">
                  계정과 모든 데이터가 영구적으로 삭제됩니다.
                </p>
                <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                  <DialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      계정 삭제
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2 text-red-600">
                        <AlertTriangle className="h-5 w-5" />
                        계정 삭제 확인
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <h4 className="font-medium text-red-800 mb-2">
                          계정 삭제 시 다음 사항을 확인해주세요:
                        </h4>
                        <ul className="text-sm text-red-700 space-y-1">
                          <li>• 모든 개인정보와 서비스 이용 기록이 삭제됩니다</li>
                          <li>• 예약 중인 서비스가 모두 취소됩니다</li>
                          <li>• 삭제된 데이터는 복구할 수 없습니다</li>
                          <li>• 처리까지 최대 7일이 소요됩니다</li>
                        </ul>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setShowDeleteDialog(false)}
                          className="flex-1"
                        >
                          취소
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={handleDeleteAccount}
                          disabled={deleteAccountMutation.isPending}
                          className="flex-1"
                        >
                          {deleteAccountMutation.isPending ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                              삭제 중...
                            </>
                          ) : (
                            "삭제 확인"
                          )}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
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
        </div>

        {/* 개인정보 처리방침 안내 */}
        <Card className="bg-gray-50 border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-gray-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-gray-900 mb-2">개인정보 처리 안내</h4>
                <div className="text-sm text-gray-700 space-y-2">
                  <p>• 개인정보는 서비스 제공 목적으로만 사용되며, 제3자에게 제공되지 않습니다.</p>
                  <p>• 법정 보관 기간에 따라 일부 정보는 삭제 후에도 보관될 수 있습니다.</p>
                  <p>• 개인정보 처리에 대한 자세한 내용은 개인정보 처리방침을 확인해주세요.</p>
                </div>
                <div className="mt-3">
                  <Button variant="link" className="p-0 h-auto text-blue-600 text-sm">
                    개인정보 처리방침 보기
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 