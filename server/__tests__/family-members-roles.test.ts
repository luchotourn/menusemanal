import { describe, it, expect } from 'vitest';

/**
 * Tests for the family members API role mapping.
 *
 * The /api/families/:id/members endpoint returns two distinct role fields per
 * member:
 *  - `role`: "admin" | "member" — whether the user is the family's creator
 *    (admin) within this specific family.
 *  - `userRole`: "creator" | "commentator" — the user's account-level role
 *    that determines whether they can edit plans (creator/"Planificador") or
 *    only view and comment (commentator/"Observador").
 *
 * These tests validate the mapping at a behavioral level so the contract is
 * documented even though the route handler is not directly unit-testable.
 */

type StoredMember = {
  id: number;
  name: string;
  email: string;
  avatar: string | null;
  role: 'creator' | 'commentator';
  createdAt: Date;
};

function mapMembersWithRoles(
  members: StoredMember[],
  familyCreatedBy: number | null
) {
  return members.map(member => ({
    id: member.id,
    name: member.name,
    email: member.email,
    avatar: member.avatar,
    role: member.id === familyCreatedBy ? 'admin' : 'member',
    userRole: member.role,
    createdAt: member.createdAt,
  }));
}

const baseMember = (overrides: Partial<StoredMember>): StoredMember => ({
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  avatar: null,
  role: 'creator',
  createdAt: new Date('2025-01-01T00:00:00Z'),
  ...overrides,
});

describe('Family members role mapping', () => {
  it('marks the family creator as admin', () => {
    const members = [baseMember({ id: 1 }), baseMember({ id: 2, email: 'b@x.com' })];
    const mapped = mapMembersWithRoles(members, 1);
    expect(mapped[0].role).toBe('admin');
    expect(mapped[1].role).toBe('member');
  });

  it('exposes the user-level role (creator) as userRole', () => {
    const members = [baseMember({ id: 5, role: 'creator' })];
    const mapped = mapMembersWithRoles(members, 5);
    expect(mapped[0].userRole).toBe('creator');
  });

  it('exposes the user-level role (commentator) as userRole', () => {
    const members = [baseMember({ id: 7, role: 'commentator' })];
    const mapped = mapMembersWithRoles(members, 1);
    expect(mapped[0].userRole).toBe('commentator');
  });

  it('keeps admin status and userRole independent', () => {
    // The family admin can also be a commentator-role user (edge case), and
    // a non-admin member can be a creator-role user.
    const members = [
      baseMember({ id: 1, role: 'commentator' }),
      baseMember({ id: 2, role: 'creator', email: 'c@x.com' }),
    ];
    const mapped = mapMembersWithRoles(members, 1);
    expect(mapped[0]).toMatchObject({ role: 'admin', userRole: 'commentator' });
    expect(mapped[1]).toMatchObject({ role: 'member', userRole: 'creator' });
  });

  it('handles families with no createdBy (legacy) by marking everyone as member', () => {
    const members = [baseMember({ id: 1 }), baseMember({ id: 2, email: 'b@x.com' })];
    const mapped = mapMembersWithRoles(members, null);
    expect(mapped.every(m => m.role === 'member')).toBe(true);
  });
});
