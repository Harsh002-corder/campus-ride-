import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, ShieldAlert } from "lucide-react";
import { apiClient, type RideIssueDto } from "@/lib/apiClient";
import { useAppToast } from "@/hooks/use-app-toast";
import { getSocketClient } from "@/lib/socketClient";

const AdminIssues = () => {
  const toast = useAppToast();
  const [issues, setIssues] = useState<RideIssueDto[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "in_review" | "resolved" | "rejected">("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | RideIssueDto["category"]>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<Record<string, "in_review" | "resolved" | "rejected">>({});
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});

  const loadIssues = async () => {
    try {
      const response = await apiClient.admin.issues({
        status: statusFilter === "all" ? undefined : statusFilter,
        category: categoryFilter === "all" ? undefined : categoryFilter,
      });
      setIssues(response.issues || []);
    } catch (error) {
      toast.error("Could not load issues", error);
    }
  };

  useEffect(() => {
    void loadIssues();
  }, [statusFilter, categoryFilter]);

  useEffect(() => {
    const socket = getSocketClient();

    const onIssueCreated = () => {
      void loadIssues();
    };

    const onIssueUpdated = () => {
      void loadIssues();
    };

    socket.on("admin:issue-created", onIssueCreated);
    socket.on("admin:issue-updated", onIssueUpdated);

    return () => {
      socket.off("admin:issue-created", onIssueCreated);
      socket.off("admin:issue-updated", onIssueUpdated);
    };
  }, [statusFilter, categoryFilter]);

  const visibleIssues = useMemo(() => {
    if (!search.trim()) return issues;
    const keyword = search.toLowerCase();
    return issues.filter((issue) => {
      const haystack = `${issue.id} ${issue.category} ${issue.description} ${issue.reporter?.name || ""} ${issue.ride?.pickup?.label || ""} ${issue.ride?.drop?.label || ""}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [issues, search]);

  const counts = useMemo(() => ({
    all: issues.length,
    open: issues.filter((item) => item.status === "open").length,
    in_review: issues.filter((item) => item.status === "in_review").length,
    resolved: issues.filter((item) => item.status === "resolved").length,
    rejected: issues.filter((item) => item.status === "rejected").length,
  }), [issues]);

  const handleUpdateIssue = async (issue: RideIssueDto) => {
    const nextStatus = draftStatus[issue.id] || (issue.status === "open" ? "in_review" : issue.status);
    const resolutionNote = draftNotes[issue.id] || "";
    setBusyId(issue.id);
    try {
      await apiClient.admin.updateIssue(issue.id, { status: nextStatus, resolutionNote });
      toast.success("Issue updated", `Status changed to ${nextStatus.replace("_", " ")}.`);
      await loadIssues();
    } catch (error) {
      toast.error("Could not update issue", error);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display mb-1">Issue Center</h1>
        <p className="text-sm text-muted-foreground">Track and resolve student post-ride complaints.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            placeholder="Search issues..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full bg-muted/50 border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["all", "open", "in_review", "resolved", "rejected"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all capitalize ${
                statusFilter === status ? "btn-primary-gradient text-primary-foreground" : "bg-muted/50 text-muted-foreground"
              }`}
            >
              {status.replace("_", " ")} ({counts[status]})
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["all", "overcharge", "driver_behavior", "route_issue", "safety", "app_issue", "other"] as const).map((category) => (
          <button
            key={category}
            onClick={() => setCategoryFilter(category)}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              categoryFilter === category ? "bg-primary/20 text-primary" : "bg-muted/40 text-muted-foreground"
            }`}
          >
            {category === "all" ? "All categories" : category.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {visibleIssues.length === 0 && (
          <div className="card-glass text-sm text-muted-foreground">No issues found for the selected filters.</div>
        )}

        {visibleIssues.map((issue, index) => (
          <motion.div
            key={issue.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            className="card-glass !p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">#{issue.id.slice(-6)}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary capitalize">{issue.category.replace("_", " ")}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    issue.status === "resolved" ? "bg-green-500/20 text-green-400" :
                    issue.status === "rejected" ? "bg-destructive/20 text-destructive" :
                    issue.status === "in_review" ? "bg-blue-500/20 text-blue-400" :
                    "bg-amber-500/20 text-amber-400"
                  }`}>
                    {issue.status.replace("_", " ")}
                  </span>
                </div>
                <p className="text-sm mt-2">{issue.description}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Reporter: {issue.reporter?.name || "Student"} · Route: {issue.ride?.pickup?.label || "—"} → {issue.ride?.drop?.label || "—"}
                </p>
                <p className="text-xs text-muted-foreground">Raised: {new Date(issue.createdAt).toLocaleString()}</p>
                {issue.resolutionNote && <p className="text-xs text-primary mt-1">Resolution: {issue.resolutionNote}</p>}
              </div>
              <div className="w-full sm:w-64 space-y-2">
                <select
                  title="Issue status"
                  value={draftStatus[issue.id] || (issue.status === "open" ? "in_review" : issue.status)}
                  onChange={(event) => setDraftStatus((prev) => ({ ...prev, [issue.id]: event.target.value as "in_review" | "resolved" | "rejected" }))}
                  className="w-full bg-muted/50 border border-border rounded-xl py-2 px-3 text-xs"
                >
                  <option value="in_review">In Review</option>
                  <option value="resolved">Resolved</option>
                  <option value="rejected">Rejected</option>
                </select>
                <textarea
                  value={draftNotes[issue.id] || ""}
                  onChange={(event) => setDraftNotes((prev) => ({ ...prev, [issue.id]: event.target.value }))}
                  placeholder="Resolution note"
                  rows={2}
                  className="w-full bg-muted/50 border border-border rounded-xl py-2 px-3 text-xs"
                />
                <button
                  onClick={() => handleUpdateIssue(issue)}
                  disabled={busyId === issue.id}
                  className="w-full btn-primary-gradient py-2 rounded-xl text-xs font-semibold disabled:opacity-60 flex items-center justify-center gap-1"
                >
                  <ShieldAlert className="w-3.5 h-3.5" /> {busyId === issue.id ? "Updating..." : "Update Issue"}
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default AdminIssues;
