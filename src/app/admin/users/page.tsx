'use client';

import React, { useState } from 'react';
import { Eye, Ban, ShieldCheck, Trash2 } from 'lucide-react';
import { adminUsers, AdminUser } from '@/data/adminData';
import { DataTable, Input, Select, Tabs as FilterTabs } from '@/components/ui/Form';
import { Modal, ConfirmDialog, useToast } from '@/components/ui/Feedback';

const statusCls: Record<string, string> = {
  Active: 'bg-emerald-50 text-emerald-700',
  Suspended: 'bg-amber-50 text-amber-700',
  Banned: 'bg-red-50 text-[#D32F2F]',
};

export default function AdminUsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState(adminUsers);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [preview, setPreview] = useState<AdminUser | null>(null);
  const [confirm, setConfirm] = useState<{ user: AdminUser; action: string } | null>(null);

  const filtered = users.filter(
    (u) =>
      (filter === 'All' || u.status === filter) &&
      (u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
  );

  const applyAction = (user: AdminUser, action: string) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === user.id
          ? {
              ...u,
              status: action === 'Ban' ? 'Banned' : action === 'Suspend' ? 'Suspended' : 'Active',
              verified: action === 'Verify' ? true : u.verified,
            }
          : u
      )
    );
    toast(`${action} applied to ${user.name}`);
  };

  const removeUser = (user: AdminUser) => {
    setUsers((prev) => prev.filter((u) => u.id !== user.id));
    toast(`${user.name} deleted`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Users</h1>
          <p className="text-xs text-slate-500 mt-1">{users.length} registered accounts</p>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-grow">
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search users"
          />
        </div>
        <div className="md:w-48">
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            options={[
              { value: 'All', label: 'All statuses' },
              { value: 'Active', label: 'Active' },
              { value: 'Suspended', label: 'Suspended' },
              { value: 'Banned', label: 'Banned' },
            ]}
            aria-label="Filter by status"
          />
        </div>
      </div>

      {/* Quick tabs */}
      <FilterTabs
        tabs={['All', 'Active', 'Suspended', 'Banned']}
        active={filter}
        onChange={setFilter}
      />

      <DataTable headers={['User', 'Status', 'Verified', 'Ads', 'Joined', 'Actions']}>
        {filtered.map((u) => (
          <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
            <td className="pl-5 pr-3 py-3.5">
              <button onClick={() => setPreview(u)} className="flex items-center gap-3 text-left group">
                <span className="w-9 h-9 rounded-xl bg-red-50 text-[#E53935] flex items-center justify-center text-xs font-black shrink-0">
                  {u.name.charAt(0)}
                </span>
                <span className="min-w-0">
                  <span className="block font-bold group-hover:text-[#E53935] transition-colors truncate">{u.name}</span>
                  <span className="block text-[11px] text-slate-400 truncate">{u.email}</span>
                </span>
              </button>
            </td>
            <td className="px-3 py-3.5">
              <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold ${statusCls[u.status]}`}>{u.status}</span>
            </td>
            <td className="px-3 py-3.5">
              {u.verified ? (
                <ShieldCheck className="w-4 h-4 text-emerald-500" aria-label="Verified" />
              ) : (
                <span className="text-xs text-slate-300">â€”</span>
              )}
            </td>
            <td className="px-3 py-3.5 text-slate-600">{u.totalAds}</td>
            <td className="px-3 py-3.5 text-slate-500 whitespace-nowrap">{u.joinedAt}</td>
            <td className="pr-5 pl-3 py-3.5">
              <div className="flex items-center gap-1">
                <button onClick={() => setPreview(u)} title="View" className="p-2 rounded-lg hover:bg-red-50 hover:text-[#E53935] text-slate-500 transition-colors"><Eye className="w-4 h-4" /></button>
                {!u.verified && (
                  <button onClick={() => applyAction(u, 'Verify')} title="Verify" className="p-2 rounded-lg hover:bg-emerald-50 hover:text-emerald-700 text-slate-500 transition-colors"><ShieldCheck className="w-4 h-4" /></button>
                )}
                {u.status !== 'Suspended' && u.status !== 'Banned' && (
                  <>
                    <button onClick={() => setConfirm({ user: u, action: 'Suspend' })} title="Suspend" className="p-2 rounded-lg hover:bg-amber-50 hover:text-amber-700 text-slate-500 transition-colors"><Ban className="w-4 h-4" /></button>
                    <button onClick={() => setConfirm({ user: u, action: 'Ban' })} title="Ban" className="p-2 rounded-lg hover:bg-red-50 hover:text-[#D32F2F] text-slate-500 transition-colors"><Ban className="w-4 h-4 rotate-180" /></button>
                  </>
                )}
                <button onClick={() => setConfirm({ user: u, action: 'Delete' })} title="Delete" className="p-2 rounded-lg hover:bg-red-50 hover:text-[#D32F2F] text-slate-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
            </td>
          </tr>
        ))}
      </DataTable>

      {/* Profile preview modal */}
      <Modal open={preview !== null} onClose={() => setPreview(null)} title="User Profile" size="sm">
        {preview && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="w-14 h-14 rounded-2xl bg-[#E53935] text-white font-black text-2xl flex items-center justify-center">{preview.name.charAt(0)}</span>
              <div>
                <p className="font-black">{preview.name}</p>
                <p className="text-xs text-slate-400">{preview.email}</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-50 rounded-xl px-3 py-2.5"><dt className="text-[11px] text-slate-400">Status</dt><dd className="font-bold">{preview.status}</dd></div>
              <div className="bg-slate-50 rounded-xl px-3 py-2.5"><dt className="text-[11px] text-slate-400">Verified</dt><dd className="font-bold">{preview.verified ? 'Yes' : 'No'}</dd></div>
              <div className="bg-slate-50 rounded-xl px-3 py-2.5"><dt className="text-[11px] text-slate-400">Total Ads</dt><dd className="font-bold">{preview.totalAds}</dd></div>
              <div className="bg-slate-50 rounded-xl px-3 py-2.5"><dt className="text-[11px] text-slate-400">Joined</dt><dd className="font-bold">{preview.joinedAt}</dd></div>
            </dl>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return;
          confirm.action === 'Delete' ? removeUser(confirm.user) : applyAction(confirm.user, confirm.action);
        }}
        title={`${confirm?.action} user?`}
        message={`Are you sure you want to ${confirm?.action.toLowerCase()} ${confirm?.user.name}? This action is logged.`}
        confirmLabel={confirm?.action || 'Confirm'}
        danger={confirm?.action === 'Delete' || confirm?.action === 'Ban'}
      />
    </div>
  );
}