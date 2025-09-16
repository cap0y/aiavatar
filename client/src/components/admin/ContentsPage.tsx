import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const ContentsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const contents = [
    { id:1, title:'건강 관리 팁', category:'건강', status:'published', date:'2024-01-10' },
    { id:2, title:'요양 보호 가이드', category:'교육', status:'draft', date:'2024-01-12' },
  ];

  const getBadge=(st:string)=>{
    const map:any={published:'bg-green-100 text-green-800',draft:'bg-yellow-100 text-yellow-800'};
    return <Badge className={map[st]||'bg-gray-100'}>{st}</Badge>;
  };

  const filtered = contents.filter(c=> c.title.includes(search));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-lg font-semibold">콘텐츠 목록</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="제목 검색" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b"><th className="py-2 px-3">ID</th><th className="py-2 px-3">제목</th><th className="py-2 px-3">카테고리</th><th className="py-2 px-3">상태</th></tr></thead>
              <tbody>
                {filtered.map(c=> (
                  <tr key={c.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-3">{c.id}</td>
                    <td className="py-2 px-3">{c.title}</td>
                    <td className="py-2 px-3">{c.category}</td>
                    <td className="py-2 px-3">{getBadge(c.status)}</td>
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

export default ContentsPage; 