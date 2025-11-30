export type ProfileImage = {
  id: string;
  imageKey: string;
  imageUrl: string;
  order: number;
};

export type UserProfile = {
  id: string;
  username: string;
  name: string;
  lastname: string;
  fullName: string;
  gender: string;
  birthday: string;
  status: string;
  bio: string;
  phone: string;
  lineId: string;
  height: string;
  weight: string;
  profileImageKey: string;
  avatarUrl: string | null;
  relationShipStatus: string;
  email?: string | null;
  userStatus?: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  role?: "USER" | "ADMIN";
  isVerified?: boolean;
  verifiedAt?: string | null;
  verifiedBy?: string | null;
  verifiedByUsername?: string | null;
  profileImages?: ProfileImage[];
  updatedAt?: string;
  age?: number | null;
};
