import { useQuery } from "@tanstack/react-query";
import { useSession } from "./auth/session";
import { fetchAllDoctors, fetchDoctor, type Doctor } from "./api/doctors";
import { getAppProfile, getFamily, getLockerDocuments, getMyAppointments, getProfile } from "./api/patient";

// Query keys in one place so mutations invalidate the right caches.
export const keys = {
  doctors: ["doctors"] as const,
  doctor: (id: string) => ["doctor", id] as const,
  profile: ["profile"] as const,
  appProfile: ["app-profile"] as const,
  family: ["family"] as const,
  appointments: ["appointments"] as const,
  locker: ["locker"] as const,
};

/** The whole directory, refreshed hourly and kept on the phone for instant search. */
export function useDoctors() {
  return useQuery({ queryKey: keys.doctors, queryFn: fetchAllDoctors, staleTime: 60 * 60 * 1000 });
}

/** One doctor: shown at once from the cached directory, then refreshed from GET /public/doctors/{id}. */
export function useDoctor(id: string) {
  const all = useDoctors();
  const cached = all.data?.find((d) => d.id === id);
  return useQuery<Doctor | null>({
    queryKey: keys.doctor(id),
    queryFn: () => fetchDoctor(id),
    initialData: cached,
    staleTime: 10 * 60 * 1000,
    enabled: !!id,
  });
}

export function useProfile() {
  const { status } = useSession();
  return useQuery({ queryKey: keys.profile, queryFn: getProfile, enabled: status === "signedIn", staleTime: 5 * 60 * 1000 });
}

export function useAppProfile() {
  const { status } = useSession();
  return useQuery({ queryKey: keys.appProfile, queryFn: getAppProfile, enabled: status === "signedIn", staleTime: 5 * 60 * 1000 });
}

export function useFamily() {
  const { status } = useSession();
  return useQuery({ queryKey: keys.family, queryFn: getFamily, enabled: status === "signedIn", staleTime: 5 * 60 * 1000 });
}

export function useMyAppointments() {
  const { status } = useSession();
  return useQuery({ queryKey: keys.appointments, queryFn: getMyAppointments, enabled: status === "signedIn", staleTime: 60 * 1000 });
}

export function useLocker() {
  const { status } = useSession();
  return useQuery({ queryKey: keys.locker, queryFn: getLockerDocuments, enabled: status === "signedIn", staleTime: 60 * 1000 });
}
