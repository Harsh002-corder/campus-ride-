import { useMemo, useState, type ChangeEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiClient, type AuthUser } from "@/lib/apiClient";
import { useAppToast } from "@/hooks/use-app-toast";

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AuthUser | null;
  onSaved: (user: AuthUser) => void;
}

const MAX_IMAGE_BYTES = 1024 * 1024;
const OUTPUT_SIZE = 512;
const OUTPUT_QUALITY = 0.82;

const ProfileDialog = ({ open, onOpenChange, user, onSaved }: ProfileDialogProps) => {
  const toast = useAppToast();
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl || null);
  const [saving, setSaving] = useState(false);

  const initials = useMemo(() => {
    const source = (name || user?.name || "U").trim();
    const words = source.split(/\s+/).filter(Boolean);
    if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
    return source.slice(0, 2).toUpperCase();
  }, [name, user?.name]);

  const resetForm = () => {
    setName(user?.name || "");
    setPhone(user?.phone || "");
    setAvatarUrl(user?.avatarUrl || null);
  };

  const toDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });

  const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = src;
  });

  const cropAndCompressImage = async (file: File) => {
    const dataUrl = await toDataUrl(file);
    const image = await loadImage(dataUrl);

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;

    const context = canvas.getContext("2d");
    if (!context) {
      return dataUrl;
    }

    const sourceSize = Math.min(image.width, image.height);
    const sourceX = (image.width - sourceSize) / 2;
    const sourceY = (image.height - sourceSize) / 2;

    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      OUTPUT_SIZE,
      OUTPUT_SIZE,
    );

    return canvas.toDataURL("image/jpeg", OUTPUT_QUALITY);
  };

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.info("Invalid file", "Please select an image file.");
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      toast.info("Image too large", "Please upload an image up to 1MB.");
      return;
    }

    try {
      const dataUrl = await cropAndCompressImage(file);
      setAvatarUrl(dataUrl);
    } catch (error) {
      toast.error("Could not load image", error);
    }
  };

  const saveProfile = async () => {
    if (!user) return;

    const nextName = name.trim();
    const nextPhone = phone.trim();

    if (nextName.length < 2) {
      toast.info("Name too short", "Please enter at least 2 characters.");
      return;
    }

    setSaving(true);
    try {
      const response = await apiClient.users.updateMyProfile({
        name: nextName,
        phone: nextPhone ? nextPhone : null,
        avatarUrl: avatarUrl || null,
      });

      if (response.user) {
        onSaved(response.user);
      }

      toast.success("Profile updated", "Your details were saved successfully.");
      onOpenChange(false);
    } catch (error) {
      toast.error("Could not update profile", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          resetForm();
        }
        onOpenChange(value);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>Update your details and profile image.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
              {avatarUrl ? <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" /> : initials}
            </div>
            <div className="space-y-2">
              <input
                type="file"
                accept="image/*"
                title="Upload profile image"
                onChange={onFileChange}
                className="text-xs text-muted-foreground"
              />
              <button
                type="button"
                onClick={() => setAvatarUrl(null)}
                className="text-xs text-destructive hover:underline"
              >
                Remove image
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Name</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full bg-muted/50 border border-border rounded-xl py-2.5 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              title="Name"
              placeholder="Enter name"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="w-full bg-muted/50 border border-border rounded-xl py-2.5 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              title="Phone"
              placeholder="Enter phone number"
            />
          </div>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => {
              resetForm();
              onOpenChange(false);
            }}
            className="px-4 py-2 rounded-xl text-sm bg-muted/50 hover:bg-muted text-muted-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={saveProfile}
            disabled={saving}
            className="btn-primary-gradient px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileDialog;
