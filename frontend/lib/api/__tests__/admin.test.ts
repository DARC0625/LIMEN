/**
 * Admin API 테스트
 * @jest-environment node
 */

// ✅ P1-Next-Fix-Module-4: factory 패턴 사용 (싱글톤 import 금지)
import { createAdminAPI } from '../admin'

describe('adminAPI', () => {
  let adminAPI: ReturnType<typeof createAdminAPI>
  let mockApiRequest: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    // ✅ P1-Next-Fix-Module-4: factory로 생성
    mockApiRequest = jest.fn()
    adminAPI = createAdminAPI({ apiRequest: mockApiRequest as any })
  })

  it('should list users successfully', async () => {
    const mockUsers = [
      { id: 1, username: 'user1', role: 'user' },
      { id: 2, username: 'admin', role: 'admin' },
    ]

    mockApiRequest.mockResolvedValue(mockUsers)

    const result = await adminAPI.listUsers()

    expect(mockApiRequest).toHaveBeenCalledWith('/admin/users')
    expect(result).toEqual(mockUsers)
  })

  it('should get user details successfully', async () => {
    const userId = 1
    const mockUser = {
      id: userId,
      username: 'user1',
      role: 'user',
      vms: [],
    }

    mockApiRequest.mockResolvedValue(mockUser)

    const result = await adminAPI.getUser(userId)

    expect(mockApiRequest).toHaveBeenCalledWith(`/admin/users/${userId}`)
    expect(result).toEqual(mockUser)
  })

  it('should create user successfully', async () => {
    const createData = {
      username: 'newuser',
      password: 'password',
      role: 'user',
    }

    const createdUser = {
      id: 1,
      ...createData,
    }

    mockApiRequest.mockResolvedValue(createdUser)

    const result = await adminAPI.createUser(createData)

    expect(mockApiRequest).toHaveBeenCalledWith('/admin/users', {
      method: 'POST',
      body: JSON.stringify(createData),
    })
    expect(result).toEqual(createdUser)
  })

  it('should update user successfully', async () => {
    const userId = 1
    const updateData = {
      role: 'admin',
    }

    const updatedUser = {
      id: userId,
      username: 'user1',
      ...updateData,
    }

    mockApiRequest.mockResolvedValue(updatedUser)

    const result = await adminAPI.updateUser(userId, updateData)

    expect(mockApiRequest).toHaveBeenCalledWith(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    })
    expect(result).toEqual(updatedUser)
  })

  it('should delete user successfully', async () => {
    const userId = 1

    mockApiRequest.mockResolvedValue(undefined)

    await adminAPI.deleteUser(userId)

    expect(mockApiRequest).toHaveBeenCalledWith(`/admin/users/${userId}`, {
      method: 'DELETE',
    })
  })

  it('should update user role successfully', async () => {
    const userId = 1
    const role = 'admin'

    const updatedUser = {
      id: userId,
      username: 'user1',
      role,
    }

    mockApiRequest.mockResolvedValue(updatedUser)

    const result = await adminAPI.updateUserRole(userId, role)

    expect(mockApiRequest).toHaveBeenCalledWith(`/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    })
    expect(result).toEqual(updatedUser)
  })

  it('should approve user successfully', async () => {
    const userId = 1

    const approvedUser = {
      id: userId,
      username: 'user1',
      role: 'user',
      approved: true,
    }

    mockApiRequest.mockResolvedValue(approvedUser)

    const result = await adminAPI.approveUser(userId)

    expect(mockApiRequest).toHaveBeenCalledWith(`/admin/users/${userId}/approve`, {
      method: 'PUT',
    })
    expect(result).toEqual(approvedUser)
  })

  it('should handle listUsers errors', async () => {
    const error = new Error('Failed to list users')
    mockApiRequest.mockRejectedValue(error)

    await expect(adminAPI.listUsers()).rejects.toThrow('Failed to list users')
  })

  it('should handle getUser errors', async () => {
    const error = new Error('Failed to get user')
    mockApiRequest.mockRejectedValue(error)

    await expect(adminAPI.getUser(1)).rejects.toThrow('Failed to get user')
  })

  it('should handle createUser errors', async () => {
    const error = new Error('Failed to create user')
    mockApiRequest.mockRejectedValue(error)

    await expect(adminAPI.createUser({
      username: 'newuser',
      password: 'password',
      role: 'user',
    })).rejects.toThrow('Failed to create user')
  })

  it('should handle updateUser errors', async () => {
    const error = new Error('Failed to update user')
    mockApiRequest.mockRejectedValue(error)

    await expect(adminAPI.updateUser(1, { role: 'admin' })).rejects.toThrow('Failed to update user')
  })

  it('should handle deleteUser errors', async () => {
    const error = new Error('Failed to delete user')
    mockApiRequest.mockRejectedValue(error)

    await expect(adminAPI.deleteUser(1)).rejects.toThrow('Failed to delete user')
  })

  it('should handle updateUserRole errors', async () => {
    const error = new Error('Failed to update user role')
    mockApiRequest.mockRejectedValue(error)

    await expect(adminAPI.updateUserRole(1, 'admin')).rejects.toThrow('Failed to update user role')
  })

  it('should handle approveUser errors', async () => {
    const error = new Error('Failed to approve user')
    mockApiRequest.mockRejectedValue(error)

    await expect(adminAPI.approveUser(1)).rejects.toThrow('Failed to approve user')
  })
})


