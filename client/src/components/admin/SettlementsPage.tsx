import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const SettlementsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const data = [
    { id: 1, serviceId: 'SRV-2024-001', name: '김영희', amount: 45000, commission: 6750, status: 'pending', date: '2024-01-15' },
    { id: 2, serviceId: 'SRV-2024-002', name: '이수진', amount: 35000, commission: 5250, status: 'completed', date: '2024-01-16' },
  ];

  const getBadge = (status:string)=> {
    const map:any={pending:'bg-yellow-100 text-yellow-800',completed:'bg-green-100 text-green-800',rejected:'bg-red-100 text-red-800'};
    return <Badge className={map[status]||'bg-gray-100'}>{status}</Badge>;
  };

  const filtered = data.filter(d=> (statusFilter==='all'||d.status===statusFilter) && (
    d.serviceId.includes(searchTerm)||d.name.includes(searchTerm)));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-lg font-semibold">정산 목록</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder="검색" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="pending">대기</SelectItem>
                <SelectItem value="completed">완료</SelectItem>
                <SelectItem value="rejected">반려</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b"><th className="py-2 px-3">서비스ID</th><th className="py-2 px-3">케어매니저</th><th className="py-2 px-3 text-right">금액</th><th className="py-2 px-3 text-right">수수료</th><th className="py-2 px-3">상태</th></tr></thead>
              <tbody>
                {filtered.map(item=> (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-3 font-mono text-blue-600">{item.serviceId}</td>
                    <td className="py-2 px-3">{item.name}</td>
                    <td className="py-2 px-3 text-right">{item.amount.toLocaleString()}원</td>
                    <td className="py-2 px-3 text-right">{item.commission.toLocaleString()}원</td>
                    <td className="py-2 px-3">{getBadge(item.status)}</td>
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

export default SettlementsPage; 