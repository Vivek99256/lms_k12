'use client';

import React from 'react';
import { Bell, Search, ChevronDown, Menu } from 'lucide-react';

export default function Header() {
  return (
    <div className="h-20 bg-white border-b border-gray-100 flex items-center px-8 justify-between">
      <div className="flex items-center gap-4 flex-1">
        <button className="p-2 hover:bg-gray-100 rounded-full lg:hidden"><Menu size={20} /></button>
        
        <div className="flex-1 max-w-xl">
          <div className="search-bar flex items-center bg-white border border-gray-200 pl-5 pr-4 py-3 rounded-full">
            <Search size={18} className="text-gray-400 mr-3" />
            <input type="text" placeholder="Search for subjects, chapters, students..." className="flex-1 bg-transparent text-sm outline-none" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative cursor-pointer">
          <Bell size={20} className="text-gray-600" />
          <div className="absolute -top-1 -right-1 bg-[#0D6EFD] text-white rounded-full w-4 h-4 text-[9px] flex items-center justify-center">3</div>
        </div>

        <div className="flex items-center gap-2 cursor-pointer">
          <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-white"><img src="https://i.pravatar.cc/36" alt="Avatar" /></div>
          <span className="font-medium text-sm flex items-center gap-1">Sarah Patel <ChevronDown size={14} /></span>
        </div>
        <div className="text-sm text-gray-500 pl-4 border-l">May 19, 2026</div>
      </div>
    </div>
  );
}
