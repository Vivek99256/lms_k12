'use client';

import React from 'react';
import { Bell, Search, ChevronDown, Menu, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function Header() {
  const { user, logout } = useAuth();

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

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

        <div className="flex items-center gap-3 cursor-pointer">
          <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-white bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700">
            {user?.name?.charAt(0).toUpperCase() || 'S'}
          </div>
          <span className="font-medium text-sm flex items-center gap-1">{user?.name || 'Sarah Patel'} <ChevronDown size={14} /></span>
        </div>
        <button
          onClick={logout}
          className="text-sm text-gray-500 hover:text-red-600 transition-colors flex items-center gap-1.5 pl-4 border-l"
          title="Sign out"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">Sign out</span>
        </button>
        <div className="text-sm text-gray-500">{today}</div>
      </div>
    </div>
  );
}
