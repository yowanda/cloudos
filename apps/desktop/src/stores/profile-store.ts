import { createStore, produce } from "solid-js/store";

const STORAGE_KEY = "cloudos:profile";

export interface Profile {
  displayName: string;
  email: string;
  avatar: string; // emoji or single character used as the avatar in the UI
  bio: string;
}

const DEFAULT_PROFILE: Profile = {
  displayName: "Local User",
  email: "",
  avatar: "🙂",
  bio: "",
};

function loadInitial(): Profile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    const parsed = JSON.parse(raw);
    return {
      displayName: typeof parsed?.displayName === "string" ? parsed.displayName : DEFAULT_PROFILE.displayName,
      email: typeof parsed?.email === "string" ? parsed.email : DEFAULT_PROFILE.email,
      avatar: typeof parsed?.avatar === "string" && parsed.avatar.length > 0 ? parsed.avatar : DEFAULT_PROFILE.avatar,
      bio: typeof parsed?.bio === "string" ? parsed.bio : DEFAULT_PROFILE.bio,
    };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

const [profile, setProfile] = createStore<Profile>(loadInitial());

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ignore
  }
}

export function updateProfile(patch: Partial<Profile>) {
  setProfile(produce((p) => Object.assign(p, patch)));
  persist();
}

export function resetProfile() {
  setProfile({ ...DEFAULT_PROFILE });
  persist();
}

export { profile };
