import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const MembersPage = () => {
  const { data: members = [] } = useQuery<any[]>({ queryKey: ['/api/users'] });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">회원 목록</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b">
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">이메일</th>
                  <th className="py-3 px-4">이름</th>
                  <th className="py-3 px-4">유형</th>
                </tr>
              </thead>
              <tbody>
                {members.map((u) => (
                  <tr key={u.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">{u.id}</td>
                    <td className="py-3 px-4">{u.email}</td>
                    <td className="py-3 px-4">{u.name}</td>
                    <td className="py-3 px-4">
                      <Badge>{u.userType}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MembersPage; 