import { supabase } from "@/client/supabase";
import { Database } from "../../../generated/supabase-database.types";

type UserUpdate = Database["public"]["Tables"]["User"]["Update"];

export const userService = {
  // Fetch all active users
  async getActiveUsers() {
    const { data, error } = await supabase
      .from("User")
      .select("*")
      .eq("status", "ACTIVE")
      .order("createdAt", { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  },

  // Fetch user by ID
  async getUserById(id: string) {
    const { data, error } = await supabase
      .from("User")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  // Fetch user profile data (excluding sensitive info)
  async getUserProfile(id: string) {
    const { data, error } = await supabase
      .from("User")
      .select(
        "id, fullName, username, age, gender, bio, profileImageKey, height, weight, relationShipStatus"
      )
      .eq("id", id)
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  // Search users by username or full name
  async searchUsers(searchTerm: string) {
    const { data, error } = await supabase
      .from("User")
      .select("id, fullName, username, profileImageKey, age, gender")
      .or(`fullName.ilike.%${searchTerm}%,username.ilike.%${searchTerm}%`)
      .eq("status", "ACTIVE")
      .limit(20);

    if (error) throw new Error(error.message);
    return data;
  },

  // Get users by age range
  async getUsersByAgeRange(minAge: number, maxAge: number) {
    const { data, error } = await supabase
      .from("User")
      .select("id, fullName, username, age, gender, bio, profileImageKey")
      .gte("age", minAge)
      .lte("age", maxAge)
      .eq("status", "ACTIVE");

    if (error) throw new Error(error.message);
    return data;
  },

  // Update user profile
  async updateUserProfile(id: string, updates: UserUpdate) {
    const { data, error } = await supabase
      .from("User")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  // Get users with their post counts
  async getUsersWithPostCounts() {
    const { data, error } = await supabase
      .from("User")
      .select(
        `
        id,
        fullName,
        username,
        profileImageKey,
        Post!Post_authorId_fkey (count)
      `
      )
      .eq("status", "ACTIVE");

    if (error) throw new Error(error.message);
    return data;
  },
};
