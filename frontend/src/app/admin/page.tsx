"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthToken, isAdmin, clearAuthData } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/config";
import { LogOut, CheckCircle, XCircle, Users, Activity } from "lucide-react";
import Link from "next/link";

interface User {
  id: number;
  email: string;
  full_name?: string;
  role: string;
  status: string;
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check if admin
    if (!isAdmin()) {
      router.push("/login");
      return;
    }

    fetchUsers();
  }, [router]);

  const fetchUsers = async () => {
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.status === 401 || res.status === 403) {
        clearAuthData();
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (data.users) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error("Failed to fetch users", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (userId: number, status: string) => {
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });

      if (res.ok) {
        // Refresh local state without refetching entirely
        setUsers(users.map(u => u.id === userId ? { ...u, status } : u));
      }
    } catch (error) {
      console.error("Failed to update status", error);
    }
  };

  const pendingCount = users.filter((u) => u.status === 'pending').length;

  if (loading) {
    return <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">Loading Admin Dashboard...</div>;
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans">
      {/* Top Navbar */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-red-500/20 p-2 rounded-lg border border-red-500/30">
                <Activity className="h-5 w-5 text-red-500" />
              </div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-orange-500">
                Admin Console
              </h1>
            </div>
            <div className="flex items-center space-x-6">
              <button
                onClick={() => { clearAuthData(); router.push('/login'); }}
                className="flex items-center space-x-2 text-sm font-medium text-red-400 hover:text-red-300 transition-colors bg-red-500/10 px-4 py-2 rounded-lg border border-red-500/20"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-bold tracking-tight mb-2">User Management</h2>
            <p className="text-neutral-400">Review and approve access to the video detection system.</p>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/20 px-4 py-3 rounded-xl flex items-center space-x-3">
            <div className="bg-yellow-500/20 rounded-full p-2">
              <Users className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-sm text-neutral-400 font-medium">Pending Requests</p>
              <p className="text-xl font-bold text-yellow-500">{pendingCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-neutral-900/50 border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-black/40">
              <tr>
                <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                  User ID
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                  User Details
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                  Current Status
                </th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-medium text-neutral-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-transparent">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-neutral-500">
                    No users found in the system yet.
                  </td>
                </tr>
              ) : null}
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500 font-mono">
                    #{user.id.toString().padStart(4, '0')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-inner">
                        {user.full_name ? user.full_name.charAt(0).toUpperCase() : (user.email ? user.email.charAt(0).toUpperCase() : "?")}
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-white">{user.full_name || (user.email ? user.email.split('@')[0] : "Unknown")}</div>
                        <div className="text-xs text-neutral-500">{user.email} &bull; <span className="capitalize">{user.role}</span></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border
                      ${user.status === 'approved' ? 'bg-green-500/10 text-green-400 border-green-500/20' : ''}
                      ${user.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : ''}
                      ${user.status === 'rejected' ? 'bg-red-500/10 text-red-400 border-red-500/20' : ''}
                    `}>
                      {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                    {user.status !== 'approved' && (
                      <button
                        onClick={() => handleUpdateStatus(user.id, 'approved')}
                        className="inline-flex items-center text-green-400 hover:text-green-300 transition-colors"
                      >
                        <CheckCircle className="h-5 w-5 mr-1" /> Approve
                      </button>
                    )}
                    {user.status !== 'rejected' && (
                      <button
                        onClick={() => handleUpdateStatus(user.id, 'rejected')}
                        className="inline-flex items-center text-red-500 hover:text-red-400 transition-colors"
                      >
                        <XCircle className="h-5 w-5 mr-1" /> Reject
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
