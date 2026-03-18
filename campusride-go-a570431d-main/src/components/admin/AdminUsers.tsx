import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Ban, Mail, Trash2 } from "lucide-react";
import { apiClient, type RideDto } from "@/lib/apiClient";
import { useAppToast } from "@/hooks/use-app-toast";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: "student" | "driver" | "admin";
  isActive: boolean;
  createdAt?: string;
}

const AdminUsers = () => {
  const toast = useAppToast();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [rides, setRides] = useState<RideDto[]>([]);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const loadData = async (mounted = true) => {
    const [usersResponse, ridesResponse] = await Promise.all([
      apiClient.users.list() as Promise<{ users: UserRow[] }>,
      apiClient.rides.my(),
    ]);
    if (!mounted) return;
    setUsers(usersResponse.users || []);
    setRides(ridesResponse.rides || []);
  };

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        await loadData(mounted);
      } catch (error) {
        if (!mounted) return;
        toast.error("Unable to load users", error, "Please refresh and try again.");
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [toast]);

  const toggleBlockUser = async (user: UserRow) => {
    if (user.role === "admin") {
      toast.info("Action blocked", "Admin users cannot be blocked from this panel.");
      return;
    }

    setBusyUserId(user.id);
    try {
      await apiClient.admin.updateUser(user.id, { isActive: !user.isActive });
      await loadData(true);
      toast.success(
        user.isActive ? "User blocked" : "User unblocked",
        `${user.name} has been ${user.isActive ? "blocked" : "reactivated"}. Email sent to user if mail is configured.`,
      );
    } catch (error) {
      toast.error("Could not update user status", error);
    } finally {
      setBusyUserId(null);
    }
  };

  const deleteUser = async (user: UserRow) => {
    if (user.role === "admin") {
      toast.info("Action blocked", "Admin users cannot be deleted from this panel.");
      return;
    }

    const confirmed = window.confirm(`Delete user ${user.name}? This cannot be undone.`);
    if (!confirmed) return;

    setBusyUserId(user.id);
    try {
      await apiClient.admin.deleteUser(user.id);
      await loadData(true);
      toast.success("User deleted", "Account removed. Deletion email sent if mail is configured.");
    } catch (error) {
      toast.error("Could not delete user", error);
    } finally {
      setBusyUserId(null);
    }
  };

  const ridesByStudent = useMemo(() => {
    const map = new Map<string, number>();
    rides.forEach((ride) => {
      if (!ride.studentId) return;
      map.set(ride.studentId, (map.get(ride.studentId) || 0) + 1);
    });
    return map;
  }, [rides]);

  const filtered = useMemo(() => users.filter((u) => {
    const q = search.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  }), [users, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display mb-1">User Management</h1>
          <p className="text-sm text-muted-foreground">{users.length} registered users</p>
        </div>
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-muted/50 border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          />
        </div>
      </div>

      <div className="card-glass overflow-hidden !p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground p-4">User</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden md:table-cell">Role</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden md:table-cell">Rides</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-4">Status</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden lg:table-cell">Joined</th>
                <th className="text-right text-xs font-medium text-muted-foreground p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user, i) => (
                <motion.tr
                  key={user.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                        {user.name?.charAt(0) || "U"}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 hidden md:table-cell text-sm capitalize">{user.role}</td>
                  <td className="p-4 hidden md:table-cell text-sm">{ridesByStudent.get(user.id) || 0}</td>
                  <td className="p-4">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      user.isActive ? "bg-green-500/20 text-green-400" : "bg-destructive/20 text-destructive"
                    }`}>
                      {user.isActive ? "active" : "inactive"}
                    </span>
                  </td>
                  <td className="p-4 hidden lg:table-cell text-sm text-muted-foreground">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}</td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Email">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => toggleBlockUser(user)}
                        disabled={busyUserId === user.id}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-60"
                        title={user.isActive ? "Block" : "Unblock"}
                      >
                        <Ban className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => deleteUser(user)}
                        disabled={busyUserId === user.id}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-60"
                        title="Delete user"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminUsers;
