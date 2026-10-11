
import { userApi } from '@/services/user-api';

export const userService = {
  async getUsersByIds(ids: string[]) {
    return userApi<Awaited<ReturnType<typeof import('@/server/data/users').userService.getUsersByIds>>>('users', 'getUsersByIds', [ids]);
  },
  async getActiveUsers() {
    return userApi<Awaited<ReturnType<typeof import('@/server/data/users').userService.getActiveUsers>>>('users', 'getActiveUsers', []);
  },
  async getUserById(id: string) {
    return userApi<Awaited<ReturnType<typeof import('@/server/data/users').userService.getUserById>>>('users', 'getUserById', [id]);
  },
  async getUserProfile(id: string) {
    return userApi<Awaited<ReturnType<typeof import('@/server/data/users').userService.getUserProfile>>>('users', 'getUserProfile', [id]);
  },
  async searchUsers(searchTerm: string) {
    return userApi<Awaited<ReturnType<typeof import('@/server/data/users').userService.searchUsers>>>('users', 'searchUsers', [searchTerm]);
  },
  async getUsersByAgeRange(minAge: number, maxAge: number) {
    return userApi<Awaited<ReturnType<typeof import('@/server/data/users').userService.getUsersByAgeRange>>>('users', 'getUsersByAgeRange', [minAge, maxAge]);
  },
  async getUsersWithPostCounts() {
    return userApi<Awaited<ReturnType<typeof import('@/server/data/users').userService.getUsersWithPostCounts>>>('users', 'getUsersWithPostCounts', []);
  },
};
