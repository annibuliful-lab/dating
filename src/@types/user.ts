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
  isVerified?: boolean;
  verificationType?: "ADMIN" | "USER" | null;
  verifiedAt?: string | null;
  verifiedBy?: string | null;
  verifiedByUsername?: string | null;
  isAdmin?: boolean;
  profileImages?: ProfileImage[];
  updatedAt?: string;
  age?: number | null;
};
