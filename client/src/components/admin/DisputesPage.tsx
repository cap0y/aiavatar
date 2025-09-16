import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const DisputesPage = () => {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 분쟁 목록 fetch
  const { data: disputes = [] } = useQuery<any[]>({
    queryKey:['/api/disputes'],
    queryFn: async ()=> {
      const res= await apiRequest('GET','/api/disputes');
      if(!res.ok) throw new Error('분쟁 목록 로드 실패');
      return res.json();
    }
  });

  // 상태 변경 mutation
  const updateStatus = useMutation({
    mutationFn: async ({id,status}:{id:number,status:string})=>{
      const res = await apiRequest('PUT',`/api/disputes/${id}/status`,{status});
      if(!res.ok) throw new Error('상태 업데이트 실패');
      return res.json();
    },
    onSuccess:()=>{
      queryClient.invalidateQueries({queryKey:['/api/disputes']});
      toast({title:'상태가 변경되었습니다'});
    },
    onError:(e:any)=> toast({title:'변경 실패',description:e.message,variant:'destructive'})
  });

  const getBadge = (st:string)=>{
    const m:any={received:'bg-gray-100 text-gray-800',processing:'bg-yellow-100 text-yellow-800',completed:'bg-green-100 text-green-800'};
    return <Badge className={m[st]||'bg-gray-100'}>{st}</Badge>;
  };

  const filtered = disputes.filter(d=> (status==='all'||d.status===status)&&(d.disputeId.includes(search)||d.reporter.includes(search)||d.target.includes(search)));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-lg font-semibold">분쟁 목록</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="검색" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b"><th className="py-2 px-3">ID</th><th className="py-2 px-3">신고자</th><th className="py-2 px-3">대상자</th><th className="py-2 px-3">유형</th><th className="py-2 px-3">상태</th><th className="py-2 px-3">변경</th></tr></thead>
              <tbody>
                {filtered.map(d=> (
                  <tr key={d.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-3 font-mono text-blue-600">{d.disputeId}</td>
                    <td className="py-2 px-3">{d.reporter}</td>
                    <td className="py-2 px-3">{d.target}</td>
                    <td className="py-2 px-3">{d.type}</td>
                    <td className="py-2 px-3">{getBadge(d.status)}</td>
                    <td className="py-2 px-3">
                      <Select defaultValue={d.status} onValueChange={(val)=> updateStatus.mutate({id:d.id,status:val})}>
                        <SelectTrigger className="w-28 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="received">접수</SelectItem>
                          <SelectItem value="processing">처리중</SelectItem>
                          <SelectItem value="completed">완료</SelectItem>
                          <SelectItem value="cancelled">취소</SelectItem>
                        </SelectContent>
                      </Select>
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

export default DisputesPage; 