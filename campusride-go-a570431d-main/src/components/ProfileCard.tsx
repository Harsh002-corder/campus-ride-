import type { AuthUser } from "@/lib/apiClient";

interface ProfileStats {
  total: number;
  completed: number;
  cancelled: number;
  active: number;
}

interface ProfileCardProps {
  user: AuthUser | null;
  stats: ProfileStats;
  onEditProfile: () => void;
}

const getInitials = (name: string) => {
  const cleaned = name.trim();
  if (!cleaned) return "U";

  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return cleaned.slice(0, 2).toUpperCase();
};

const ProfileCard = ({ user, stats, onEditProfile }: ProfileCardProps) => {
  const name = user?.name || "Campus Rider";
  const email = user?.email || "rider@campusride.app";
  const initials = getInitials(name);

  const statItems = [
    { label: "Total Rides", value: stats.total },
    { label: "Completed", value: stats.completed },
    { label: "Cancelled", value: stats.cancelled },
    { label: "Active", value: stats.active },
  ];

  return (
    <section className="profile-card h-full rounded-3xl p-5 sm:p-6 border border-border/70">
      <div className="flex flex-col items-center text-center">
        <div className="mb-3 h-20 w-20 overflow-hidden rounded-full border-2 border-primary/30 bg-secondary shadow-[0_10px_24px_rgba(255,193,7,0.2)] dark:shadow-[0_10px_24px_rgba(99,102,241,0.22)]">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt={name} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-xl font-bold text-foreground">{initials}</span>
          )}
        </div>

        <h3 className="text-xl font-bold font-display text-foreground">{name}</h3>
        <p className="text-sm text-muted-foreground break-all">{email}</p>

        <button
          type="button"
          onClick={onEditProfile}
          className="mt-4 inline-flex items-center rounded-xl px-4 py-2 text-sm font-semibold btn-primary-gradient"
        >
          Edit Profile
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {statItems.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-border/60 bg-muted/30 px-3 py-3 text-center"
          >
            <p className="text-lg font-bold font-display text-foreground">{item.value}</p>
            <p className="text-xs text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default ProfileCard;
