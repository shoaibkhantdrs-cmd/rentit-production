export interface IUserRoleRepository {
  assign(userId: string, roleId: string, assignedBy?: string | null): Promise<void>;
  remove(userId: string, roleId: string): Promise<void>;
  listRoleNamesForUser(userId: string): Promise<string[]>;
}
