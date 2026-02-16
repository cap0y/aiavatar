import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { normalizeImageUrl } from "@/lib/url";

const MembersPage = () => {
  const { data: members = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showManageDialog, setShowManageDialog] = useState(false);
  const [newStatus, setNewStatus] = useState<string>("");

  // 프로필 사진 변경 관련 상태
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 임시 더미 데이터 (API가 없을 경우)
  const defaultMembers =
    members.length === 0
      ? [
          {
            id: 1,
            email: "user1@example.com",
            displayName: "김영희",
            username: "kimyh",
            userType: "ai_avatar",
            status: "active",
            createdAt: "2024-01-10",
            photoURL: null,
          },
          {
            id: 2,
            email: "user2@example.com",
            displayName: "이민수",
            username: "leems",
            userType: "customer",
            status: "active",
            createdAt: "2024-01-15",
            photoURL: null,
          },
          {
            id: 3,
            email: "user3@example.com",
            displayName: "박정원",
            username: "parkjw",
            userType: "ai_avatar",
            status: "pending",
            createdAt: "2024-01-20",
            photoURL: null,
          },
          {
            id: 4,
            email: "user4@example.com",
            displayName: "최수정",
            username: "choisj",
            userType: "customer",
            status: "active",
            createdAt: "2024-01-22",
            photoURL: null,
          },
        ]
      : members;

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, string> = {
      active: "bg-green-600 text-white",
      pending: "bg-yellow-600 text-white",
      inactive: "bg-red-600 text-white",
      suspended: "bg-gray-600 text-white",
    };
    return (
      <Badge className={statusMap[status] || "bg-gray-600 text-white"}>
        {status === "active"
          ? "활성"
          : status === "pending"
            ? "승인대기"
            : status === "inactive"
              ? "비활성"
              : status === "suspended"
                ? "정지"
                : status}
      </Badge>
    );
  };

  const getUserTypeBadge = (userType: string) => {
    const typeMap: Record<string, string> = {
      ai_avatar: "bg-blue-600 text-white",
      careManager: "bg-blue-600 text-white",
      customer: "bg-purple-600 text-white",
      admin: "bg-indigo-600 text-white",
    };
    return (
      <Badge className={typeMap[userType] || "bg-gray-600 text-white"}>
        {userType === "ai_avatar" || userType === "careManager"
          ? "AI 아바타"
          : userType === "customer"
            ? "고객"
            : userType === "admin"
              ? "관리자"
              : userType}
      </Badge>
    );
  };

  // 사용자 이름 가져오기 (displayName 또는 username 또는 name)
  const getUserName = (user: any) => {
    return user.displayName || user.name || user.username || "이름 없음";
  };

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  // 사용자 관리 핸들러
  const handleManageUser = (user: any) => {
    setSelectedUser(user);
    setNewStatus(user.status || "active");
    setPhotoPreview(null);
    setShowManageDialog(true);
  };

  // 프로필 사진 선택
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 크기 체크 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "파일 크기 초과",
        description: "10MB 이하의 이미지만 업로드 가능합니다.",
        variant: "destructive",
      });
      return;
    }

    // 이미지 파일 체크
    if (!file.type.startsWith("image/")) {
      toast({
        title: "이미지 파일만 가능",
        description: "JPG, PNG, GIF 등 이미지 파일만 업로드할 수 있습니다.",
        variant: "destructive",
      });
      return;
    }

    // 미리보기 생성
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPhotoPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // 프로필 사진 업로드 및 저장
  const handlePhotoUpload = async () => {
    if (!selectedUser || !fileInputRef.current?.files?.[0]) return;

    setIsUploadingPhoto(true);
    try {
      const file = fileInputRef.current.files[0];

      // 1. Cloudinary에 이미지 업로드
      const formData = new FormData();
      formData.append("image", file);

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("이미지 업로드 실패");
      }

      const uploadResult = await uploadResponse.json();
      const photoURL = uploadResult.imageUrl;

      // 2. 사용자 프로필 사진 URL 업데이트
      const updateResponse = await fetch(
        `/api/users/${selectedUser.id}/profile-photo`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoURL }),
        }
      );

      if (!updateResponse.ok) {
        throw new Error("프로필 사진 업데이트 실패");
      }

      toast({
        title: "프로필 사진 변경 완료",
        description: `${getUserName(selectedUser)}님의 프로필 사진이 변경되었습니다.`,
      });

      // 사용자 목록 새로고침
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });

      // 선택된 사용자 정보 업데이트
      setSelectedUser((prev: any) => ({ ...prev, photoURL }));
      setPhotoPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("프로필 사진 업로드 오류:", error);
      toast({
        title: "프로필 사진 변경 실패",
        description: "프로필 사진 변경 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // 프로필 사진 삭제
  const handlePhotoRemove = async () => {
    if (!selectedUser) return;

    setIsUploadingPhoto(true);
    try {
      const updateResponse = await fetch(
        `/api/users/${selectedUser.id}/profile-photo`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoURL: "" }),
        }
      );

      if (!updateResponse.ok) {
        throw new Error("프로필 사진 삭제 실패");
      }

      toast({
        title: "프로필 사진 삭제 완료",
        description: `${getUserName(selectedUser)}님의 프로필 사진이 삭제되었습니다.`,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setSelectedUser((prev: any) => ({ ...prev, photoURL: null }));
      setPhotoPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("프로필 사진 삭제 오류:", error);
      toast({
        title: "프로필 사진 삭제 실패",
        description: "프로필 사진 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // 상태 변경 처리
  const handleStatusChange = async () => {
    if (!selectedUser) return;

    try {
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error("상태 변경 실패");
      }

      const updatedUser = await response.json();
      console.log("사용자 상태 변경 완료:", updatedUser);

      toast({
        title: "회원 상태 변경 완료",
        description: `${getUserName(selectedUser)}님의 상태가 ${
          newStatus === "active"
            ? "활성"
            : newStatus === "pending"
              ? "승인대기"
              : newStatus === "inactive"
                ? "비활성"
                : newStatus === "suspended"
                  ? "정지"
                  : newStatus
        }(으)로 변경되었습니다.`,
      });

      setShowManageDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    } catch (error) {
      console.error("상태 변경 오류:", error);
      toast({
        title: "상태 변경 실패",
        description: "회원 상태 변경 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-gray-800/70 border-gray-600/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-white">
            AI 아바타 및 사용자 관리
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-600/50">
                  <th className="py-3 px-4 text-gray-300">프로필</th>
                  <th className="py-3 px-4 text-gray-300">이름</th>
                  <th className="py-3 px-4 text-gray-300">이메일</th>
                  <th className="py-3 px-4 text-gray-300">계정 유형</th>
                  <th className="py-3 px-4 text-gray-300">상태</th>
                  <th className="py-3 px-4 text-gray-300">가입일</th>
                  <th className="py-3 px-4 text-gray-300">작업</th>
                </tr>
              </thead>
              <tbody>
                {defaultMembers.map((u: any) => (
                  <tr
                    key={u.id}
                    className="border-b border-gray-600/50 hover:bg-gray-700/50"
                  >
                    {/* 프로필 사진 */}
                    <td className="py-3 px-4">
                      <Avatar className="w-10 h-10">
                        <AvatarImage
                          src={
                            u.photoURL
                              ? normalizeImageUrl(u.photoURL)
                              : undefined
                          }
                          alt={getUserName(u)}
                        />
                        <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-sm font-bold">
                          {getUserName(u)?.[0]?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                    </td>
                    <td className="py-3 px-4 text-white font-medium">
                      {getUserName(u)}
                    </td>
                    <td className="py-3 px-4 text-white">{u.email}</td>
                    <td className="py-3 px-4">
                      {getUserTypeBadge(u.userType)}
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(u.status || "active")}
                    </td>
                    <td className="py-3 px-4 text-gray-400">
                      {formatDate(u.createdAt || u.joinDate)}
                    </td>
                    <td className="py-3 px-4">
                      <Button
                        size="sm"
                        variant="default"
                        className="border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                        onClick={() => handleManageUser(u)}
                      >
                        관리
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 회원 관리 다이얼로그 */}
      <Dialog open={showManageDialog} onOpenChange={setShowManageDialog}>
        <DialogContent className="sm:max-w-[550px] bg-gray-800 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">회원 관리</DialogTitle>
            <DialogDescription className="text-gray-400">
              {selectedUser && getUserName(selectedUser)}님의 계정을
              관리합니다.
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-4 py-4">
              {/* 프로필 사진 변경 영역 */}
              <div className="flex flex-col items-center gap-4 p-4 bg-gray-700/50 rounded-lg">
                <p className="text-sm font-medium text-gray-300 self-start">
                  프로필 사진
                </p>
                <div className="flex items-center gap-6">
                  {/* 현재 / 미리보기 아바타 */}
                  <div className="relative group">
                    <Avatar className="w-24 h-24 border-2 border-gray-500">
                      <AvatarImage
                        src={
                          photoPreview ||
                          (selectedUser.photoURL
                            ? normalizeImageUrl(selectedUser.photoURL)
                            : undefined)
                        }
                        alt={getUserName(selectedUser)}
                      />
                      <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-2xl font-bold">
                        {getUserName(selectedUser)?.[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    {/* 호버 시 카메라 아이콘 오버레이 */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <i className="fas fa-camera text-white text-lg"></i>
                    </button>
                  </div>

                  {/* 업로드 버튼들 */}
                  <div className="flex flex-col gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-gray-600 border-gray-500 text-white hover:bg-gray-500"
                      disabled={isUploadingPhoto}
                    >
                      <i className="fas fa-image mr-2"></i>
                      사진 선택
                    </Button>

                    {/* 미리보기가 있을 때 업로드 버튼 표시 */}
                    {photoPreview && (
                      <Button
                        size="sm"
                        onClick={handlePhotoUpload}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        disabled={isUploadingPhoto}
                      >
                        {isUploadingPhoto ? (
                          <>
                            <i className="fas fa-spinner fa-spin mr-2"></i>
                            업로드 중...
                          </>
                        ) : (
                          <>
                            <i className="fas fa-upload mr-2"></i>
                            사진 저장
                          </>
                        )}
                      </Button>
                    )}

                    {/* 기존 사진이 있을 때 삭제 버튼 */}
                    {selectedUser.photoURL && !photoPreview && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handlePhotoRemove}
                        className="bg-red-900/30 border-red-600/50 text-red-400 hover:bg-red-900/50 hover:text-red-300"
                        disabled={isUploadingPhoto}
                      >
                        <i className="fas fa-trash mr-2"></i>
                        사진 삭제
                      </Button>
                    )}

                    {/* 미리보기 취소 */}
                    {photoPreview && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setPhotoPreview(null);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = "";
                          }
                        }}
                        className="bg-gray-600 border-gray-500 text-gray-300 hover:bg-gray-500"
                        disabled={isUploadingPhoto}
                      >
                        <i className="fas fa-times mr-2"></i>
                        취소
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* 회원 정보 */}
              <div className="grid grid-cols-2 gap-3 p-4 bg-gray-700/50 rounded-lg">
                <div>
                  <p className="text-xs text-gray-400 mb-1">이메일</p>
                  <p className="text-sm text-white">{selectedUser.email}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">이름</p>
                  <p className="text-sm text-white">
                    {getUserName(selectedUser)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">계정 유형</p>
                  <div>{getUserTypeBadge(selectedUser.userType)}</div>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">가입일</p>
                  <p className="text-sm text-white">
                    {formatDate(
                      selectedUser.createdAt || selectedUser.joinDate
                    )}
                  </p>
                </div>
              </div>

              {/* 상태 변경 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">
                  계정 상태 변경
                </label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue placeholder="상태 선택" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600">
                    <SelectItem
                      value="active"
                      className="text-white hover:bg-gray-600"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        활성
                      </div>
                    </SelectItem>
                    <SelectItem
                      value="pending"
                      className="text-white hover:bg-gray-600"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        승인 대기
                      </div>
                    </SelectItem>
                    <SelectItem
                      value="inactive"
                      className="text-white hover:bg-gray-600"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        비활성
                      </div>
                    </SelectItem>
                    <SelectItem
                      value="suspended"
                      className="text-white hover:bg-gray-600"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                        정지
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* AI 아바타인 경우 추가 정보 */}
              {(selectedUser.userType === "ai_avatar" ||
                selectedUser.userType === "careManager") &&
                selectedUser.status === "pending" && (
                  <div className="p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                    <p className="text-sm text-yellow-400 flex items-center gap-2">
                      <i className="fas fa-exclamation-triangle"></i>
                      AI 아바타 승인 대기 중입니다. 상태를 "활성"으로 변경하여
                      승인하세요.
                    </p>
                  </div>
                )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowManageDialog(false)}
              className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
            >
              취소
            </Button>
            <Button
              onClick={handleStatusChange}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              변경 저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MembersPage;
